/**
 * Opens every child process of this build without a console window on Windows. Injected through
 * `NODE_OPTIONS --require`, so the theme source and keycloakify know nothing about it.
 */
const childProcess = require('node:child_process');

/**
 * Adds `windowsHide` to whichever argument is the options object.
 *
 * The seven functions below put that object in different positions, so find it by shape: the
 * first plain object after the command. Insert one when there is none, before any callback.
 */
function hideWindows(args) {
  const next = [...args];
  const optionsIndex = next.findIndex(
    (value, index) =>
      index > 0 && typeof value === 'object' && value !== null && !Array.isArray(value),
  );

  if (optionsIndex !== -1) {
    next[optionsIndex] = { ...next[optionsIndex], windowsHide: true };
    return next;
  }

  const callbackIndex = next.findIndex((value) => typeof value === 'function');
  if (callbackIndex === -1) {
    next.push({ windowsHide: true });
  } else {
    next.splice(callbackIndex, 0, { windowsHide: true });
  }
  return next;
}

for (const name of ['exec', 'execFile', 'execFileSync', 'execSync', 'fork', 'spawn', 'spawnSync']) {
  const original = childProcess[name];
  childProcess[name] = (...args) => original(...hideWindows(args));
}
