const COLS = 10;
const ROWS = 20;
const PRACTICE_SEQUENCE = "aonull";
const BEST_SCORE_KEY = "tetris-mini-best-score";
const ONLINE_ROOM_KEY = "tetris-room-sync";

const SCORE_TABLE = {
  1: 100,
  2: 300,
  3: 500,
  4: 800
};

const RANK_TABLE = [
  { score: 10000, label: "SSS" },
  { score: 7500, label: "SS" },
  { score: 5000, label: "S" },
  { score: 2500, label: "A" },
  { score: 1500, label: "B" },
  { score: 1000, label: "C" },
  { score: 0, label: "D" }
];

const PIECE_WEIGHTS = {
  I: 2,
  O: 1.5,
  T: 1,
  S: 1,
  Z: 1,
  J: 1,
  L: 1
};

const PRACTICE_WEIGHTS = {
  I: 2,
  O: 1.5
};

const COLORS = {
  I: "#5ad7ff",
  O: "#ffd84d",
  T: "#b25cff",
  S: "#57d15a",
  Z: "#ff5964",
  J: "#3e67ff",
  L: "#ff9b3d"
};

const SHAPES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ],
  O: [
    [1, 1],
    [1, 1]
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0]
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0]
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0]
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0]
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0]
  ]
};

const CPU_LEVELS = {
  lv1: {
    label: "Lv1",
    thinkMin: 400,
    thinkMax: 400,
    mistakeMin: 0.1,
    mistakeMax: 0.15,
    actionMs: 210,
    delayMs: 150
  },
  lv2: {
    label: "Lv2",
    thinkMin: 200,
    thinkMax: 200,
    mistakeMin: 0.03,
    mistakeMax: 0.05,
    actionMs: 120,
    delayMs: 90
  },
  lv3: {
    label: "Lv3",
    thinkMin: 50,
    thinkMax: 100,
    mistakeMin: 0,
    mistakeMax: 0.01,
    actionMs: 55,
    delayMs: 60
  }
};

const boardCanvas = document.getElementById("boardCanvas");
const boardContext = boardCanvas.getContext("2d");
const nextCanvas = document.getElementById("nextCanvas");
const nextContext = nextCanvas.getContext("2d");
const opponentCanvas = document.getElementById("opponentCanvas");
const opponentContext = opponentCanvas.getContext("2d");

const elements = {
  body: document.body,
  scoreValue: document.getElementById("scoreValue"),
  bestScoreValue: document.getElementById("bestScoreValue"),
  statusValue: document.getElementById("statusValue"),
  controlSection: document.getElementById("controlSection"),
  modeForm: document.getElementById("modeForm"),
  speedForm: document.getElementById("speedForm"),
  cpuOptions: document.getElementById("cpuOptions"),
  cpuLevelSelect: document.getElementById("cpuLevelSelect"),
  onlineOptions: document.getElementById("onlineOptions"),
  roomInput: document.getElementById("roomInput"),
  logoButton: document.getElementById("logoButton"),
  startButton: document.getElementById("startButton"),
  restartButton: document.getElementById("restartButton"),
  startOverlay: document.getElementById("startOverlay"),
  startHint: document.getElementById("startHint"),
  gameOverOverlay: document.getElementById("gameOverOverlay"),
  finalScore: document.getElementById("finalScore"),
  finalRank: document.getElementById("finalRank"),
  playLayout: document.getElementById("playLayout"),
  boardSection: document.getElementById("boardSection"),
  boardFrame: document.getElementById("boardFrame"),
  nextFrame: document.getElementById("nextFrame"),
  opponentPanel: document.getElementById("opponentPanel"),
  opponentHeading: document.getElementById("opponentHeading"),
  opponentFrame: document.getElementById("opponentFrame"),
  opponentName: document.getElementById("opponentName"),
  opponentScore: document.getElementById("opponentScore"),
  battleStatus: document.getElementById("battleStatus")
};

const app = {
  stage: "idle",
  mode: "solo",
  speedMode: "fixed",
  cpuLevel: "lv2",
  practiceMode: false,
  secretArmed: false,
  secretBuffer: "",
  bestScore: loadBestScore(),
  layout: {
    boardCellSize: 28,
    nextCellSize: 24,
    opponentCellSize: 18
  },
  local: createEngine("local"),
  cpu: createEngine("cpu"),
  remote: createRemoteView(),
  online: createOnlineState()
};

init();

function init() {
  bindEvents();
  applyModeUi();
  resetToInitialState();
  updateBestScoreDisplay();
  requestAnimationFrame(mainLoop);
}

function bindEvents() {
  elements.startButton.addEventListener("click", handleStartButton);
  elements.restartButton.addEventListener("click", resetToInitialState);

  elements.modeForm.addEventListener("change", () => {
    app.mode = getSelectedMode();
    applyModeUi();
    resetToInitialState();
  });

  elements.speedForm.addEventListener("change", () => {
    app.speedMode = getSelectedSpeedMode();
  });

  elements.cpuLevelSelect.addEventListener("change", () => {
    app.cpuLevel = elements.cpuLevelSelect.value;
    updateStatusPanel();
    updateOpponentPanelText();
  });

  elements.roomInput.addEventListener("input", () => {
    app.online.roomName = normalizeRoomName(elements.roomInput.value);
    if (app.stage === "idle" && app.online.transport && app.online.roomName !== app.online.connectedRoom) {
      teardownOnlineTransport(true);
    }
    updateStatusPanel();
    updateOpponentPanelText();
    updateStartHint();
  });

  elements.logoButton.addEventListener("dblclick", handleLogoDoubleClick);

  window.addEventListener("keydown", handleKeydown, { passive: false });
  window.addEventListener("keyup", handleKeyup);
  window.addEventListener("resize", resizeCanvases);
  window.addEventListener("beforeunload", () => {
    announceOnlineLeave();
    teardownOnlineTransport(false);
  });

  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(() => {
      resizeCanvases();
      renderAll();
    });

    observer.observe(elements.boardSection);
    observer.observe(elements.nextFrame);
    observer.observe(elements.opponentFrame);
  }
}

function mainLoop(timestamp) {
  if (app.stage === "waiting" && app.online.startAtUnix && Date.now() >= app.online.startAtUnix) {
    launchOnlineMatch(timestamp);
  }

  updateEngine(app.local, timestamp, true);

  if (app.mode === "cpu") {
    updateCpuEngine(app.cpu, timestamp);
  }

  if (app.mode === "online" && app.stage === "running") {
    maybeSendOnlineSnapshot(timestamp);
  }

  renderAll();
  requestAnimationFrame(mainLoop);
}

function handleStartButton() {
  if (app.stage !== "idle") {
    return;
  }

  app.speedMode = getSelectedSpeedMode();

  if (app.mode === "solo") {
    prepareMatch();
    app.stage = "running";
    startEngine(app.local, performance.now());
    syncUi();
    return;
  }

  if (app.mode === "cpu") {
    prepareMatch();
    app.stage = "running";
    const now = performance.now();
    startEngine(app.local, now);
    startEngine(app.cpu, now);
    syncUi();
    return;
  }

  const roomName = normalizeRoomName(elements.roomInput.value);
  app.online.roomName = roomName;
  elements.roomInput.value = roomName;

  if (!roomName) {
    updateStartHint("部屋名");
    return;
  }

  ensureOnlineTransport(roomName);
  prepareMatch();
  app.stage = "waiting";
  app.online.selfReady = true;
  app.online.waiting = true;
  updateStartHint();
  updateOpponentPanelText();
  syncUi();
  sendOnlineMessage({
    type: "presence",
    ready: true
  });
  maybeScheduleOnlineStart();
}

function launchOnlineMatch(timestamp) {
  if (app.mode !== "online" || app.stage !== "waiting") {
    return;
  }

  prepareMatch();
  app.stage = "running";
  app.online.waiting = false;
  startEngine(app.local, timestamp);
  updateStartHint("");
  syncUi();
  maybeSendOnlineSnapshot(timestamp, true);
}

function prepareMatch() {
  resetEngine(app.local);
  setupOpeningPieces(app.local, true);

  resetEngine(app.cpu);
  if (app.mode === "cpu") {
    setupOpeningPieces(app.cpu, false);
  }

  if (app.mode !== "online") {
    app.remote = createRemoteView();
  }

  updateScoreDisplay();
  updateOpponentPanelText();
}

function resetToInitialState() {
  app.stage = "idle";
  app.speedMode = getSelectedSpeedMode();
  app.cpuLevel = elements.cpuLevelSelect.value;
  app.online.roomName = normalizeRoomName(elements.roomInput.value);
  app.secretBuffer = "";
  app.secretArmed = false;
  app.online.selfReady = false;
  app.online.peerReady = false;
  app.online.waiting = false;
  app.online.startAtUnix = 0;

  announceOnlineLeave();
  teardownOnlineTransport(false);

  resetEngine(app.local);
  setupOpeningPieces(app.local, true);
  resetEngine(app.cpu);
  if (app.mode === "cpu") {
    setupOpeningPieces(app.cpu, false);
  }
  app.remote = createRemoteView();

  updateScoreDisplay();
  updateBestScoreDisplay();
  updateStatusPanel();
  updateOpponentPanelText();
  updateStartHint("");
  syncUi();
  resizeCanvases();
  renderAll();
}

function syncUi() {
  elements.controlSection.hidden = app.stage !== "idle";
  elements.startOverlay.hidden = app.stage === "running" || app.stage === "ended";
  elements.gameOverOverlay.hidden = app.stage !== "ended";
  elements.startButton.disabled = app.stage === "waiting";
  elements.playLayout.dataset.mode = app.mode;
  elements.opponentPanel.hidden = app.mode === "solo";
  updateStatusPanel();
  updateOpponentPanelText();
}

function applyModeUi() {
  elements.cpuOptions.hidden = app.mode !== "cpu";
  elements.onlineOptions.hidden = app.mode !== "online";
  syncUi();
}

function updateStatusPanel() {
  if (app.mode === "solo") {
    elements.statusValue.textContent = "ひとり";
    return;
  }

  if (app.mode === "cpu") {
    elements.statusValue.textContent = `CPU対戦 ${CPU_LEVELS[app.cpuLevel].label}`;
    return;
  }

  elements.statusValue.textContent = app.online.roomName ? `オンライン対戦 ${app.online.roomName}` : "オンライン対戦";
}

function updateOpponentPanelText() {
  if (app.mode === "solo") {
    elements.opponentHeading.textContent = "相手フィールド";
    elements.opponentName.textContent = "-";
    elements.opponentScore.textContent = "0";
    elements.battleStatus.textContent = "-";
    return;
  }

  if (app.mode === "cpu") {
    elements.opponentHeading.textContent = "CPUフィールド";
    elements.opponentName.textContent = CPU_LEVELS[app.cpuLevel].label;
    elements.opponentScore.textContent = formatScore(app.cpu.score);
    elements.battleStatus.textContent = app.stage === "running" ? "対戦中" : "待機";
    return;
  }

  elements.opponentHeading.textContent = "相手フィールド";
  elements.opponentName.textContent = app.online.roomName || "-";
  elements.opponentScore.textContent = formatScore(app.remote.score);

  if (app.stage === "waiting") {
    elements.battleStatus.textContent = app.online.peerReady ? "開始待機" : "部屋待機";
  } else if (app.stage === "running") {
    elements.battleStatus.textContent = app.remote.connected ? "対戦中" : "接続待機";
  } else {
    elements.battleStatus.textContent = app.remote.connected ? "待機" : "-";
  }
}

function updateStartHint(message = null) {
  if (message !== null) {
    elements.startHint.textContent = message;
    return;
  }

  if (app.mode === "online") {
    if (app.stage === "waiting") {
      elements.startHint.textContent = app.online.peerReady ? "開始待機" : "部屋待機";
      return;
    }

    if (!normalizeRoomName(elements.roomInput.value)) {
      elements.startHint.textContent = "部屋名";
      return;
    }
  }

  elements.startHint.textContent = "";
}

function handleLogoDoubleClick() {
  if (app.practiceMode) {
    setPracticeMode(false);
    return;
  }

  app.secretArmed = true;
  app.secretBuffer = "";
}

function setPracticeMode(active) {
  app.practiceMode = active;
  elements.body.classList.toggle("practice-active", active);
  app.secretArmed = false;
  app.secretBuffer = "";

  if (app.stage === "idle") {
    resetToInitialState();
    return;
  }

  if (active && app.local.nextType && !isPracticePiece(app.local.nextType)) {
    app.local.nextType = drawPieceType(true);
  }
}

function handleKeydown(event) {
  trackSecretSequence(event.key);

  const handled =
    event.key === "ArrowLeft" ||
    event.key === "ArrowRight" ||
    event.key === "ArrowUp" ||
    event.key === "ArrowDown" ||
    event.code === "Space";

  if (handled) {
    event.preventDefault();
  }

  if (app.stage !== "running" || !app.local.running || !app.local.currentPiece) {
    return;
  }

  if (event.key === "ArrowLeft") {
    movePiece(app.local, -1, 0);
  } else if (event.key === "ArrowRight") {
    movePiece(app.local, 1, 0);
  } else if (event.key === "ArrowUp") {
    tryRotatePiece(app.local);
  } else if (event.key === "ArrowDown") {
    app.local.softDropActive = true;
    if (!movePiece(app.local, 0, 1)) {
      lockPiece(app.local, performance.now());
    }
  } else if (event.code === "Space") {
    hardDrop(app.local, performance.now());
  }

  if (app.mode === "online") {
    maybeSendOnlineSnapshot(performance.now(), true);
  }
}

function handleKeyup(event) {
  if (event.key === "ArrowDown") {
    app.local.softDropActive = false;
  }
}

function trackSecretSequence(key) {
  if (!app.secretArmed || app.practiceMode || key.length !== 1) {
    return;
  }

  if (!/[a-z]/i.test(key)) {
    app.secretBuffer = "";
    return;
  }

  app.secretBuffer = `${app.secretBuffer}${key.toLowerCase()}`.slice(-PRACTICE_SEQUENCE.length);

  if (app.secretBuffer === PRACTICE_SEQUENCE) {
    setPracticeMode(true);
  }
}

function updateEngine(engine, timestamp, isLocal) {
  if (!engine.running || !engine.currentPiece) {
    return;
  }

  if (!engine.lastTick) {
    engine.lastTick = timestamp;
  }

  const delta = timestamp - engine.lastTick;
  engine.lastTick = timestamp;
  engine.dropAccumulator += delta;

  const interval = getDropInterval(engine, timestamp) / (isLocal && engine.softDropActive ? 8 : 1);

  while (engine.dropAccumulator >= interval && engine.running) {
    engine.dropAccumulator -= interval;

    if (!movePiece(engine, 0, 1)) {
      lockPiece(engine, timestamp);
      engine.dropAccumulator = 0;
      break;
    }
  }
}

function updateCpuEngine(engine, timestamp) {
  if (!engine.running || !engine.currentPiece) {
    return;
  }

  planCpuMove(engine, timestamp);
  runCpuActions(engine, timestamp);
  updateEngine(engine, timestamp, false);
}

function planCpuMove(engine, timestamp) {
  const ai = engine.ai;

  if (ai.pieceId === engine.currentPiece.id) {
    return;
  }

  if (engine.currentPiece.y < Math.floor((ROWS * 2) / 3)) {
    return;
  }

  const level = CPU_LEVELS[app.cpuLevel];
  ai.pieceId = engine.currentPiece.id;
  ai.readyAt = timestamp + randomBetween(level.thinkMin, level.thinkMax);
  ai.nextActionAt = ai.readyAt + level.delayMs;
  ai.actions = null;
}

function runCpuActions(engine, timestamp) {
  const ai = engine.ai;

  if (ai.pieceId !== engine.currentPiece.id || timestamp < ai.readyAt) {
    return;
  }

  if (!ai.actions) {
    ai.actions = buildCpuActionQueue(engine);
  }

  if (timestamp < ai.nextActionAt || !ai.actions.length) {
    return;
  }

  const action = ai.actions.shift();
  ai.nextActionAt = timestamp + CPU_LEVELS[app.cpuLevel].actionMs;

  if (action === "rotate") {
    tryRotatePiece(engine);
  } else if (action === "left") {
    movePiece(engine, -1, 0);
  } else if (action === "right") {
    movePiece(engine, 1, 0);
  } else if (action === "drop") {
    hardDrop(engine, timestamp);
  }
}

function buildCpuActionQueue(engine) {
  const placements = enumeratePlacements(engine.board, engine.currentPiece.type);
  if (!placements.length) {
    return ["drop"];
  }

  placements.sort((left, right) => right.score - left.score);

  const level = CPU_LEVELS[app.cpuLevel];
  const mistakeChance = randomBetween(level.mistakeMin, level.mistakeMax);
  let target = placements[0];

  if (Math.random() < mistakeChance) {
    const upperBound = Math.min(placements.length - 1, 5);
    const index = upperBound > 0 ? 1 + Math.floor(Math.random() * upperBound) : 0;
    target = placements[index];
  }

  const actions = [];
  for (let count = 0; count < target.rotations; count += 1) {
    actions.push("rotate");
  }

  const deltaX = target.x - engine.currentPiece.x;
  const direction = deltaX < 0 ? "left" : "right";
  for (let step = 0; step < Math.abs(deltaX); step += 1) {
    actions.push(direction);
  }

  actions.push("drop");
  return actions;
}

function movePiece(engine, offsetX, offsetY) {
  const candidate = {
    ...engine.currentPiece,
    x: engine.currentPiece.x + offsetX,
    y: engine.currentPiece.y + offsetY
  };

  if (hasCollision(candidate, engine.board)) {
    return false;
  }

  engine.currentPiece = candidate;
  return true;
}

function hardDrop(engine, timestamp) {
  while (movePiece(engine, 0, 1)) {
    // Intentionally empty.
  }

  lockPiece(engine, timestamp);
}

function tryRotatePiece(engine) {
  const rotatedMatrix = rotateClockwise(engine.currentPiece.matrix);
  const tests = [
    [0, 0],
    [-1, 0],
    [1, 0],
    [-2, 0],
    [2, 0],
    [0, -1],
    [-1, -1],
    [1, -1]
  ];

  for (const [offsetX, offsetY] of tests) {
    const candidate = {
      ...engine.currentPiece,
      matrix: rotatedMatrix,
      x: engine.currentPiece.x + offsetX,
      y: engine.currentPiece.y + offsetY
    };

    if (!hasCollision(candidate, engine.board)) {
      engine.currentPiece = candidate;
      return true;
    }
  }

  return false;
}

function lockPiece(engine, timestamp) {
  if (!engine.currentPiece) {
    return;
  }

  let toppedOut = false;

  forEachFilledCell(engine.currentPiece.matrix, (x, y) => {
    const boardX = engine.currentPiece.x + x;
    const boardY = engine.currentPiece.y + y;

    if (boardY < 0) {
      toppedOut = true;
      return;
    }

    engine.board[boardY][boardX] = engine.currentPiece.type;
  });

  if (toppedOut) {
    handleEngineDefeat(engine);
    return;
  }

  const clearedLines = clearCompletedLines(engine.board);
  if (clearedLines > 0) {
    const gainedScore = getLineScore(clearedLines, engine.kind === "local");
    engine.score += gainedScore;
    engine.totalLines += clearedLines;

    if (engine.kind === "local") {
      updateScoreDisplay();
    } else if (engine.kind === "cpu") {
      updateOpponentPanelText();
    }

    handleGarbageAttack(engine, clearedLines);
  }

  spawnNextPiece(engine);

  if (engine.running && engine.currentPiece) {
    engine.lastTick = timestamp;
    engine.dropAccumulator = 0;
  }
}

function handleGarbageAttack(engine, clearedLines) {
  if (app.mode === "solo" || clearedLines <= 0 || app.stage !== "running") {
    return;
  }

  const garbageLines = Math.ceil(clearedLines / 2);
  if (garbageLines <= 0) {
    return;
  }

  if (app.mode === "cpu") {
    const target = engine.kind === "local" ? app.cpu : app.local;
    applyGarbage(target, garbageLines);
    return;
  }

  if (app.mode === "online" && engine.kind === "local") {
    sendOnlineMessage({
      type: "garbage",
      lines: garbageLines
    });
  }
}

function applyGarbage(engine, garbageLines) {
  if (!engine.running || app.stage !== "running") {
    return;
  }

  let toppedOut = false;

  for (let index = 0; index < garbageLines; index += 1) {
    if (engine.board[0].some(Boolean)) {
      toppedOut = true;
    }

    engine.board.shift();
    engine.board.push(createGarbageRow());
  }

  if (engine.currentPiece) {
    while (hasCollision(engine.currentPiece, engine.board) && engine.currentPiece.y > -4) {
      engine.currentPiece.y -= 1;
    }

    if (hasCollision(engine.currentPiece, engine.board)) {
      toppedOut = true;
    }
  }

  if (toppedOut) {
    handleEngineDefeat(engine);
  }
}

function handleEngineDefeat(engine) {
  engine.running = false;
  engine.gameOver = true;
  engine.softDropActive = false;

  if (app.mode === "online" && engine.kind === "local") {
    maybeSendOnlineSnapshot(performance.now(), true);
    sendOnlineMessage({
      type: "gameover",
      score: engine.score
    });
  }

  if (app.mode === "cpu") {
    app.cpu.running = false;
    app.local.running = false;
  } else {
    app.local.running = false;
  }

  finishMatch();
}

function finishMatch() {
  if (app.stage === "ended") {
    return;
  }

  app.stage = "ended";
  app.online.waiting = false;
  app.online.selfReady = false;
  app.online.peerReady = false;
  app.online.startAtUnix = 0;
  app.local.running = false;
  app.local.softDropActive = false;
  app.cpu.running = false;

  elements.finalScore.textContent = `${formatScore(app.local.score)}点`;
  elements.finalRank.textContent = `ランク：${getRank(app.local.score)}`;

  if (app.local.score > app.bestScore) {
    app.bestScore = app.local.score;
    saveBestScore(app.bestScore);
    updateBestScoreDisplay();
  }

  updateOpponentPanelText();
  syncUi();
}

function getDropInterval(engine, timestamp) {
  if (app.speedMode === "gradual") {
    const elapsed = Math.max(0, timestamp - engine.startTime);
    const tier = Math.floor(elapsed / 15000);
    return Math.max(140, 820 - tier * 60);
  }

  if (app.speedMode === "level") {
    const level = Math.floor(engine.totalLines / 10);
    return Math.max(140, 820 - level * 70);
  }

  return 820;
}

function getLineScore(clearedLines, isLocal) {
  const base = SCORE_TABLE[clearedLines] ?? 0;
  return isLocal && app.practiceMode ? Math.floor(base / 2) : base;
}

function getRank(score) {
  for (const rank of RANK_TABLE) {
    if (score >= rank.score) {
      return rank.label;
    }
  }

  return "D";
}

function setupOpeningPieces(engine, isLocal) {
  engine.currentPiece = createPiece(engine, drawPieceType(isLocal));
  engine.nextType = drawPieceType(isLocal);
}

function spawnNextPiece(engine) {
  const isLocal = engine.kind === "local";
  const nextType = engine.nextType ?? drawPieceType(isLocal);
  engine.currentPiece = createPiece(engine, nextType);
  engine.nextType = drawPieceType(isLocal);
  resetAiState(engine.ai);

  if (hasCollision(engine.currentPiece, engine.board)) {
    handleEngineDefeat(engine);
  }
}

function createPiece(engine, type) {
  const matrix = SHAPES[type].map((row) => [...row]);
  const spawnY = -getTopFilledRow(matrix);
  engine.pieceSerial += 1;

  return {
    id: engine.pieceSerial,
    type,
    matrix,
    x: Math.floor((COLS - matrix[0].length) / 2),
    y: spawnY
  };
}

function drawPieceType(isLocal) {
  const weights = isLocal && app.practiceMode ? PRACTICE_WEIGHTS : PIECE_WEIGHTS;
  const entries = Object.entries(weights);
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let randomValue = Math.random() * totalWeight;

  for (const [type, weight] of entries) {
    randomValue -= weight;
    if (randomValue <= 0) {
      return type;
    }
  }

  return entries[entries.length - 1][0];
}

function isPracticePiece(type) {
  return type === "I" || type === "O";
}

function startEngine(engine, timestamp) {
  engine.running = true;
  engine.gameOver = false;
  engine.softDropActive = false;
  engine.lastTick = timestamp;
  engine.dropAccumulator = 0;
  engine.startTime = timestamp;
}

function resetEngine(engine) {
  engine.board = createEmptyBoard();
  engine.score = 0;
  engine.totalLines = 0;
  engine.currentPiece = null;
  engine.nextType = null;
  engine.running = false;
  engine.gameOver = false;
  engine.softDropActive = false;
  engine.dropAccumulator = 0;
  engine.lastTick = 0;
  engine.startTime = 0;
  engine.pieceSerial = 0;
  resetAiState(engine.ai);
}

function createEngine(kind) {
  return {
    kind,
    board: createEmptyBoard(),
    score: 0,
    totalLines: 0,
    currentPiece: null,
    nextType: null,
    running: false,
    gameOver: false,
    softDropActive: false,
    dropAccumulator: 0,
    lastTick: 0,
    startTime: 0,
    pieceSerial: 0,
    ai: createAiState()
  };
}

function createAiState() {
  return {
    pieceId: 0,
    readyAt: 0,
    nextActionAt: 0,
    actions: []
  };
}

function resetAiState(ai) {
  ai.pieceId = 0;
  ai.readyAt = 0;
  ai.nextActionAt = 0;
  ai.actions = [];
}

function createRemoteView() {
  return {
    board: createEmptyBoard(),
    currentPiece: null,
    score: 0,
    connected: false,
    gameOver: false
  };
}

function createOnlineState() {
  return {
    playerId: createPlayerId(),
    roomName: "",
    connectedRoom: "",
    transport: null,
    peerId: "",
    selfReady: false,
    peerReady: false,
    waiting: false,
    startAtUnix: 0,
    lastSnapshotSentAt: 0
  };
}

function createPlayerId() {
  if (window.crypto && window.crypto.getRandomValues) {
    const buffer = new Uint32Array(1);
    window.crypto.getRandomValues(buffer);
    return `p${buffer[0].toString(36)}`;
  }

  return `p${Math.random().toString(36).slice(2, 10)}`;
}

function createEmptyBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
}

function clearCompletedLines(board) {
  let cleared = 0;

  for (let row = ROWS - 1; row >= 0; row -= 1) {
    if (board[row].every(Boolean)) {
      board.splice(row, 1);
      board.unshift(new Array(COLS).fill(null));
      cleared += 1;
      row += 1;
    }
  }

  return cleared;
}

function createGarbageRow() {
  const holeIndex = Math.floor(Math.random() * COLS);
  return Array.from({ length: COLS }, (_, index) => (index === holeIndex ? null : "G"));
}

function hasCollision(piece, board) {
  let collided = false;

  forEachFilledCell(piece.matrix, (x, y) => {
    const boardX = piece.x + x;
    const boardY = piece.y + y;

    if (boardX < 0 || boardX >= COLS || boardY >= ROWS) {
      collided = true;
      return;
    }

    if (boardY >= 0 && board[boardY][boardX]) {
      collided = true;
    }
  });

  return collided;
}

function rotateClockwise(matrix) {
  const size = matrix.length;
  const rotated = Array.from({ length: size }, () => new Array(size).fill(0));

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      rotated[col][size - 1 - row] = matrix[row][col];
    }
  }

  return rotated;
}

function getTopFilledRow(matrix) {
  for (let row = 0; row < matrix.length; row += 1) {
    if (matrix[row].some(Boolean)) {
      return row;
    }
  }

  return 0;
}

function forEachFilledCell(matrix, callback) {
  for (let row = 0; row < matrix.length; row += 1) {
    for (let col = 0; col < matrix[row].length; col += 1) {
      if (matrix[row][col]) {
        callback(col, row);
      }
    }
  }
}

function enumeratePlacements(board, type) {
  const variants = getRotationVariants(type);
  const placements = [];

  variants.forEach((variant) => {
    const width = variant.matrix[0].length;
    const startX = -width + 1;
    const endX = COLS - 1;

    for (let x = startX; x <= endX; x += 1) {
      const piece = {
        type,
        matrix: variant.matrix,
        x,
        y: -getTopFilledRow(variant.matrix)
      };

      if (hasCollision(piece, board)) {
        continue;
      }

      while (!hasCollision({ ...piece, y: piece.y + 1 }, board)) {
        piece.y += 1;
      }

      const simulation = simulatePlacement(board, piece);
      placements.push({
        x: piece.x,
        y: piece.y,
        rotations: variant.rotations,
        score: evaluateBoard(simulation.board, simulation.clearedLines)
      });
    }
  });

  return placements;
}

function getRotationVariants(type) {
  const variants = [];
  const seen = new Set();
  let matrix = SHAPES[type].map((row) => [...row]);

  for (let rotations = 0; rotations < 4; rotations += 1) {
    const key = matrix.map((row) => row.join("")).join("|");
    if (!seen.has(key)) {
      seen.add(key);
      variants.push({
        rotations,
        matrix: matrix.map((row) => [...row])
      });
    }
    matrix = rotateClockwise(matrix);
  }

  return variants;
}

function simulatePlacement(board, piece) {
  const clonedBoard = board.map((row) => [...row]);

  forEachFilledCell(piece.matrix, (x, y) => {
    const boardX = piece.x + x;
    const boardY = piece.y + y;
    if (boardY >= 0) {
      clonedBoard[boardY][boardX] = piece.type;
    }
  });

  const clearedLines = clearCompletedLines(clonedBoard);
  return { board: clonedBoard, clearedLines };
}

function evaluateBoard(board, clearedLines) {
  const heights = [];
  let holes = 0;

  for (let col = 0; col < COLS; col += 1) {
    let columnHeight = 0;
    let filledSeen = false;

    for (let row = 0; row < ROWS; row += 1) {
      if (board[row][col]) {
        if (!filledSeen) {
          columnHeight = ROWS - row;
          filledSeen = true;
        }
      } else if (filledSeen) {
        holes += 1;
      }
    }

    heights.push(columnHeight);
  }

  let bumpiness = 0;
  for (let index = 0; index < heights.length - 1; index += 1) {
    bumpiness += Math.abs(heights[index] - heights[index + 1]);
  }

  const aggregateHeight = heights.reduce((sum, value) => sum + value, 0);
  const maxHeight = Math.max(...heights);

  return clearedLines * 320 - holes * 120 - aggregateHeight * 4 - bumpiness * 18 - maxHeight * 6;
}

function maybeScheduleOnlineStart() {
  if (app.mode !== "online" || !app.online.selfReady || !app.online.peerReady || app.online.startAtUnix) {
    return;
  }

  if (!isOnlineHost()) {
    return;
  }

  app.online.startAtUnix = Date.now() + 800;
  sendOnlineMessage({
    type: "start",
    startAtUnix: app.online.startAtUnix
  });
}

function isOnlineHost() {
  if (!app.online.peerId) {
    return true;
  }

  return app.online.playerId < app.online.peerId;
}

function ensureOnlineTransport(roomName) {
  if (app.online.transport && app.online.connectedRoom === roomName) {
    return;
  }

  teardownOnlineTransport(false);
  app.online.peerId = "";
  app.online.peerReady = false;
  app.remote = createRemoteView();
  app.online.connectedRoom = roomName;
  app.online.transport = createLocalRoomTransport(roomName, handleOnlineMessage);
  sendOnlineMessage({
    type: "presence",
    ready: false
  });
}

function createLocalRoomTransport(roomName, onMessage) {
  const channelName = `${ONLINE_ROOM_KEY}:${roomName}`;
  const channel = typeof BroadcastChannel === "function" ? new BroadcastChannel(channelName) : null;

  const receive = (rawMessage) => {
    const payload = typeof rawMessage === "string" ? rawMessage : rawMessage?.data ?? rawMessage;
    if (!payload) {
      return;
    }

    try {
      const parsed = JSON.parse(payload);
      onMessage(parsed);
    } catch (error) {
      // Intentionally empty.
    }
  };

  const storageHandler = (event) => {
    if (event.key === channelName && event.newValue) {
      receive(event.newValue);
    }
  };

  if (channel) {
    channel.addEventListener("message", receive);
  }

  window.addEventListener("storage", storageHandler);

  return {
    send(message) {
      const payload = JSON.stringify(message);
      if (channel) {
        channel.postMessage(payload);
      }

      try {
        localStorage.setItem(channelName, payload);
        localStorage.removeItem(channelName);
      } catch (error) {
        // Intentionally empty.
      }
    },
    close() {
      if (channel) {
        channel.removeEventListener("message", receive);
        channel.close();
      }

      window.removeEventListener("storage", storageHandler);
    }
  };
}

function sendOnlineMessage(payload) {
  if (!app.online.transport || !app.online.connectedRoom) {
    return;
  }

  app.online.transport.send({
    ...payload,
    playerId: app.online.playerId,
    roomName: app.online.connectedRoom
  });
}

function handleOnlineMessage(message) {
  if (!message || message.playerId === app.online.playerId || message.roomName !== app.online.connectedRoom) {
    return;
  }

  if (app.online.peerId && message.playerId !== app.online.peerId) {
    return;
  }

  app.online.peerId = message.playerId;

  if (message.type === "presence") {
    app.remote.connected = true;
    app.online.peerReady = Boolean(message.ready);
    if (!message.echo) {
      sendOnlineMessage({
        type: "presence",
        ready: app.online.selfReady,
        echo: true
      });
    }
    maybeScheduleOnlineStart();
    updateStartHint();
    updateOpponentPanelText();
    return;
  }

  if (message.type === "start") {
    app.remote.connected = true;
    app.online.startAtUnix = message.startAtUnix;
    updateStartHint();
    updateOpponentPanelText();
    return;
  }

  if (message.type === "snapshot") {
    app.remote.connected = true;
    app.remote.score = message.snapshot.score;
    app.remote.board = message.snapshot.board.map((row) => [...row]);
    app.remote.currentPiece = message.snapshot.currentPiece
      ? {
          ...message.snapshot.currentPiece,
          matrix: message.snapshot.currentPiece.matrix.map((row) => [...row])
        }
      : null;
    app.remote.gameOver = Boolean(message.snapshot.gameOver);
    updateOpponentPanelText();
    return;
  }

  if (message.type === "garbage") {
    if (app.stage === "running") {
      applyGarbage(app.local, message.lines);
      maybeSendOnlineSnapshot(performance.now(), true);
    }
    return;
  }

  if (message.type === "gameover") {
    app.remote.connected = true;
    app.remote.gameOver = true;
    if (app.stage === "running") {
      finishMatch();
    } else {
      updateOpponentPanelText();
    }
    return;
  }

  if (message.type === "leave") {
    app.online.peerId = "";
    app.online.peerReady = false;
    app.remote = createRemoteView();
    app.online.startAtUnix = 0;
    if (app.stage === "waiting") {
      updateStartHint();
    }
    updateOpponentPanelText();
  }
}

function maybeSendOnlineSnapshot(timestamp, force = false) {
  if (app.mode !== "online" || !app.online.transport || app.stage !== "running") {
    return;
  }

  if (!force && timestamp - app.online.lastSnapshotSentAt < 100) {
    return;
  }

  app.online.lastSnapshotSentAt = timestamp;
  sendOnlineMessage({
    type: "snapshot",
    snapshot: captureSnapshot(app.local)
  });
}

function captureSnapshot(engine) {
  return {
    board: engine.board.map((row) => [...row]),
    score: engine.score,
    gameOver: engine.gameOver,
    currentPiece: engine.currentPiece
      ? {
          type: engine.currentPiece.type,
          x: engine.currentPiece.x,
          y: engine.currentPiece.y,
          matrix: engine.currentPiece.matrix.map((row) => [...row])
        }
      : null
  };
}

function announceOnlineLeave() {
  if (app.mode === "online" && app.online.transport && app.online.connectedRoom) {
    sendOnlineMessage({
      type: "leave"
    });
  }
}

function teardownOnlineTransport(clearRemote) {
  if (app.online.transport) {
    app.online.transport.close();
  }

  app.online.transport = null;
  app.online.connectedRoom = "";
  app.online.peerId = "";
  app.online.peerReady = false;
  app.online.selfReady = false;
  app.online.startAtUnix = 0;
  app.online.lastSnapshotSentAt = 0;

  if (clearRemote) {
    app.remote = createRemoteView();
  }
}

function resizeCanvases() {
  const boardPadding = 24;
  const availableWidth = Math.max(220, elements.boardSection.clientWidth - boardPadding);
  const availableHeight = Math.max(420, elements.boardSection.clientHeight - boardPadding);
  const boardCellSize = Math.max(14, Math.floor(Math.min(availableWidth / COLS, availableHeight / ROWS)));

  app.layout.boardCellSize = boardCellSize;
  boardCanvas.width = boardCellSize * COLS;
  boardCanvas.height = boardCellSize * ROWS;
  elements.boardFrame.style.width = `${boardCanvas.width}px`;
  elements.boardFrame.style.height = `${boardCanvas.height}px`;

  const previewLimit = Math.min(elements.nextFrame.clientWidth, elements.nextFrame.clientHeight);
  const nextCellSize = Math.max(14, Math.floor(Math.min(boardCellSize, previewLimit / 6)));
  app.layout.nextCellSize = nextCellSize;
  nextCanvas.width = nextCellSize * 6;
  nextCanvas.height = nextCellSize * 6;

  const opponentWidth = Math.max(140, elements.opponentFrame.clientWidth);
  const opponentHeight = Math.max(240, elements.opponentFrame.clientHeight);
  const opponentCellSize = Math.max(8, Math.floor(Math.min(opponentWidth / COLS, opponentHeight / ROWS)));
  app.layout.opponentCellSize = opponentCellSize;
  opponentCanvas.width = opponentCellSize * COLS;
  opponentCanvas.height = opponentCellSize * ROWS;
}

function renderAll() {
  drawBoardView(boardContext, boardCanvas, app.local.board, app.stage === "running" ? app.local.currentPiece : null, app.layout.boardCellSize);
  drawNextView();

  if (app.mode === "cpu") {
    drawBoardView(opponentContext, opponentCanvas, app.cpu.board, app.cpu.running ? app.cpu.currentPiece : null, app.layout.opponentCellSize);
  } else if (app.mode === "online") {
    drawBoardView(opponentContext, opponentCanvas, app.remote.board, app.stage === "running" ? app.remote.currentPiece : null, app.layout.opponentCellSize);
  } else {
    drawBoardView(opponentContext, opponentCanvas, createEmptyBoard(), null, app.layout.opponentCellSize);
  }
}

function drawNextView() {
  nextContext.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  nextContext.fillStyle = "#09111f";
  nextContext.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  drawGrid(nextContext, nextCanvas.width, nextCanvas.height, app.layout.nextCellSize);

  if (!app.local.nextType) {
    return;
  }

  const matrix = SHAPES[app.local.nextType];
  const bounds = getMatrixBounds(matrix);
  const offsetX = Math.floor((6 - bounds.width) / 2) - bounds.minX;
  const offsetY = Math.floor((6 - bounds.height) / 2) - bounds.minY;

  forEachFilledCell(matrix, (x, y) => {
    drawCell(nextContext, x + offsetX, y + offsetY, COLORS[app.local.nextType], app.layout.nextCellSize);
  });
}

function drawBoardView(context, canvas, board, currentPiece, cellSize) {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#09111f";
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawGrid(context, canvas.width, canvas.height, cellSize);

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const cell = board[row][col];
      if (!cell) {
        continue;
      }

      const color = cell === "G" ? "#8a90a6" : COLORS[cell];
      drawCell(context, col, row, color, cellSize);
    }
  }

  if (currentPiece) {
    forEachFilledCell(currentPiece.matrix, (x, y) => {
      const boardX = currentPiece.x + x;
      const boardY = currentPiece.y + y;

      if (boardY >= 0) {
        drawCell(context, boardX, boardY, COLORS[currentPiece.type], cellSize);
      }
    });
  }
}

function drawGrid(context, width, height, cellSize) {
  context.strokeStyle = "rgba(255, 255, 255, 0.08)";
  context.lineWidth = 1;

  for (let x = 0; x <= width; x += cellSize) {
    context.beginPath();
    context.moveTo(x + 0.5, 0);
    context.lineTo(x + 0.5, height);
    context.stroke();
  }

  for (let y = 0; y <= height; y += cellSize) {
    context.beginPath();
    context.moveTo(0, y + 0.5);
    context.lineTo(width, y + 0.5);
    context.stroke();
  }
}

function drawCell(context, x, y, color, cellSize) {
  const px = x * cellSize;
  const py = y * cellSize;

  context.fillStyle = color;
  context.fillRect(px + 1, py + 1, cellSize - 2, cellSize - 2);

  context.fillStyle = "rgba(255, 255, 255, 0.22)";
  context.fillRect(px + 2, py + 2, Math.max(4, cellSize - 8), Math.max(3, cellSize * 0.16));

  context.strokeStyle = "rgba(7, 10, 20, 0.42)";
  context.lineWidth = 1;
  context.strokeRect(px + 1.5, py + 1.5, cellSize - 3, cellSize - 3);
}

function getMatrixBounds(matrix) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  forEachFilledCell(matrix, (x, y) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  });

  return {
    minX,
    minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

function updateScoreDisplay() {
  elements.scoreValue.textContent = formatScore(app.local.score);
}

function updateBestScoreDisplay() {
  elements.bestScoreValue.textContent = formatScore(app.bestScore);
}

function loadBestScore() {
  try {
    const rawValue = localStorage.getItem(BEST_SCORE_KEY);
    return rawValue ? Number(rawValue) || 0 : 0;
  } catch (error) {
    return 0;
  }
}

function saveBestScore(score) {
  try {
    localStorage.setItem(BEST_SCORE_KEY, String(score));
  } catch (error) {
    // Intentionally empty.
  }
}

function getSelectedMode() {
  const selected = elements.modeForm.querySelector("input[name='playMode']:checked");
  return selected ? selected.value : "solo";
}

function getSelectedSpeedMode() {
  const selected = elements.speedForm.querySelector("input[name='speedMode']:checked");
  return selected ? selected.value : "fixed";
}

function formatScore(value) {
  return value.toLocaleString("ja-JP");
}

function normalizeRoomName(value) {
  return String(value ?? "").trim().slice(0, 24);
}

function randomBetween(min, max) {
  if (min === max) {
    return min;
  }

  return min + Math.random() * (max - min);
}
