"use strict";

const OS = {
  apps: new Map(),
  windows: new Map(),
  z: 10,
  prefix: "orbit-copy-",

  read(key, fallback) {
    try {
      const value = localStorage.getItem(this.prefix + key);
      return value === null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  },

  save(key, value) {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
      return true;
    } catch {
      this.notify("Storage unavailable or full.");
      return false;
    }
  },

  notify(message) {
    const toast = document.querySelector("#toast");
    toast.textContent = message;
    toast.style.display = "block";

    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.style.display = "none";
    }, 3000);
  },

  download(name, text, type = "text/plain") {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = document.createElement("a");

    link.href = url;
    link.download = name;
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  register(id, title, icon, render) {
    this.apps.set(id, { title, icon, render });

    const button = document.createElement("button");
    button.textContent = icon;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.dataset.app = id;
    button.onclick = () => this.open(id);

    document.querySelector("#dock").append(button);
  },

  open(id) {
    const app = this.apps.get(id);
    if (!app) return;

    if (this.windows.has(id)) {
      const existing = this.windows.get(id);
      existing.hidden = false;
      existing.style.zIndex = ++this.z;
      return existing;
    }

    const windowElement = document.createElement("section");
    windowElement.className = "window";
    windowElement.setAttribute("aria-label", app.title);

    const offset = this.windows.size * 25;
    windowElement.style.left = Math.min(40 + offset, 180) + "px";
    windowElement.style.top = Math.min(25 + offset, 150) + "px";
    windowElement.style.zIndex = ++this.z;

    windowElement.innerHTML = `
      <div class="titlebar">
        <strong></strong>
        <div class="window-controls">
          <button aria-label="Minimize">−</button>
          <button aria-label="Maximize">□</button>
          <button aria-label="Close">×</button>
        </div>
      </div>
      <div class="content"></div>
    `;

    windowElement.querySelector("strong").textContent =
      `${app.icon} ${app.title}`;

    document.querySelector("#windows").append(windowElement);
    this.windows.set(id, windowElement);

    const dockButton = [...document.querySelectorAll("#dock button")]
      .find(button => button.dataset.app === id);

    dockButton.classList.add("running");

    windowElement.addEventListener("pointerdown", () => {
      windowElement.style.zIndex = ++this.z;
    });

    const [minimize, maximize, close] =
      windowElement.querySelectorAll(".window-controls button");

    minimize.onclick = () => {
      windowElement.hidden = true;
    };

    maximize.onclick = () => {
      windowElement.classList.toggle("maximized");
    };

    let cleanup;

    close.onclick = () => {
      if (typeof cleanup === "function") cleanup();
      windowElement.remove();
      this.windows.delete(id);
      dockButton.classList.remove("running");
    };

    const titlebar = windowElement.querySelector(".titlebar");

    titlebar.onpointerdown = event => {
      if (event.target.closest("button")) return;
      if (windowElement.classList.contains("maximized")) return;

      titlebar.setPointerCapture(event.pointerId);

      const startX = event.clientX;
      const startY = event.clientY;
      const left = windowElement.offsetLeft;
      const top = windowElement.offsetTop;
      const desktop = document.querySelector("#desktop");

      titlebar.onpointermove = moveEvent => {
        const maxLeft = Math.max(
          0,
          desktop.clientWidth - windowElement.offsetWidth
        );

        const maxTop = Math.max(0, desktop.clientHeight - 130);

        const nextLeft = left + moveEvent.clientX - startX;
        const nextTop = top + moveEvent.clientY - startY;

        windowElement.style.left =
          Math.max(0, Math.min(maxLeft, nextLeft)) + "px";

        windowElement.style.top =
          Math.max(0, Math.min(maxTop, nextTop)) + "px";
      };

      titlebar.onpointerup = titlebar.onpointercancel = () => {
        titlebar.onpointermove = null;
      };
    };

    cleanup = app.render(
      windowElement.querySelector(".content"),
      windowElement
    );

    return windowElement;
  }
};

window.OS = OS;

// Shared clock.
function updateClock() {
  document.querySelector("#clock").textContent =
    new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
}

updateClock();
setInterval(updateClock, 1000);

// FEATURE 1: TASK BOARD
OS.register("tasks", "Task board", "☑", container => {
  container.innerHTML = `
    <h2>Mission board</h2>
    <form class="row">
      <input
        name="task"
        placeholder="Your next task..."
        aria-label="New task"
        maxlength="140"
        required
      >
      <button class="primary">Add task</button>
    </form>
    <p class="task-summary"></p>
    <div class="task-list"></div>
    <button class="undo" disabled>Undo delete</button>
  `;

  const stored = OS.read("tasks", []);
  let tasks = Array.isArray(stored)
    ? stored.filter(task =>
        task &&
        typeof task.title === "string" &&
        ["To do", "Doing", "Done"].includes(task.status)
      )
    : [];

  let removed = null;

  const list = container.querySelector(".task-list");
  const undo = container.querySelector(".undo");

  function persist() {
    OS.save("tasks", tasks);
  }

  function render() {
    list.replaceChildren();

    container.querySelector(".task-summary").textContent =
      `${tasks.filter(task => task.status === "Done").length}` +
      ` / ${tasks.length} complete`;

    tasks.forEach((task, index) => {
      const row = document.createElement("div");
      row.className = "task-row";
      row.classList.toggle("done", task.status === "Done");

      const title = document.createElement("input");
      title.value = task.title;
      title.maxLength = 140;
      title.setAttribute("aria-label", "Edit task");

      title.onchange = () => {
        const value = title.value.trim();

        if (!value) {
          title.value = task.title;
          return;
        }

        task.title = value;
        persist();
      };

      const status = document.createElement("select");
      status.setAttribute("aria-label", "Task status");

      ["To do", "Doing", "Done"].forEach(name => {
        const option = document.createElement("option");
        option.textContent = name;
        option.value = name;
        status.append(option);
      });

      status.value = task.status;

      status.onchange = () => {
        task.status = status.value;
        persist();
        render();
      };

      const remove = document.createElement("button");
      remove.textContent = "×";
      remove.setAttribute("aria-label", "Delete task");

      remove.onclick = () => {
        removed = { task: { ...task }, index };
        tasks.splice(index, 1);
        undo.disabled = false;
        persist();
        render();
      };

      row.append(title, status, remove);
      list.append(row);
    });
  }

  container.querySelector("form").onsubmit = event => {
    event.preventDefault();

    const input = event.currentTarget.elements.task;
    const title = input.value.trim();
    if (!title) return;

    tasks.push({ title, status: "To do" });
    input.value = "";

    persist();
    render();
    input.focus();
  };

  undo.onclick = () => {
    if (!removed) return;

    tasks.splice(removed.index, 0, removed.task);
    removed = null;
    undo.disabled = true;

    persist();
    render();
  };

  render();
});

// FEATURE 2: SEARCHABLE LAUNCHER
const launcher = document.querySelector("#launcher");
const search = document.querySelector("#search");
const searchResults = document.querySelector("#searchResults");

function renderSearch() {
  const query = search.value.trim().toLowerCase();
  searchResults.replaceChildren();

  for (const [id, app] of OS.apps) {
    if (!`${id} ${app.title}`.toLowerCase().includes(query)) continue;

    const button = document.createElement("button");
    button.textContent = `${app.icon} ${app.title}`;

    button.onclick = () => {
      launcher.close();
      OS.open(id);
    };

    searchResults.append(button);
  }

  if (!searchResults.children.length) {
    const empty = document.createElement("p");
    empty.textContent = "No matching apps.";
    searchResults.append(empty);
  }
}

function showLauncher() {
  if (launcher.open) return;

  search.value = "";
  renderSearch();
  launcher.showModal();
  search.focus();
}

search.oninput = renderSearch;

search.onkeydown = event => {
  if (event.key === "Enter") {
    event.preventDefault();
    searchResults.querySelector("button")?.click();
  }
};

document.querySelector("#searchButton").onclick = showLauncher;
document.querySelector("#home").onclick = showLauncher;

document.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === "k") {
    event.preventDefault();
    showLauncher();
  }
});

// FEATURE 3: WALLPAPER EDITOR
const defaultTheme = {
  sky: "#10252a",
  glow: "#365a4b",
  accent: "#c4f28b",
  message: "Make space for your ideas."
};

function validTheme(candidate) {
  return candidate &&
    ["sky", "glow", "accent"].every(key =>
      /^#[0-9a-f]{6}$/i.test(candidate[key])
    ) &&
    typeof candidate.message === "string" &&
    candidate.message.length <= 80;
}

function applyTheme(theme) {
  ["sky", "glow", "accent"].forEach(key => {
    document.documentElement.style.setProperty(`--${key}`, theme[key]);
  });

  document.querySelector("#headline").textContent = theme.message;
}

OS.register("wallpaper", "Wallpaper studio", "◈", container => {
  const saved = OS.read("theme", defaultTheme);
  let theme = validTheme(saved) ? { ...saved } : { ...defaultTheme };

  container.innerHTML = `
    <h2>Wallpaper studio</h2>
    <form class="stack">
      <label>
        Desktop message
        <input name="message" maxlength="80" required>
      </label>

      <div class="row">
        <label>Sky <input name="sky" type="color"></label>
        <label>Glow <input name="glow" type="color"></label>
        <label>Accent <input name="accent" type="color"></label>
      </div>

      <div class="row">
        <button class="primary">Save wallpaper</button>
        <button type="button" class="reset">Reset preview</button>
      </div>

      <small>Changes preview immediately. Save to keep them.</small>
    </form>
  `;

  const form = container.querySelector("form");

  function fill() {
    Object.keys(defaultTheme).forEach(key => {
      form.elements[key].value = theme[key];
    });
  }

  function collect() {
    return {
      sky: form.elements.sky.value,
      glow: form.elements.glow.value,
      accent: form.elements.accent.value,
      message: form.elements.message.value.trim() ||
        defaultTheme.message
    };
  }

  form.oninput = () => applyTheme(collect());

  form.onsubmit = event => {
    event.preventDefault();
    theme = collect();

    if (OS.save("theme", theme)) {
      OS.notify("Wallpaper saved.");
    }
  };

  container.querySelector(".reset").onclick = () => {
    theme = { ...defaultTheme };
    fill();
    applyTheme(theme);
  };

  fill();
});

const savedTheme = OS.read("theme", defaultTheme);
applyTheme(validTheme(savedTheme) ? savedTheme : defaultTheme);

OS.open("tasks");