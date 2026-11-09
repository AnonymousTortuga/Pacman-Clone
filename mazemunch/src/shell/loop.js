// requestAnimationFrame + fixed-step accumulator. The game advances in exact
// 1/60 s ticks regardless of display refresh rate; rendering happens once per frame.

const MAX_FRAME_MS = 250; // clamp after a tab switch so we don't fast-forward

export function createLoop({ game, input, onFrame }) {
  let acc = 0;
  let last = 0;
  let speed = 1; // game speed setting: 0.7, 0.85 or 1
  let running = false;
  let rafId = 0;

  function frame(now) {
    if (!running) return;
    acc += Math.min(now - last, MAX_FRAME_MS);
    last = now;
    const step = 1000 / (60 * speed);
    while (acc >= step) {
      game.tick(input.consume());
      acc -= step;
    }
    onFrame(acc / step);
    rafId = requestAnimationFrame(frame);
  }

  function onVisibility() {
    if (document.hidden) game.setPaused(true);
    last = performance.now();
  }

  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      document.addEventListener('visibilitychange', onVisibility);
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
      document.removeEventListener('visibilitychange', onVisibility);
    },
    setSpeed(s) {
      speed = s;
    },
  };
}
