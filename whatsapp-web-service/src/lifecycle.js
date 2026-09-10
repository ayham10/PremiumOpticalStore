const MAX_RECOVERY_ATTEMPTS = 3;
const RECOVERY_WINDOW_MS = 15 * 60 * 1000;

function sanitizeError(message) {
  return String(message || "Unknown error")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/api[_-]?key[=:]\S+/gi, "api_key=[redacted]")
    .slice(0, 500);
}

function isHarmlessPageLifecycleError(error) {
  const message = sanitizeError(
    error instanceof Error ? error.message : String(error || ""),
  );
  return (
    /failed to add page binding/i.test(message) ||
    /onqrchangedevent already exists/i.test(message) ||
    /execution context was destroyed/i.test(message) ||
    /context was destroyed/i.test(message) ||
    /frame was detached/i.test(message) ||
    /detached frame/i.test(message) ||
    /target closed/i.test(message) ||
    /cannot find context with specified id/i.test(message) ||
    /session closed/i.test(message) ||
    /protocol error \(runtime\.callfunctionon\)/i.test(message)
  );
}

function isDuplicatePageBindingError(error) {
  const message = sanitizeError(
    error instanceof Error ? error.message : String(error || ""),
  );
  return (
    /failed to add page binding/i.test(message) ||
    /onqrchangedevent already exists/i.test(message) ||
    /window\['onqrchangedevent'\] already exists/i.test(message)
  );
}

function isRetryableInitError(error) {
  const message = sanitizeError(
    error instanceof Error ? error.message : String(error),
  );

  return (
    /execution context was destroyed/i.test(message) ||
    /context was destroyed/i.test(message) ||
    /frame was detached/i.test(message) ||
    /detached frame/i.test(message) ||
    /target closed/i.test(message) ||
    /cannot find context with specified id/i.test(message) ||
    /protocol error \(runtime\.callfunctionon\)/i.test(message) ||
    /runtime\.callfunctionon timed out/i.test(message) ||
    /the browser is already running/i.test(message) ||
    /onqrchangedevent already exists/i.test(message) ||
    /failed to add page binding/i.test(message) ||
    /browser disconnected/i.test(message)
  );
}

function isLogoutNavigationUrl(url) {
  return typeof url === "string" && url.includes("post_logout=1");
}

/**
 * Decide whether a page that can ping Puppeteer is actually able to send.
 * Missing WWebJS.getChat means the WhatsApp Store was wiped (navigation) and
 * needs a fresh Client — never a same-page inject, and never a send.
 */
function classifyWhatsAppSendability({
  pingOk = false,
  hasGetChat = false,
  logout = false,
} = {}) {
  if (logout) {
    return {
      allowSend: false,
      action: "qr-required",
      reason: "whatsapp-logout",
    };
  }
  if (pingOk && hasGetChat) {
    return {
      allowSend: true,
      action: "send",
      reason: null,
    };
  }
  if (pingOk && !hasGetChat) {
    return {
      allowSend: false,
      action: "fresh-client-recovery",
      reason: "wwebjs-missing",
    };
  }
  return {
    allowSend: false,
    action: "fresh-client-recovery",
    reason: "page-unresponsive",
  };
}

function isGenuineWhatsAppLogout(reason) {
  const value = String(reason || "").trim().toUpperCase();
  if (!value) {
    return false;
  }
  return (
    value === "LOGOUT" ||
    value.includes("POST_LOGOUT") ||
    value === "UNPAIRED" ||
    value.includes("UNPAIRED")
  );
}

function isBrowserDisconnectReason(reason) {
  const value = String(reason || "").trim().toUpperCase();
  if (!value || isGenuineWhatsAppLogout(value)) {
    return false;
  }
  return (
    value === "NAVIGATION" ||
    value === "TIMEOUT" ||
    value === "CONFLICT" ||
    value === "OPENING" ||
    /TARGET CLOSED/i.test(value) ||
    /BROWSER/i.test(value)
  );
}

function isCurrentClientEvent(event, current) {
  if (!event || !current) {
    return false;
  }
  if (event.generation !== current.generation) {
    return false;
  }
  if (!event.client) {
    return false;
  }
  return event.client === current.client || event.client === current.inFlightClient;
}

function createMutex() {
  let chain = Promise.resolve();
  let locked = false;

  return {
    get locked() {
      return locked;
    },
    runExclusive(fn) {
      const run = chain.then(
        async () => {
          locked = true;
          try {
            return await fn();
          } finally {
            locked = false;
          }
        },
        async () => {
          locked = true;
          try {
            return await fn();
          } finally {
            locked = false;
          }
        },
      );
      chain = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
  };
}

function createRecoveryBudget({
  maxAttempts = MAX_RECOVERY_ATTEMPTS,
  windowMs = RECOVERY_WINDOW_MS,
} = {}) {
  let attempts = [];

  function prune(now = Date.now()) {
    attempts = attempts.filter((at) => now - at < windowMs);
    return attempts;
  }

  return {
    maxAttempts,
    windowMs,
    canAttempt(now = Date.now()) {
      return prune(now).length < maxAttempts;
    },
    remaining(now = Date.now()) {
      return Math.max(0, maxAttempts - prune(now).length);
    },
    record(now = Date.now()) {
      prune(now);
      attempts.push(now);
      return attempts.length;
    },
    peekAttempts(now = Date.now()) {
      return prune(now).length;
    },
  };
}

module.exports = {
  MAX_RECOVERY_ATTEMPTS,
  RECOVERY_WINDOW_MS,
  sanitizeError,
  isRetryableInitError,
  isHarmlessPageLifecycleError,
  isDuplicatePageBindingError,
  isGenuineWhatsAppLogout,
  isLogoutNavigationUrl,
  classifyWhatsAppSendability,
  isBrowserDisconnectReason,
  isCurrentClientEvent,
  createMutex,
  createRecoveryBudget,
};
