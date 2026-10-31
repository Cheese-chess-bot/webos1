"use strict";

document.querySelector("#version").textContent = "V2";

// FEATURE 4: LOCAL TEXT FILES
OS.register("files", "Text files", "▤", container => {
  const stored = OS.read("files", []);

  let files = Array.isArray(stored)
    ? stored.filter(file =>
        file &&
        typeof file.name === "string" &&
        typeof file.content === "string"
      )
    : [];

  let selected = -1;

  container.innerHTML = `
    <h2>Your text files</h2>

    <div class="row">
      <button class="new primary">New file</button>
      <button class="export" disabled>Export .txt</button>
      <button class="delete" disabled>Delete file</button>
    </div>

    <p>Saved in this browser. Export files you want to keep elsewhere.</p>
    <div class="file-list"></div>

    <div class="stack">
      <label>
        Filename
        <input class="filename" maxlength="80" disabled>
      </label>

      <label>
        Contents
        <textarea class="file-content" disabled></textarea>
      </label>

      <small class="save-status" role="status">Choose or create a file.</small>
    </div>
  `;

  const list = container.querySelector(".file-list");
  const filename = container.querySelector(".filename");
  const editor = container.querySelector(".file-content");
  const exportButton = container.querySelector(".export");
  const deleteButton = container.querySelector(".delete");
  const status = container.querySelector(".save-status");

  function save() {
    status.textContent = OS.save("files", files)
      ? "Saved on this device."
      : "Could not save. Export your work.";
  }

  function renderList() {
    list.replaceChildren();

    files.forEach((file, index) => {
      const button = document.createElement("button");
      button.textContent = `${index === selected ? "● " : ""}${file.name}`;
      button.onclick = () => select(index);
      list.append(button);
    });
  }

  function select(index) {
    selected = index;
    const file = files[index];

    filename.disabled = !file;
    editor.disabled = !file;
    exportButton.disabled = !file;
    deleteButton.disabled = !file;

    filename.value = file?.name || "";
    editor.value = file?.content || "";

    renderList();
  }

  container.querySelector(".new").onclick = () => {
    files.push({
      name: `Untitled ${files.length + 1}.txt`,
      content: ""
    });

    save();
    select(files.length - 1);
    filename.focus();
    filename.select();
  };

  filename.oninput = () => {
    if (!files[selected]) return;

    files[selected].name = filename.value.trim() || "Untitled.txt";
    save();
    renderList();
  };

  editor.oninput = () => {
    if (!files[selected]) return;

    files[selected].content = editor.value;
    save();
  };

  exportButton.onclick = () => {
    const file = files[selected];
    if (!file) return;

    let safeName = file.name.replace(/[\\/:*?"<>|]/g, "_");
    if (!safeName.endsWith(".txt")) safeName += ".txt";

    OS.download(safeName, file.content);
  };

  deleteButton.onclick = () => {
    if (!files[selected]) return;
    if (!confirm(`Delete "${files[selected].name}"?`)) return;

    files.splice(selected, 1);
    save();
    select(files.length ? 0 : -1);
  };

  select(files.length ? 0 : -1);
});

// FEATURE 5: CALCULATOR
// Explicit arithmetic operations; no eval().
OS.register("calculator", "Calculator", "▦", container => {
  container.innerHTML = `
    <h2>Calculator</h2>
    <div class="calculator">
      <output aria-live="polite">0</output>
    </div>
    <small>Calculates one operation at a time, left to right.</small>
  `;

  const grid = container.querySelector(".calculator");
  const output = container.querySelector("output");

  let display = "0";
  let previous = null;
  let operation = null;
  let replaceDisplay = false;

  function show() {
    output.textContent = display;
  }

  function calculate(a, b, op) {
    switch (op) {
      case "+": return a + b;
      case "−": return a - b;
      case "×": return a * b;
      case "÷": return b === 0 ? NaN : a / b;
      default: return b;
    }
  }

  function result(value) {
    return Number.isFinite(value)
      ? String(Number(value.toPrecision(12)))
      : "Error";
  }

  function reset() {
    display = "0";
    previous = null;
    operation = null;
    replaceDisplay = false;
  }

  function press(key) {
    if (key === "C") {
      reset();
    } else if (/^\d$/.test(key) || key === ".") {
      if (replaceDisplay || display === "Error") {
        display = "0";
        replaceDisplay = false;
      }

      if (key === ".") {
        if (!display.includes(".")) display += ".";
      } else if (display.length < 16) {
        display = display === "0" ? key : display + key;
      }
    } else if (key === "⌫") {
      if (display === "Error" || replaceDisplay) {
        display = "0";
      } else {
        display = display.slice(0, -1) || "0";
      }
    } else if (key === "±") {
      if (display !== "0" && display !== "Error") {
        display = display.startsWith("-")
          ? display.slice(1)
          : "-" + display;
      }
    } else if (key === "=") {
      if (operation !== null && previous !== null) {
        display = result(
          calculate(previous, Number(display), operation)
        );

        previous = null;
        operation = null;
        replaceDisplay = true;
      }
    } else {
      if (display === "Error") reset();

      if (operation && !replaceDisplay) {
        display = result(
          calculate(previous, Number(display), operation)
        );
      }

      if (display === "Error") {
        previous = null;
        operation = null;
      } else {
        previous = Number(display);
        operation = key;
      }

      replaceDisplay = true;
    }

    show();
  }

  [
    "C", "⌫", "±", "÷",
    "7", "8", "9", "×",
    "4", "5", "6", "−",
    "1", "2", "3", "+",
    "0", ".", "="
  ].forEach(key => {
    const button = document.createElement("button");
    button.textContent = key;
    button.onclick = () => press(key);

    if (key === "=") button.className = "primary";

    grid.append(button);
  });
});

// FEATURE 6: FOCUS TIMER
// Deadline-based timing prevents background-tab interval drift.
const focusState = {
  duration: 25 * 60,
  remaining: 25 * 60,
  deadline: 0
};

function focusSeconds() {
  return focusState.deadline
    ? Math.max(
        0,
        Math.ceil((focusState.deadline - Date.now()) / 1000)
      )
    : focusState.remaining;
}

function drawFocus() {
  const output = document.querySelector(".focus-time");
  const toggle = document.querySelector(".focus-toggle");

  if (!output || !toggle) return;

  const seconds = focusSeconds();

  output.textContent =
    String(Math.floor(seconds / 60)).padStart(2, "0") +
    ":" +
    String(seconds % 60).padStart(2, "0");

  toggle.textContent = focusState.deadline ? "Pause" : "Start";
  toggle.disabled = seconds === 0;
}

setInterval(() => {
  if (focusState.deadline && focusSeconds() === 0) {
    focusState.deadline = 0;
    focusState.remaining = 0;
    OS.notify("Focus session complete. Take a break.");
  }

  drawFocus();
}, 250);

OS.register("focus", "Focus timer", "◷", container => {
  container.innerHTML = `
    <h2>One thing at a time.</h2>

    <label>
      Session length
      <select class="duration">
        <option value="5">5 minutes</option>
        <option value="15">15 minutes</option>
        <option value="25">25 minutes</option>
        <option value="50">50 minutes</option>
      </select>
    </label>

    <div class="timer focus-time">25:00</div>

    <div class="row">
      <button class="primary focus-toggle">Start</button>
      <button class="focus-reset">Reset</button>
    </div>

    <p>
      The timer continues when its window is closed.
      Keep this browser tab open; reloading resets the timer.
    </p>
  `;

  const duration = container.querySelector(".duration");
  duration.value = String(focusState.duration / 60);

  duration.onchange = () => {
    focusState.duration = Number(duration.value) * 60;
    focusState.remaining = focusState.duration;
    focusState.deadline = 0;
    drawFocus();
  };

  container.querySelector(".focus-toggle").onclick = () => {
    if (focusState.deadline) {
      focusState.remaining = focusSeconds();
      focusState.deadline = 0;
    } else {
      focusState.deadline =
        Date.now() + focusState.remaining * 1000;
    }

    drawFocus();
  };

  container.querySelector(".focus-reset").onclick = () => {
    focusState.remaining = focusState.duration;
    focusState.deadline = 0;
    drawFocus();
  };

  drawFocus();
});