// Scoring, lives and timing derived from data/level.json.
// Everything is expressed in fixed ticks (60 per second) and pixels per tick.

export const TICKS_PER_SECOND = 60;

export function createRules(level) {
  const ticks = (seconds) => Math.round(seconds * TICKS_PER_SECOND);
  const pxPerTick = (fraction) => (level.baseSpeed * fraction) / TICKS_PER_SECOND;

  return Object.freeze({
    level,
    ticks,
    speed: Object.freeze({
      munch: pxPerTick(level.speeds.munch),
      chaser: pxPerTick(level.speeds.chaser),
      tunnel: pxPerTick(level.speeds.tunnel),
      frightened: pxPerTick(level.speeds.frightened),
      eaten: pxPerTick(level.speeds.eaten),
      house: pxPerTick(0.5),
    }),
    frightenedTicks: ticks(level.frightenedSeconds),
    flashTicks: ticks(level.flashSeconds),
    releaseTicks: ticks(level.releaseIntervalSeconds),
    readyTicks: ticks(level.timings.readySeconds),
    deathTicks: ticks(level.timings.deathSeconds),
    clearTicks: ticks(level.timings.clearFlashSeconds),
    bonusTicks: ticks(level.bonus.seconds),
    inputBufferTicks: 8,
    preTurnPx: 4,

    /** Points for the nth chaser (0-based) eaten during one power pellet: 200, 400, 800, 1600. */
    chaserPoints(n) {
      return level.points.firstChaser * 2 ** n;
    },
  });
}
