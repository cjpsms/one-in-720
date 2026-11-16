// Pending kind -> screen module (lazy). Every module exports render(container, pending, ctx).
export const SCREENS = {
  scene: () => import('./screens/scene.js'),
  shop: () => import('./screens/shop.js'),
  classPlan: () => import('./screens/classplan.js'),
  plan: () => import('./screens/plan.js'),
  termStart: () => import('./screens/termstart.js'),
  lineOrder: () => import('./screens/lineorder.js'),
  focus: () => import('./screens/focus.js'),
  minigame: () => import('./screens/minigame.js'),
};

// Not a pending kind: the full status panel, opened from the header.
export const STATUS_SCREEN = () => import('./screens/status.js');

// Kinds where fast-forward stops (the player must decide); matches engine default.
export const STOP_KINDS = ['scene', 'termStart', 'focus', 'minigame'];

// `?mg=<game>` opens one mini game alone on a test page with a fixed seed (src/ui/minigames/standalone.js), for quick checks.
// Done here because this module is imported before the app boots; the test page takes over #view by itself.
try {
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('mg')) import('./minigames/standalone.js');
} catch { /* ignore */ }
