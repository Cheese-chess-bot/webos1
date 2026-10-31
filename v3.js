"use strict";

document.querySelector("#version").textContent = "V3";

// FEATURE 7: DRAWING APP
OS.register("paint", "Drawing studio", "✎", container => {
  container.innerHTML = `
    <h2>Drawing studio</h2>

    <div class="row">
      <label>
        Ink
        <input class="ink" type="color" value="#163d35">
      </label>

      <label>
        Brush
        <input
          class="brush"
          type="range"
          min="1"
          max="35"
          value="5"
        >
      </label>

      <button class="clear">Clear</button>
      <button class="export primary">Export PNG</button>
    </div>

    <p>Draw with your mouse, finger, or stylus.</p>
    <canvas
      width="900"
      height="500"
      aria-label="Drawing canvas"
    ></canvas>

    <small>
      Drawings remain while this window is open.
      Export before closing.
    </small>
  `;

  const canvas = container.querySelector("canvas");
  const context = canvas.getContext("2d");
  const ink = container.querySelector(".ink");
  const brush = container.querySelector(".brush");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.lineCap = "round";
  context.lineJoin = "round";

  let drawing = false;

  function position(event) {
    const bounds = canvas.getBoundingClientRect();

    return {
      x: (event.clientX - bounds.left) *
        canvas.width / bounds.width,
      y: (event.clientY - bounds.top) *
        canvas.height / bounds.height
    };
  }

  canvas.onpointerdown = event => {
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    drawing = true;

    const point = position(event);

    context.strokeStyle = ink.value;
    context.fillStyle = ink.value;
    context.lineWidth = Number(brush.value);

    // A single tap should leave a dot.
    context.beginPath();
    context.arc(
      point.x,
      point.y,
      context.lineWidth / 2,
      0,
      Math.PI * 2
    );
    context.fill();

    context.beginPath();
    context.moveTo(point.x, point.y);
  };

  canvas.onpointermove = event => {
    if (!drawing) return;

    const point = position(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  };

  canvas.onpointerup = canvas.onpointercancel = () => {
    drawing = false;
  };

  container.querySelector(".clear").onclick = () => {
    if (!confirm("Clear this drawing? Export first if needed.")) return;

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
  };

  container.querySelector(".export").onclick = () => {
    canvas.toBlob(blob => {
      if (!blob) {
        OS.notify("Could not export drawing.");
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "orbit-drawing.png";
      link.click();

      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  };
});

// FEATURE 8: BACKUP AND RESTORE
// Only known data types are imported. Imported strings are never inserted as executable HTML.
function validateBackup(data) {
  if (!data || data.format !== "orbit-copy-backup" ||
      data.version !== 1) {
    throw new Error("This is not a supported Orbit backup.");
  }

  if (!Array.isArray(data.tasks) || data.tasks.length > 1000) {
    throw new Error("Invalid task list.");
  }

  const tasksValid = data.tasks.every(task =>
    task &&
    typeof task.title === "string" &&
    task.title.length <= 140 &&
    ["To do", "Doing", "Done"].includes(task.status)
  );

  if (!tasksValid) throw new Error("Invalid task data.");

  if (!Array.isArray(data.files) || data.files.length > 200) {
    throw new Error("Invalid file list.");
  }

  const filesValid = data.files.every(file =>
    file &&
    typeof file.name === "string" &&
    file.name.length <= 80 &&
    typeof file.content === "string" &&
    file.content.length <= 500000
  );

  if (!filesValid) throw new Error("Invalid text file data.");
  if (!validTheme(data.theme)) throw new Error("Invalid theme.");

  return {
    tasks: data.tasks.map(task => ({
      title: task.title,
      status: task.status
    })),
    files: data.files.map(file => ({
      name: file.name,
      content: file.content
    })),
    theme: {
      sky: data.theme.sky,
      glow: data.theme.glow,
      accent: data.theme.accent,
      message: data.theme.message
    }
  };
}

OS.register("backup", "Backup and restore", "⇅", container => {
  container.innerHTML = `
    <h2>Keep your work safe.</h2>

    <p>
      Back up your tasks, text files, and wallpaper settings.
      Drawings, timer state, and window layouts are not included.
    </p>

    <button class="export primary">Download backup</button>

    <hr>

    <label class="stack">
      Restore an Orbit backup
      <input
        class="import"
        type="file"
        accept=".json,application/json"
      >
    </label>

    <p>
      Restoring replaces existing tasks, text files, and theme.
      Download a backup first.
    </p>

    <p class="backup-status" role="status"></p>
  `;

  container.querySelector(".export").onclick = () => {
    const backup = {
      format: "orbit-copy-backup",
      version: 1,
      createdAt: new Date().toISOString(),
      tasks: OS.read("tasks", []),
      files: OS.read("files", []),
      theme: OS.read("theme", defaultTheme)
    };

    OS.download(
      "orbit-backup.json",
      JSON.stringify(backup, null, 2),
      "application/json"
    );
  };

  container.querySelector(".import").onchange = async event => {
    const file = event.target.files[0];
    const status = container.querySelector(".backup-status");

    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      status.textContent = "Backup must be smaller than 2 MB.";
      event.target.value = "";
      return;
    }

    try {
      const data = validateBackup(JSON.parse(await file.text()));

      if (!confirm(
        "Replace your tasks, text files, and theme with this backup?"
      )) {
        return;
      }

      const keys = ["tasks", "files", "theme"];
      const previous = new Map();

      // Keep previous values so a failed write can be rolled back.
      for (const key of keys) {
        previous.set(key, localStorage.getItem(OS.prefix + key));
      }

      try {
        for (const key of keys) {
          localStorage.setItem(
            OS.prefix + key,
            JSON.stringify(data[key])
          );
        }
      } catch (error) {
        for (const key of keys) {
          localStorage.removeItem(OS.prefix + key);
        }

        for (const [key, value] of previous) {
          if (value !== null) {
            localStorage.setItem(OS.prefix + key, value);
          }
        }

        throw error;
      }

      // Close editors that still hold old in-memory data.
      for (const id of ["tasks", "files", "wallpaper"]) {
        OS.windows.get(id)
          ?.querySelector('[aria-label="Close"]')
          ?.click();
      }

      applyTheme(data.theme);
      status.textContent = "Backup restored successfully.";
      OS.notify("Backup restored.");
    } catch (error) {
      status.textContent = `Restore failed: ${error.message}`;
    } finally {
      event.target.value = "";
    }
  };
});

//FEATURE 9: SAVED WINDOW LAYOUT
function captureLayout() {
  return [...OS.windows.entries()].map(([id, windowElement]) => ({
    id,
    left: windowElement.offsetLeft,
    top: windowElement.offsetTop,
    width: windowElement.offsetWidth,
    height: windowElement.offsetHeight,
    hidden: windowElement.hidden,
    maximized: windowElement.classList.contains("maximized")
  }));
}

function restoreLayout() {
  const layout = OS.read("layout", []);

  if (!Array.isArray(layout)) {
    OS.notify("No valid saved layout.");
    return;
  }

  const desktop = document.querySelector("#desktop");

  for (const item of layout.slice(0, 20)) {
    if (!item || !OS.apps.has(item.id)) continue;

    const numbers = ["left", "top", "width", "height"];
    if (!numbers.every(key => Number.isFinite(item[key]))) continue;

    const windowElement = OS.open(item.id);

    const width = Math.max(
      270,
      Math.min(item.width, desktop.clientWidth - 16)
    );

    const height = Math.max(
      220,
      Math.min(item.height, desktop.clientHeight - 90)
    );

    windowElement.style.width = width + "px";
    windowElement.style.height = height + "px";

    windowElement.style.left = Math.max(
      0,
      Math.min(item.left, desktop.clientWidth - width)
    ) + "px";

    windowElement.style.top = Math.max(
      0,
      Math.min(item.top, desktop.clientHeight - 130)
    ) + "px";

    windowElement.classList.toggle(
      "maximized",
      Boolean(item.maximized)
    );

    windowElement.hidden = Boolean(item.hidden);
  }
}

OS.register("workspace", "Workspace layout", "▣", container => {
  container.innerHTML = `
    <h2>Your workspace, remembered.</h2>

    <p>
      Save which apps are open, their positions, sizes,
      and minimized states.
    </p>

    <div class="row">
      <button class="save primary">Save layout</button>
      <button class="restore">Restore layout</button>
    </div>

    <p>
      Unsaved drawings and timer progress are not restored.
      Apps absent from the saved layout remain open.
    </p>

    <label class="row">
      <input class="auto" type="checkbox">
      Restore saved layout when the page opens
    </label>
  `;

  const auto = container.querySelector(".auto");
  auto.checked = OS.read("autoLayout", false) === true;

  auto.onchange = () => {
    OS.save("autoLayout", auto.checked);
  };

  container.querySelector(".save").onclick = () => {
    if (OS.save("layout", captureLayout())) {
      OS.notify("Workspace layout saved.");
    }
  };

  container.querySelector(".restore").onclick = () => {
    restoreLayout();
    OS.notify("Saved layout restored.");
  };
});

if (OS.read("autoLayout", false) === true) {
  restoreLayout();
}

//PLANS FOR V4
//Add a browser
//Add a game tab