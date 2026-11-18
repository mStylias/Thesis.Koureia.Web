/**
 * Makes a directory rename fall back to copy-and-delete on Windows.
 *
 * Keycloakify copies a native theme onto itself for every theme name. The email theme is native,
 * so it takes the in-place path: write a sibling `tmp_…` directory, delete the original, then
 * rename the temporary one over it.
 *
 * That last rename fails here with `EPERM`, and it is not a race. The original is already gone,
 * a fresh directory of the same name works, and the temporary one deletes. Only the rename
 * fails, to any name, seconds later, from another process. A retry does not help. A copy does.
 *
 * Injected through `NODE_OPTIONS --require`, so the theme source knows nothing about it.
 *
 * NOTE: A library that captured `fs.renameSync` into a local before this ran still bypasses all
 * three patches. `graceful-fs` does that. Examine it first if the `EPERM` returns.
 */
const fs = require('node:fs');

const renameSync = fs.renameSync;
const rename = fs.rename;
const RECOVERABLE = new Set(['EPERM', 'EACCES', 'EBUSY', 'ENOTEMPTY']);

/** Performs the copy, or rethrows for anything this patch is not meant to cover. */
function recover(error, from, to) {
  if (process.platform !== 'win32' || !RECOVERABLE.has(error.code) || !isDirectory(from)) {
    throw error;
  }

  // No `force: true` on the copy. An existing destination means the caller wanted a replace,
  // and a silent merge of two trees hides that.
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
  fs.rmSync(from, { recursive: true, force: true });
}

fs.renameSync = (from, to) => {
  try {
    renameSync(from, to);
  } catch (error) {
    recover(error, from, to);
  }
};

fs.rename = (from, to, callback) => {
  rename(from, to, (error) => {
    if (error === null || error === undefined) {
      callback(null);
      return;
    }

    try {
      recover(error, from, to);
      callback(null);
    } catch (recoveryError) {
      callback(recoveryError);
    }
  });
};

// `fs.promises` and `node:fs/promises` expose the same object, but that is an implementation
// detail, so patch both. The `Set` dedupes them by identity, because a double wrap would run the
// recovery twice.
const promiseModules = new Set(
  [fs.promises, safeRequire('node:fs/promises')].filter((value) => value !== undefined),
);

for (const promises of promiseModules) {
  const promiseRename = promises.rename;
  if (typeof promiseRename !== 'function') continue;

  promises.rename = async (from, to) => {
    try {
      await promiseRename(from, to);
    } catch (error) {
      recover(error, from, to);
    }
  };
}

function isDirectory(path) {
  try {
    return fs.statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function safeRequire(id) {
  try {
    return require(id);
  } catch {
    return undefined;
  }
}
