const COLS = 10;
const ROWS = 20;

const SCORE_TABLE = {
  1: 100,
  2: 300,
  3: 500,
  4: 800
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

const boardCanvas = document.getElementById("boardCanvas");
const boardContext = boardCanvas.getContext("2d");
const nextCanvas = document.getElementById("nextCanvas");
const nextContext = nextCanvas.getContext("2d");

const scoreValue = document.getElementById("scoreValue");
const speedForm = document.getElementById("speedForm");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");
const startOverlay = document.getElementById("startOverlay");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const finalScore = document.getElementById("finalScore");
const finalRank = document.getElementById("finalRank");
const boardSection = document.getElementById("boardSection");
const boardFrame = document.getElementById("boardFrame");
const nextFrame = document.getElementById("nextFrame");

const state = {
  board: createEmptyBoard(),
  bag: [],
  score: 0,
  totalLines: 0,
  speedMode: "fixed",
  currentPiece: null,
  nextType: null,
  started: false,
  running: false,
  gameOver: false,
  softDropActive: false,
  animationFrameId: 0,
  lastFrameTime: 0,
  dropAccumulator: 0,
  startTime: 0,
  boardCellSize: 28,
  nextCellSize: 24
};

function init() {
  bindEvents();
  resetToInitialState();
  resizeCanvases();
  render();
}

function bindEvents() {
  startButton.addEventListener("click", startGame);
  restartButton.addEventListener("click", resetToInitialState);

  speedForm.addEventListener("change", () => {
    state.speedMode = getSelectedSpeedMode();
  });

  window.addEventListener("keydown", handleKeydown, { passive: false });
  window.addEventListener("keyup", handleKeyup);
  window.addEventListener("resize", resizeCanvases);

  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(() => {
      resizeCanvases();
      render();
    });

    observer.observe(boardSection);
    observer.observe(nextFrame);
  }
}

function resetToInitialState() {
  cancelAnimationFrame(state.animationFrameId);
  state.board = createEmptyBoard();
  state.bag = [];
  state.score = 0;
  state.totalLines = 0;
  state.speedMode = "fixed";
  state.currentPiece = null;
  state.nextType = null;
  state.started = false;
  state.running = false;
  state.gameOver = false;
  state.softDropActive = false;
  state.animationFrameId = 0;
  state.lastFrameTime = 0;
  state.dropAccumulator = 0;
  state.startTime = 0;

  setSelectedSpeedMode("fixed");
  prepareOpeningPieces();
  updateHud();
  syncOverlayState();
  resizeCanvases();
  render();
}

function startGame() {
  if (state.running) {
    return;
  }

  state.speedMode = getSelectedSpeedMode();
  state.started = true;
  state.running = true;
  state.gameOver = false;
  state.softDropActive = false;
  state.lastFrameTime = 0;
  state.dropAccumulator = 0;
  state.startTime = performance.now();
  syncOverlayState();
  render();
  state.animationFrameId = requestAnimationFrame(gameLoop);
}

function prepareOpeningPieces() {
  state.currentPiece = createPiece(takeFromBag());
  state.nextType = takeFromBag();
}

function gameLoop(timestamp) {
  if (!state.running) {
    return;
  }

  if (!state.lastFrameTime) {
    state.lastFrameTime = timestamp;
  }

  const delta = timestamp - state.lastFrameTime;
  state.lastFrameTime = timestamp;
  state.dropAccumulator += delta;

  const interval = getDropInterval(timestamp) / (state.softDropActive ? 8 : 1);

  while (state.dropAccumulator >= interval && state.running) {
    state.dropAccumulator -= interval;

    if (!movePiece(0, 1)) {
      lockPiece();
      state.dropAccumulator = 0;
      break;
    }
  }

  render();

  if (state.running) {
    state.animationFrameId = requestAnimationFrame(gameLoop);
  }
}

function handleKeydown(event) {
  const handled =
    event.key === "ArrowLeft" ||
    event.key === "ArrowRight" ||
    event.key === "ArrowUp" ||
    event.key === "ArrowDown" ||
    event.code === "Space";

  if (handled) {
    event.preventDefault();
  }

  if (!state.running || !state.currentPiece) {
    return;
  }

  if (event.key === "ArrowLeft") {
    movePiece(-1, 0);
  } else if (event.key === "ArrowRight") {
    movePiece(1, 0);
  } else if (event.key === "ArrowUp") {
    tryRotatePiece();
  } else if (event.key === "ArrowDown") {
    state.softDropActive = true;
    if (!movePiece(0, 1)) {
      lockPiece();
    }
  } else if (event.code === "Space") {
    hardDrop();
  }

  render();
}

function handleKeyup(event) {
  if (event.key === "ArrowDown") {
    state.softDropActive = false;
  }
}

function movePiece(offsetX, offsetY) {
  if (!state.currentPiece) {
    return false;
  }

  const nextPiece = {
    ...state.currentPiece,
    x: state.currentPiece.x + offsetX,
    y: state.currentPiece.y + offsetY
  };

  if (hasCollision(nextPiece, state.board)) {
    return false;
  }

  state.currentPiece = nextPiece;
  return true;
}

function hardDrop() {
  while (movePiece(0, 1)) {
    // Intentionally empty.
  }

  lockPiece();
}

function tryRotatePiece() {
  if (!state.currentPiece) {
    return;
  }

  const rotatedMatrix = rotateClockwise(state.currentPiece.matrix);
  const testOffsets = [
    [0, 0],
    [-1, 0],
    [1, 0],
    [-2, 0],
    [2, 0],
    [0, -1],
    [-1, -1],
    [1, -1]
  ];

  for (const [offsetX, offsetY] of testOffsets) {
    const rotatedPiece = {
      ...state.currentPiece,
      matrix: rotatedMatrix,
      x: state.currentPiece.x + offsetX,
      y: state.currentPiece.y + offsetY
    };

    if (!hasCollision(rotatedPiece, state.board)) {
      state.currentPiece = rotatedPiece;
      return;
    }
  }
}

function lockPiece() {
  if (!state.currentPiece) {
    return;
  }

  let toppedOut = false;

  forEachFilledCell(state.currentPiece.matrix, (x, y) => {
    const boardX = state.currentPiece.x + x;
    const boardY = state.currentPiece.y + y;

    if (boardY < 0) {
      toppedOut = true;
      return;
    }

    state.board[boardY][boardX] = state.currentPiece.type;
  });

  if (toppedOut) {
    finishGame();
    return;
  }

  const clearedLines = clearCompletedLines();
  if (clearedLines > 0) {
    state.score += SCORE_TABLE[clearedLines] ?? 0;
    state.totalLines += clearedLines;
    updateHud();
  }

  state.currentPiece = createPiece(state.nextType);
  state.nextType = takeFromBag();

  if (hasCollision(state.currentPiece, state.board)) {
    finishGame();
  }
}

function clearCompletedLines() {
  let cleared = 0;

  for (let row = ROWS - 1; row >= 0; row -= 1) {
    if (state.board[row].every(Boolean)) {
      state.board.splice(row, 1);
      state.board.unshift(new Array(COLS).fill(null));
      cleared += 1;
      row += 1;
    }
  }

  return cleared;
}

function finishGame() {
  state.running = false;
  state.gameOver = true;
  state.softDropActive = false;
  cancelAnimationFrame(state.animationFrameId);
  state.animationFrameId = 0;
  finalScore.textContent = `${formatScore(state.score)}点`;
  finalRank.textContent = `ランク：${getRank(state.score)}`;
  syncOverlayState();
  render();
}

function syncOverlayState() {
  speedForm.hidden = state.started;
  startOverlay.hidden = state.started || state.gameOver;
  gameOverOverlay.hidden = !state.gameOver;
}

function getDropInterval(timestamp) {
  if (state.speedMode === "gradual") {
    const elapsed = Math.max(0, timestamp - state.startTime);
    const tier = Math.floor(elapsed / 15000);
    return Math.max(140, 820 - tier * 60);
  }

  if (state.speedMode === "level") {
    const level = Math.floor(state.totalLines / 10);
    return Math.max(140, 820 - level * 70);
  }

  return 820;
}

function getRank(score) {
  if (score >= 10000) {
    return "S";
  }

  if (score >= 7000) {
    return "A";
  }

  if (score >= 4000) {
    return "B";
  }

  if (score >= 1000) {
    return "C";
  }

  return "D";
}

function getSelectedSpeedMode() {
  const selected = speedForm.querySelector("input[name='speedMode']:checked");
  return selected ? selected.value : "fixed";
}

function setSelectedSpeedMode(mode) {
  const option = speedForm.querySelector(`input[name='speedMode'][value='${mode}']`);
  if (option) {
    option.checked = true;
  }
}

function resizeCanvases() {
  const boardPadding = 24;
  const availableWidth = Math.max(200, boardSection.clientWidth - boardPadding);
  const availableHeight = Math.max(360, boardSection.clientHeight - boardPadding);
  const boardCellSize = Math.max(14, Math.floor(Math.min(availableWidth / COLS, availableHeight / ROWS)));

  state.boardCellSize = boardCellSize;
  boardCanvas.width = boardCellSize * COLS;
  boardCanvas.height = boardCellSize * ROWS;
  boardFrame.style.width = `${boardCanvas.width}px`;
  boardFrame.style.height = `${boardCanvas.height}px`;

  const previewLimit = Math.min(nextFrame.clientWidth, nextFrame.clientHeight);
  const nextCellSize = Math.max(14, Math.floor(Math.min(boardCellSize, previewLimit / 6)));

  state.nextCellSize = nextCellSize;
  nextCanvas.width = nextCellSize * 6;
  nextCanvas.height = nextCellSize * 6;
}

function render() {
  drawBoard();
  drawNext();
}

function drawBoard() {
  boardContext.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
  boardContext.fillStyle = "#0b1220";
  boardContext.fillRect(0, 0, boardCanvas.width, boardCanvas.height);

  drawGrid(boardContext, boardCanvas.width, boardCanvas.height, state.boardCellSize);

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const type = state.board[row][col];
      if (type) {
        drawCell(boardContext, col, row, COLORS[type], state.boardCellSize);
      }
    }
  }

  if (state.started && state.currentPiece) {
    forEachFilledCell(state.currentPiece.matrix, (x, y) => {
      const boardX = state.currentPiece.x + x;
      const boardY = state.currentPiece.y + y;

      if (boardY >= 0) {
        drawCell(boardContext, boardX, boardY, COLORS[state.currentPiece.type], state.boardCellSize);
      }
    });
  }
}

function drawNext() {
  nextContext.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  nextContext.fillStyle = "#0b1220";
  nextContext.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  drawGrid(nextContext, nextCanvas.width, nextCanvas.height, state.nextCellSize);

  if (!state.nextType) {
    return;
  }

  const matrix = SHAPES[state.nextType];
  const bounds = getMatrixBounds(matrix);
  const offsetX = Math.floor((6 - bounds.width) / 2) - bounds.minX;
  const offsetY = Math.floor((6 - bounds.height) / 2) - bounds.minY;

  forEachFilledCell(matrix, (x, y) => {
    drawCell(nextContext, x + offsetX, y + offsetY, COLORS[state.nextType], state.nextCellSize);
  });
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

  context.fillStyle = "rgba(255, 255, 255, 0.2)";
  context.fillRect(px + 2, py + 2, cellSize - 8, Math.max(4, cellSize * 0.16));

  context.strokeStyle = "rgba(7, 10, 20, 0.38)";
  context.lineWidth = 1;
  context.strokeRect(px + 1.5, py + 1.5, cellSize - 3, cellSize - 3);
}

function updateHud() {
  scoreValue.textContent = formatScore(state.score);
}

function formatScore(value) {
  return value.toLocaleString("ja-JP");
}

function createPiece(type) {
  const matrix = SHAPES[type].map((row) => [...row]);
  const spawnY = -getTopFilledRow(matrix);

  return {
    type,
    matrix,
    x: Math.floor((COLS - matrix[0].length) / 2),
    y: spawnY
  };
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

function takeFromBag() {
  if (state.bag.length === 0) {
    state.bag = shuffle(["I", "O", "T", "S", "Z", "J", "L"]);
  }

  return state.bag.pop();
}

function shuffle(source) {
  const values = [...source];

  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }

  return values;
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

function createEmptyBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
}

init();
