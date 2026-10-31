"use strict";

document.querySelector("#version").textContent = "V4";

// Styles for the browser and arcade.
const v4Styles = document.createElement("style");

v4Styles.textContent = `
  .v4-browser {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .v4-browser-toolbar {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .v4-address-form {
    display: flex;
    flex: 1;
    gap: 6px;
    min-width: 180px;
  }

  .v4-address-form input {
    flex: 1;
    width: 100%;
    min-width: 0;
  }

  .v4-bookmarks {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    max-height: 90px;
    overflow: auto;
  }

  .v4-bookmark {
    display: inline-flex;
    gap: 2px;
  }

  .v4-bookmark button {
    padding: 5px 8px;
    font-size: 11px;
  }

  .v4-browser-note {
    margin: 0;
    font-size: 11px;
  }

  .v4-browser iframe {
    flex: 1;
    width: 100%;
    min-height: 220px;
    background: white;
    border: 1px solid var(--border);
    border-radius: 10px;
  }

  .v4-game-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
  }

  .v4-game-tabs button.active {
    background: var(--accent);
    color: #193224;
  }

  .v4-game-toolbar {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
    margin-bottom: 12px;
  }

  .v4-score {
    margin-left: auto;
    color: var(--accent);
    font-variant-numeric: tabular-nums;
  }

  .v4-game-canvas {
    background: #091c24;
    border: 1px solid var(--border);
    cursor: default;
  }

  .v4-game-help {
    margin: 10px 0;
    font-size: 12px;
  }

  .v4-game-status {
    min-height: 24px;
    color: var(--accent);
  }

  .v4-direction-pad {
    display: grid;
    grid-template-columns: repeat(3, 48px);
    justify-content: center;
    gap: 5px;
    margin-top: 12px;
  }

  .v4-direction-pad button {
    touch-action: manipulation;
  }

  .v4-reaction-pad {
    width: 100%;
    min-height: 210px;
    margin: 12px 0;
    font-size: 22px;
    white-space: pre-line;
    background: #28394e;
    touch-action: manipulation;
  }

  .v4-reaction-pad.waiting {
    background: #704334;
  }

  .v4-reaction-pad.ready {
    background: #b6ed83;
    color: #183525;
  }

  @media (max-width: 600px) {
    .v4-address-form {
      flex-basis: 100%;
    }

    .v4-score {
      margin-left: 0;
      width: 100%;
    }
  }
`;

document.head.append(v4Styles);


// APP 1: BROWSER

OS.register("browser", "Orbit Browser", "◎", (container, windowElement) => {
  windowElement.style.width = "900px";
  windowElement.style.height = "600px";
  container.style.padding = "12px";

  container.innerHTML = `
    <div class="v4-browser">
      <div class="v4-browser-toolbar">
        <button class="back" aria-label="Back">←</button>
        <button class="forward" aria-label="Forward">→</button>
        <button class="reload" aria-label="Reload page">↻</button>

        <form class="v4-address-form">
          <input
            class="address"
            aria-label="Website address"
            placeholder="https://example.com"
            autocomplete="off"
            spellcheck="false"
          >
          <button class="primary">Go</button>
        </form>
      </div>

      <div class="row">
        <button class="bookmark">☆ Bookmark</button>
        <button class="external">Open in new tab ↗</button>
      </div>

      <div class="v4-bookmarks"></div>

      <p class="v4-browser-note">
        Some websites block embedded views or require cookies this
        sandbox does not provide. Use “Open in new tab” if needed.
        Navigation controls track addresses entered here, not links
        followed inside another website.
      </p>

      <small class="browser-status" role="status"></small>

      <iframe
        title="Embedded website"
        sandbox="allow-scripts allow-forms"
        referrerpolicy="no-referrer"
      ></iframe>
    </div>
  `;

  const frame = container.querySelector("iframe");
  const address = container.querySelector(".address");
  const back = container.querySelector(".back");
  const forward = container.querySelector(".forward");
  const status = container.querySelector(".browser-status");
  const bookmarkBar = container.querySelector(".v4-bookmarks");

  const history = [];
  let historyIndex = -1;

  function parseAddress(value) {
    let text = value.trim();

    if (!text) {
      throw new Error("Enter a website address.");
    }

    // Reject explicit schemes other than HTTP and HTTPS.
    if (/^[a-z][a-z0-9+.-]*:/i.test(text) &&
        !/^https?:\/\//i.test(text)) {
      throw new Error("Only HTTP and HTTPS addresses are supported.");
    }

    if (!/^https?:\/\//i.test(text)) {
      text = "https://" + text;
    }

    const url = new URL(text);

    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Only HTTP and HTTPS addresses are supported.");
    }

    if (url.username || url.password) {
      throw new Error("Use an address without embedded credentials.");
    }

    return url.href;
  }

  const storedBookmarks = OS.read("browserBookmarks", []);
  let bookmarks = [];

  if (Array.isArray(storedBookmarks)) {
    for (const item of storedBookmarks.slice(0, 30)) {
      try {
        if (typeof item === "string") {
          bookmarks.push(parseAddress(item));
        }
      } catch {
        // Ignore invalid stored bookmarks.
      }
    }
  }

  bookmarks = [...new Set(bookmarks)];

  function currentAddress() {
    return history[historyIndex] || "";
  }

  function updateControls() {
    back.disabled = historyIndex <= 0;
    forward.disabled = historyIndex >= history.length - 1;
  }

  function displayAddress(url) {
    address.value = url;
    frame.src = url;

    status.textContent =
      "Requested " + new URL(url).hostname +
      ". If the view stays blank, open it in a new tab.";

    updateControls();
  }

  function navigate(value) {
    try {
      const url = parseAddress(value);

      history.splice(historyIndex + 1);
      history.push(url);
      historyIndex = history.length - 1;

      displayAddress(url);
    } catch (error) {
      status.textContent = error.message;
    }
  }

  function renderBookmarks() {
    bookmarkBar.replaceChildren();

    bookmarks.forEach((url, index) => {
      const group = document.createElement("span");
      group.className = "v4-bookmark";

      const open = document.createElement("button");
      open.textContent = new URL(url).hostname;
      open.title = url;
      open.onclick = () => navigate(url);

      const remove = document.createElement("button");
      remove.textContent = "×";
      remove.setAttribute("aria-label", "Remove bookmark " + url);

      remove.onclick = () => {
        bookmarks.splice(index, 1);
        OS.save("browserBookmarks", bookmarks);
        renderBookmarks();
      };

      group.append(open, remove);
      bookmarkBar.append(group);
    });
  }

  container.querySelector("form").onsubmit = event => {
    event.preventDefault();
    navigate(address.value);
  };

  back.onclick = () => {
    if (historyIndex <= 0) return;
    historyIndex--;
    displayAddress(currentAddress());
  };

  forward.onclick = () => {
    if (historyIndex >= history.length - 1) return;
    historyIndex++;
    displayAddress(currentAddress());
  };

  container.querySelector(".reload").onclick = () => {
    if (currentAddress()) displayAddress(currentAddress());
  };

  container.querySelector(".external").onclick = () => {
    try {
      const url = parseAddress(address.value);

      window.open(
        url,
        "_blank",
        "noopener,noreferrer"
      );
    } catch (error) {
      status.textContent = error.message;
    }
  };

  container.querySelector(".bookmark").onclick = () => {
    try {
      const url = parseAddress(address.value);

      if (bookmarks.includes(url)) {
        OS.notify("Already bookmarked.");
        return;
      }

      if (bookmarks.length >= 30) {
        OS.notify("Remove a bookmark before adding another.");
        return;
      }

      bookmarks.push(url);
      OS.save("browserBookmarks", bookmarks);
      renderBookmarks();
    } catch (error) {
      status.textContent = error.message;
    }
  };

  renderBookmarks();
  navigate("https://example.com");
});


// APP 2: GAME ARCADE

OS.register("arcade", "Game Arcade", "🎮", (container, windowElement) => {
  windowElement.style.width = "650px";
  windowElement.style.height = "650px";

  container.innerHTML = `
    <h2>Orbit Arcade</h2>

    <div class="v4-game-tabs" aria-label="Choose a game">
      <button data-game="snake">Snake</button>
      <button data-game="pong">Pong</button>
      <button data-game="reaction">Reaction</button>
    </div>

    <div class="v4-game-area"></div>
  `;

  const area = container.querySelector(".v4-game-area");
  const tabs = [...container.querySelectorAll("[data-game]")];

  let cleanupGame = () => {};

  function chooseGame(name) {
    cleanupGame();

    tabs.forEach(button => {
      const active = button.dataset.game === name;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    area.replaceChildren();

    if (name === "snake") {
      cleanupGame = createSnake(area, windowElement);
    } else if (name === "pong") {
      cleanupGame = createPong(area, windowElement);
    } else {
      cleanupGame = createReaction(area, windowElement);
    }
  }

  tabs.forEach(button => {
    button.onclick = () => chooseGame(button.dataset.game);
  });

  chooseGame("snake");

  // OS.open() invokes this when the arcade window closes.
  return () => cleanupGame();
});

// ------------------------------------------------------------
// GAME 1: SNAKE
// ------------------------------------------------------------

function createSnake(area, windowElement) {
  area.innerHTML = `
    <div class="v4-game-toolbar">
      <button class="start primary">Start / Restart</button>
      <button class="pause">Pause</button>
      <span class="v4-score"></span>
    </div>

    <canvas
      class="v4-game-canvas"
      width="400"
      height="400"
      tabindex="0"
      aria-label="Snake game. Use arrow keys or WASD."
    ></canvas>

    <p class="v4-game-status" role="status">Press Start to play.</p>

    <div class="v4-direction-pad">
      <span></span>
      <button data-direction="up" aria-label="Move up">↑</button>
      <span></span>
      <button data-direction="left" aria-label="Move left">←</button>
      <button data-direction="down" aria-label="Move down">↓</button>
      <button data-direction="right" aria-label="Move right">→</button>
    </div>

    <p class="v4-game-help">
      Click the board, then use arrow keys or WASD.
      Space pauses. Eat the green squares; avoid walls and yourself.
    </p>
  `;

  const canvas = area.querySelector("canvas");
  const context = canvas.getContext("2d");
  const scoreLabel = area.querySelector(".v4-score");
  const status = area.querySelector(".v4-game-status");
  const pauseButton = area.querySelector(".pause");

  const cells = 20;
  const cellSize = canvas.width / cells;

  const directions = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };

  let snake = [];
  let food = { x: 14, y: 10 };
  let direction = directions.right;
  let nextDirection = direction;
  let directionQueued = false;
  let score = 0;

  const storedBest = OS.read("snakeBest", 0);
  let best = Number.isFinite(storedBest) ? storedBest : 0;

  let running = false;
  let paused = false;

  function updateScore() {
    scoreLabel.textContent = `Score ${score} · Best ${best}`;
  }

  function placeFood() {
    const available = [];

    for (let y = 0; y < cells; y++) {
      for (let x = 0; x < cells; x++) {
        if (!snake.some(part => part.x === x && part.y === y)) {
          available.push({ x, y });
        }
      }
    }

    if (!available.length) return false;

    food = available[Math.floor(Math.random() * available.length)];
    return true;
  }

  function draw() {
    context.fillStyle = "#091c24";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.strokeStyle = "#ffffff06";

    for (let i = 0; i <= cells; i++) {
      context.beginPath();
      context.moveTo(i * cellSize, 0);
      context.lineTo(i * cellSize, canvas.height);
      context.stroke();

      context.beginPath();
      context.moveTo(0, i * cellSize);
      context.lineTo(canvas.width, i * cellSize);
      context.stroke();
    }

    context.fillStyle = "#c4f28b";
    context.fillRect(
      food.x * cellSize + 3,
      food.y * cellSize + 3,
      cellSize - 6,
      cellSize - 6
    );

    snake.forEach((part, index) => {
      context.fillStyle = index === 0 ? "#f0f9df" : "#68bba3";

      context.fillRect(
        part.x * cellSize + 1,
        part.y * cellSize + 1,
        cellSize - 2,
        cellSize - 2
      );
    });
  }

  function stop(message) {
    running = false;
    status.textContent = message;
    pauseButton.textContent = "Pause";
  }

  function start() {
    snake = [
      { x: 8, y: 10 },
      { x: 7, y: 10 },
      { x: 6, y: 10 }
    ];

    direction = directions.right;
    nextDirection = direction;
    directionQueued = false;
    score = 0;
    running = true;
    paused = false;

    pauseButton.textContent = "Pause";
    status.textContent = "Go!";
    placeFood();
    updateScore();
    draw();
    canvas.focus();
  }

  function steer(name) {
    if (!running || paused || directionQueued) return;

    const next = directions[name];
    if (!next) return;

    if (
      next.x === -direction.x &&
      next.y === -direction.y
    ) {
      return;
    }

    nextDirection = next;
    directionQueued = true;
  }

  function togglePause() {
    if (!running) return;

    paused = !paused;
    pauseButton.textContent = paused ? "Resume" : "Pause";
    status.textContent = paused ? "Paused." : "Go!";
  }

  canvas.onkeydown = event => {
    const keyMap = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      w: "up",
      s: "down",
      a: "left",
      d: "right"
    };

    const key = event.key.length === 1
      ? event.key.toLowerCase()
      : event.key;

    if (keyMap[key]) {
      event.preventDefault();
      steer(keyMap[key]);
    } else if (event.code === "Space") {
      event.preventDefault();
      togglePause();
    }
  };

  area.querySelectorAll("[data-direction]").forEach(button => {
    button.onclick = () => {
      steer(button.dataset.direction);
      canvas.focus();
    };
  });

  area.querySelector(".start").onclick = start;
  pauseButton.onclick = () => {
    togglePause();
    canvas.focus();
  };

  function pauseWhenHidden() {
    if (running && !paused &&
        (document.hidden || windowElement.hidden)) {
      paused = true;
      pauseButton.textContent = "Resume";
      status.textContent = "Paused while the game was hidden.";
    }
  }

  document.addEventListener("visibilitychange", pauseWhenHidden);

  const timer = setInterval(() => {
    pauseWhenHidden();
    if (!running || paused) return;

    direction = nextDirection;
    directionQueued = false;

    const head = {
      x: snake[0].x + direction.x,
      y: snake[0].y + direction.y
    };

    const eats = head.x === food.x && head.y === food.y;

    // Moving into the departing tail is legal when not eating.
    const collisionBody = eats ? snake : snake.slice(0, -1);

    const collided =
      head.x < 0 ||
      head.y < 0 ||
      head.x >= cells ||
      head.y >= cells ||
      collisionBody.some(part =>
        part.x === head.x && part.y === head.y
      );

    if (collided) {
      stop("Game over. Press Start to try again.");
      return;
    }

    snake.unshift(head);

    if (eats) {
      score++;

      if (score > best) {
        best = score;
        OS.save("snakeBest", best);
      }

      if (!placeFood()) {
        stop("You filled the board. You win!");
      }
    } else {
      snake.pop();
    }

    updateScore();
    draw();
  }, 130);

  updateScore();
  draw();

  return () => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", pauseWhenHidden);
  };
}

// ------------------------------------------------------------
// GAME 2: PONG
// ------------------------------------------------------------

function createPong(area, windowElement) {
  area.innerHTML = `
    <div class="v4-game-toolbar">
      <button class="start primary">Start / Restart</button>
      <button class="pause">Pause</button>
      <span class="v4-score"></span>
    </div>

    <canvas
      class="v4-game-canvas"
      width="640"
      height="360"
      tabindex="0"
      aria-label="Pong game. Move your pointer or use W and S."
    ></canvas>

    <p class="v4-game-status" role="status">First to 5 wins.</p>

    <p class="v4-game-help">
      Move your mouse or drag your finger on the court.
      Keyboard: W/S or ↑/↓. Space pauses.
    </p>
  `;

  const canvas = area.querySelector("canvas");
  const context = canvas.getContext("2d");
  const scoreLabel = area.querySelector(".v4-score");
  const status = area.querySelector(".v4-game-status");
  const pauseButton = area.querySelector(".pause");

  const width = canvas.width;
  const height = canvas.height;
  const paddleHeight = 76;
  const paddleWidth = 12;
  const radius = 7;

  let playerY = (height - paddleHeight) / 2;
  let computerY = playerY;

  let playerScore = 0;
  let computerScore = 0;

  const storedWins = OS.read("pongWins", 0);
  let wins = Number.isFinite(storedWins) ? storedWins : 0;

  let ball = { x: width / 2, y: height / 2, vx: 260, vy: 100 };
  let running = false;
  let paused = false;
  let lastTime = 0;
  let animation;

  const keys = new Set();

  function clampPaddle(y) {
    return Math.max(0, Math.min(height - paddleHeight, y));
  }

  function updateScore() {
    scoreLabel.textContent =
      `You ${playerScore} : ${computerScore} CPU · Wins ${wins}`;
  }

  function serve(direction) {
    ball = {
      x: width / 2,
      y: height / 2,
      vx: direction * 260,
      vy: (Math.random() - 0.5) * 220
    };
  }

  function start() {
    playerScore = 0;
    computerScore = 0;
    playerY = (height - paddleHeight) / 2;
    computerY = playerY;
    running = true;
    paused = false;
    keys.clear();

    pauseButton.textContent = "Pause";
    status.textContent = "First to 5 wins.";
    serve(Math.random() < 0.5 ? -1 : 1);
    updateScore();
    canvas.focus();
  }

  function togglePause() {
    if (!running) return;

    paused = !paused;
    keys.clear();
    pauseButton.textContent = paused ? "Resume" : "Pause";
    status.textContent = paused ? "Paused." : "First to 5 wins.";
  }

  function movePointer(event) {
    const bounds = canvas.getBoundingClientRect();
    const y = (event.clientY - bounds.top) * height / bounds.height;

    playerY = clampPaddle(y - paddleHeight / 2);
  }

  canvas.onpointerdown = event => {
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    canvas.focus();
    movePointer(event);
  };

  canvas.onpointermove = movePointer;

  canvas.onkeydown = event => {
    const key = event.key.toLowerCase();

    if (["w", "s", "arrowup", "arrowdown"].includes(key)) {
      event.preventDefault();
      keys.add(key);
    } else if (event.code === "Space") {
      event.preventDefault();
      if (!event.repeat) togglePause();
    }
  };

  canvas.onkeyup = event => {
    keys.delete(event.key.toLowerCase());
  };

  canvas.onblur = () => keys.clear();

  area.querySelector(".start").onclick = start;

  pauseButton.onclick = () => {
    togglePause();
    canvas.focus();
  };

  function bounce(paddleY, direction) {
    const impact =
      (ball.y - (paddleY + paddleHeight / 2)) /
      (paddleHeight / 2);

    const angle = Math.max(-1, Math.min(1, impact)) * Math.PI / 3;
    const speed = Math.min(540, Math.hypot(ball.vx, ball.vy) + 20);

    ball.vx = direction * speed * Math.cos(angle);
    ball.vy = speed * Math.sin(angle);
  }

  function awardPoint(playerWonPoint) {
    if (playerWonPoint) playerScore++;
    else computerScore++;

    updateScore();

    if (playerScore >= 5 || computerScore >= 5) {
      running = false;

      if (playerScore >= 5) {
        wins++;
        OS.save("pongWins", wins);
        status.textContent = "You win! Play again?";
      } else {
        status.textContent = "CPU wins. Try again!";
      }

      updateScore();
      return;
    }

    serve(playerWonPoint ? -1 : 1);
  }

  function update(dt) {
    if (keys.has("w") || keys.has("arrowup")) {
      playerY -= 350 * dt;
    }

    if (keys.has("s") || keys.has("arrowdown")) {
      playerY += 350 * dt;
    }

    playerY = clampPaddle(playerY);

    const target = ball.y - paddleHeight / 2;
    const change = Math.max(
      -205 * dt,
      Math.min(205 * dt, target - computerY)
    );

    computerY = clampPaddle(computerY + change);

    const oldX = ball.x;

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.y < radius) {
      ball.y = radius;
      ball.vy = Math.abs(ball.vy);
    } else if (ball.y > height - radius) {
      ball.y = height - radius;
      ball.vy = -Math.abs(ball.vy);
    }

    const playerFace = 20 + paddleWidth;
    const computerFace = width - 20 - paddleWidth;

    if (
      ball.vx < 0 &&
      oldX - radius >= playerFace &&
      ball.x - radius <= playerFace &&
      ball.y + radius >= playerY &&
      ball.y - radius <= playerY + paddleHeight
    ) {
      ball.x = playerFace + radius;
      bounce(playerY, 1);
    }

    if (
      ball.vx > 0 &&
      oldX + radius <= computerFace &&
      ball.x + radius >= computerFace &&
      ball.y + radius >= computerY &&
      ball.y - radius <= computerY + paddleHeight
    ) {
      ball.x = computerFace - radius;
      bounce(computerY, -1);
    }

    if (ball.x < -radius) awardPoint(false);
    else if (ball.x > width + radius) awardPoint(true);
  }

  function draw() {
    context.fillStyle = "#091c24";
    context.fillRect(0, 0, width, height);

    context.strokeStyle = "#ffffff30";
    context.setLineDash([8, 12]);
    context.beginPath();
    context.moveTo(width / 2, 0);
    context.lineTo(width / 2, height);
    context.stroke();
    context.setLineDash([]);

    context.fillStyle = "#c4f28b";
    context.fillRect(20, playerY, paddleWidth, paddleHeight);

    context.fillStyle = "#b9c3ff";
    context.fillRect(
      width - 20 - paddleWidth,
      computerY,
      paddleWidth,
      paddleHeight
    );

    context.fillStyle = "#ffffff";
    context.beginPath();
    context.arc(ball.x, ball.y, radius, 0, Math.PI * 2);
    context.fill();
  }

  function pauseWhenHidden() {
    if (running && !paused &&
        (document.hidden || windowElement.hidden)) {
      paused = true;
      keys.clear();
      pauseButton.textContent = "Resume";
      status.textContent = "Paused while the game was hidden.";
    }
  }

  document.addEventListener("visibilitychange", pauseWhenHidden);

  function frame(time) {
    const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.03) : 0;
    lastTime = time;

    pauseWhenHidden();

    if (running && !paused) update(dt);

    draw();
    animation = requestAnimationFrame(frame);
  }

  updateScore();
  animation = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(animation);
    keys.clear();
    document.removeEventListener("visibilitychange", pauseWhenHidden);
  };
}

// ------------------------------------------------------------
// GAME 3: REACTION TEST
// ------------------------------------------------------------

function createReaction(area, windowElement) {
  area.innerHTML = `
    <h3>How fast are you?</h3>

    <p>
      Start a round. Wait for green, then click or tap.
      Keyboard users can press Space or Enter.
    </p>

    <button class="v4-reaction-pad">
      Start a round
    </button>

    <p class="v4-game-status" role="status"></p>
    <p class="v4-reaction-stats"></p>

    <small>
      Results include browser and input-device latency.
      This is a game, not a scientific measurement.
    </small>
  `;

  const pad = area.querySelector(".v4-reaction-pad");
  const status = area.querySelector(".v4-game-status");
  const stats = area.querySelector(".v4-reaction-stats");

  const storedBest = OS.read("reactionBest", null);
  let best = Number.isFinite(storedBest) && storedBest > 0
    ? storedBest
    : null;

  const rounds = [];
  let state = "idle";
  let readyAt = 0;
  let timeout;
  let paintFrame1;
  let paintFrame2;

  function updateStats() {
    const average = rounds.length
      ? Math.round(rounds.reduce((sum, value) => sum + value, 0) /
          rounds.length)
      : null;

    stats.textContent =
      `Best: ${best === null ? "—" : best + " ms"}` +
      ` · Session average: ${average === null ? "—" : average + " ms"}` +
      ` · Rounds: ${rounds.length}`;
  }

  function cancelPending() {
    clearTimeout(timeout);
    cancelAnimationFrame(paintFrame1);
    cancelAnimationFrame(paintFrame2);
  }

  function reset(message) {
    cancelPending();
    state = "idle";
    pad.className = "v4-reaction-pad";
    pad.textContent = "Start another round";
    status.textContent = message;
  }

  function begin() {
    cancelPending();
    state = "waiting";
    pad.className = "v4-reaction-pad waiting";
    pad.textContent = "Wait for green…";
    status.textContent = "";

    timeout = setTimeout(() => {
      if (document.hidden || windowElement.hidden) {
        reset("Round cancelled while hidden.");
        return;
      }

      // Align the color change with rendering.
      paintFrame1 = requestAnimationFrame(() => {
        pad.className = "v4-reaction-pad ready";
        pad.textContent = "NOW!";

        paintFrame2 = requestAnimationFrame(() => {
          readyAt = performance.now();
          state = "ready";
        });
      });
    }, 1500 + Math.random() * 3500);
  }

  function activate() {
    if (state === "idle") {
      begin();
      return;
    }

    if (state === "waiting") {
      reset("Too early! Wait until the button turns green.");
      return;
    }

    const elapsed = Math.max(
      1,
      Math.round(performance.now() - readyAt)
    );

    rounds.push(elapsed);

    if (best === null || elapsed < best) {
      best = elapsed;
      OS.save("reactionBest", best);
    }

    reset(`Your reaction: ${elapsed} ms`);
    updateStats();
  }

  // pointerdown avoids adding the delay until pointer release.
  pad.onpointerdown = event => {
    if (event.button !== 0) return;
    event.preventDefault();
    pad.focus();
    activate();
  };

  pad.onkeydown = event => {
    if (event.code === "Space" || event.key === "Enter") {
      event.preventDefault();
      if (!event.repeat) activate();
    }
  };

  // Support clicks generated by assistive technologies.
  pad.onclick = event => {
    if (event.detail === 0 && state === "idle") {
      // Native keyboard activation is suppressed above.
      activate();
    }
  };

  function checkVisibility() {
    if (state !== "idle" &&
        (document.hidden || windowElement.hidden)) {
      reset("Round cancelled while hidden.");
    }
  }

  document.addEventListener("visibilitychange", checkVisibility);
  const visibilityTimer = setInterval(checkVisibility, 200);

  updateStats();

  return () => {
    cancelPending();
    clearInterval(visibilityTimer);
    document.removeEventListener("visibilitychange", checkVisibility);
  };
}
