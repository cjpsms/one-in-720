// Picks the engine: the real one (src/engine/index.js) when it supports the mode, otherwise the mock (src/ui/mock-engine.js).
// The real engine supports routine mode when game.stepBlock exists and view().progress / view().day are there (docs/CONTRACT2.md 5.1).
// ?mock=1 forces the mock. Detailed mode works with the real engine as soon as it has the old API.
export async function getEngine() {
  const params = new URLSearchParams(globalThis.location ? location.search : '');
  const forceMock = params.get('mock') === '1';
  let real = null;
  if (!forceMock) {
    try {
      const mod = await import('../engine/index.js');
      if (typeof mod.createGame === 'function' && typeof mod.loadGame === 'function') real = mod;
    } catch (e) { console.warn('[one-in-720] real engine not available, using mock engine:', e && e.message); }
  }
  let mock = null;
  const getMock = async () => mock || (mock = await import('./mock-engine.js'));

  const routineOk = (g) => {
    try { const v = g.view(); return typeof g.stepBlock === 'function' && typeof g.setRoutine === 'function' && !!v.progress && !!v.day; } catch { return false; }
  };

  return {
    forceMock,
    hasReal: !!real,
    // returns { game, kind:'real'|'mock', note? }
    async createGame({ seed, mode, miniGames }) {
      if (real) {
        try {
          const g = real.createGame({ seed, mode, ...(miniGames ? { miniGames } : {}) });
          if (mode === 'detailed' || routineOk(g)) return { game: g, kind: 'real' };
        } catch (e) { console.warn('[one-in-720] real engine failed to start a life:', e && e.message); }
      }
      const m = await getMock();
      const mg = m.createGame({ seed, mode }); if (miniGames && mg.setMiniGames) mg.setMiniGames(miniGames);
      return { game: mg, kind: 'mock', note: real ? 'เอนจินจริงยังไม่รองรับโหมดกิจวัตร ใช้ข้อมูลทดลองแทน' : (forceMock ? 'โหมดทดลอง (mock)' : 'ยังไม่มีเอนจินจริง ใช้ข้อมูลทดลองแทน') };
    },
    async loadGame(kind, json) {
      if (kind === 'real') {
        const mod = real || await import('../engine/index.js'); // a real save can still be continued under ?mock=1
        return mod.loadGame(json);
      }
      const m = await getMock();
      return m.loadGame(json);
    },
  };
}
