// localStorage wrapper – everything is optional; the game works without persistence.
const safe = fn => { try { return fn(); } catch { return undefined; } };

export const store = {
  get(key, fallback) {
    const raw = safe(() => localStorage.getItem(key));
    if (raw == null) return fallback;
    return safe(() => JSON.parse(raw)) ?? fallback;
  },
  set(key, value) { safe(() => localStorage.setItem(key, JSON.stringify(value))); },
  remove(key) { safe(() => localStorage.removeItem(key)); },
};

export const KEYS = {
  level: 'quak:level',
  progress: id => `quak:p:${id}`,
  meta: 'quak:meta',
};

export function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
