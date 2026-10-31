# WebOS 1 — Orbit Desk V4

A browser-based desktop built with HTML, CSS, and JavaScript for the Hack Club Stardance WebOS 1 project.

## Run

Download or clone this repository and open `index.html` in a modern browser. No build step, dependencies, account, or password is required. You can also serve the folder using VS Code Live Server.

## Features

- Draggable, resizable windows with minimize, maximize, and close controls.
- Application launcher (Ctrl/Cmd+K), task board, and wallpaper customization.
- Local text files, calculator, and focus timer.
- Drawing studio with PNG export, JSON backup/restore, and workspace layouts.
- Embedded browser with address navigation and bookmarks.
- Arcade with Snake, Pong, and a reaction-time game.

## Files

- `index.html`: page structure and scripts loaded in version order.
- `style.css`: desktop and application styles.
- `app.js`: desktop, task board, launcher, and wallpaper.
- `v2.js`: text files, calculator, and focus timer.
- `v3.js`: drawing, backup/restore, and workspace layout.
- `v4.js`: browser and arcade.
- `.wakatime-project`: project name used for editor time tracking.

## Storage and limitations

Supported app data is saved in this browser's local storage; it is not synced between devices. Clearing browser data may erase it. Backup exports cover tasks, text files, and theme, not every app's state.

The embedded browser uses an iframe. Websites can block embedding or restrict features; use its Open in new tab option when necessary. This is a web desktop simulation, not a standalone operating system or Chromium browser engine.

## AI assistance

ChatGPT assisted with code generation and project setup. Any development logs and time claims should describe the actual work performed and tested by the author.
