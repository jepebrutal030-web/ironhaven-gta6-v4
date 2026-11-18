// Keyboard + mouse input. Headless SwiftShader runs at ~4-9 FPS, so a key
// tap can land between frames and be dropped by a plain keydown check.
// This keeps a justPressed queue: wasPressed(code) consumes exactly one
// press per physical tap, so E/R/P/M/1-2-3 never get lost.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.queue = [];          // codes pressed since last frame, in order
    this.mouseDX = 0; this.mouseDY = 0;
    this.mouseDown = false;   // left button held
    this.mouseClicked = false;// left button clicked this frame (consumed)
    this.locked = false;
    this.canvas = canvas;
    this.onKey = null;        // optional callback(code) for UI keys

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.queue.push(e.code);
      if (this.onKey) this.onKey(e.code);
      if (e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.queue.length = 0; });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouseDown = true; this.mouseClicked = true; }
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; });
    document.addEventListener('mousemove', (e) => {
      if (this.locked) { this.mouseDX += e.movementX; this.mouseDY += e.movementY; }
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    canvas.addEventListener('click', () => {
      if (!this.locked && document.pointerLockElement !== canvas) {
        try { canvas.requestPointerLock(); } catch (_) { /* headless: ignore */ }
      }
    });
  }

  down(code) { return this.keys.has(code); }
  // Consume one queued press of `code` (true at most once per physical tap).
  wasPressed(code) {
    const i = this.queue.indexOf(code);
    if (i === -1) return false;
    this.queue.splice(i, 1);
    return true;
  }
  // Call once per frame: drains the mouse delta and the click flag.
  endFrame() {
    this.mouseDX = 0; this.mouseDY = 0;
    this.mouseClicked = false;
    // keep the queue bounded; stale presses older than a frame are dropped
    if (this.queue.length > 24) this.queue.splice(0, this.queue.length - 24);
  }
  // Movement axes from WASD / arrows, -1..1.
  axes() {
    let x = 0, y = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyW') || this.down('ArrowUp')) y += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y -= 1;
    return { x, y };
  }
}
