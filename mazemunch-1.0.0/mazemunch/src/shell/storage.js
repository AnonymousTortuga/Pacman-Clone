// High scores and settings in localStorage. Every access is wrapped: private
// windows and locked-down browsers can throw, and the game must still run.

const SCORES_KEY = 'mazemunch.scores.v1';
const SETTINGS_KEY = 'mazemunch.settings.v1';
const MAX_SCORES = 10;

export const DEFAULT_SETTINGS = Object.freeze({ reducedFlash: false, markers: false, speed: 1 });

function read(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadScores() {
  const list = read(SCORES_KEY, []);
  if (!Array.isArray(list)) return [];
  return list
    .filter((e) => e && typeof e.name === 'string' && Number.isFinite(e.score))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SCORES);
}

export function qualifies(score) {
  if (score <= 0) return false;
  const list = loadScores();
  return list.length < MAX_SCORES || score > list[list.length - 1].score;
}

export function addScore(name, score) {
  const clean = String(name).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || '???';
  const list = loadScores();
  list.push({ name: clean, score, date: new Date().toISOString().slice(0, 10) });
  list.sort((a, b) => b.score - a.score);
  write(SCORES_KEY, list.slice(0, MAX_SCORES));
  return loadScores();
}

export function loadSettings() {
  const saved = read(SETTINGS_KEY, {});
  return { ...DEFAULT_SETTINGS, ...(saved && typeof saved === 'object' ? saved : {}) };
}

export function saveSettings(settings) {
  write(SETTINGS_KEY, settings);
}
