const fs = require("fs");
const path = require("path");

const STALE_CHROMIUM_LOCK_FILE_NAMES = new Set([
  "SingletonLock",
  "SingletonSocket",
  "SingletonCookie",
]);

function isStaleChromiumLockFileName(name) {
  if (STALE_CHROMIUM_LOCK_FILE_NAMES.has(name)) {
    return true;
  }

  return name.toLowerCase().startsWith("singleton");
}

async function walkDirectory(dirPath, visitor) {
  let entries;

  try {
    entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      await walkDirectory(fullPath, visitor);
      continue;
    }

    if (entry.isFile() || entry.isSymbolicLink()) {
      await visitor(fullPath, entry.name);
    }
  }
}

/**
 * Remove stale Chromium singleton lock files left by a previous container
 * instance. Does not delete LocalAuth session data.
 */
async function removeStaleChromiumProfileLocks(authDataPath) {
  const root = path.resolve(authDataPath);
  const removed = [];

  try {
    await fs.promises.access(root);
  } catch {
    return removed;
  }

  await walkDirectory(root, async (filePath, fileName) => {
    if (!isStaleChromiumLockFileName(fileName)) {
      return;
    }

    try {
      await fs.promises.unlink(filePath);
      removed.push(fileName);
    } catch (error) {
      console.warn("[whatsapp-web] failed to remove stale Chromium lock", {
        fileName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return removed;
}

module.exports = {
  STALE_CHROMIUM_LOCK_FILE_NAMES,
  removeStaleChromiumProfileLocks,
};
