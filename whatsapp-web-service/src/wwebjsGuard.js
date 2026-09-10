const {
  isDuplicatePageBindingError,
  isHarmlessPageLifecycleError,
  sanitizeError,
} = require("./lifecycle");

let guardsInstalled = false;
let injectWrapped = false;
let processBoundaryInstalled = false;

function installWhatsAppWebJsGuards() {
  if (guardsInstalled) {
    return;
  }
  guardsInstalled = true;

  const puppeteerUtil = require("whatsapp-web.js/src/util/Puppeteer");
  const originalExpose = puppeteerUtil.exposeFunctionIfAbsent;

  puppeteerUtil.exposeFunctionIfAbsent = async function safeExposeFunctionIfAbsent(
    page,
    name,
    fn,
  ) {
    try {
      if (page && typeof page.removeExposedFunction === "function") {
        await page.removeExposedFunction(name).catch(() => {});
      }
      return await originalExpose(page, name, fn);
    } catch (error) {
      if (isDuplicatePageBindingError(error) || isHarmlessPageLifecycleError(error)) {
        return;
      }
      throw error;
    }
  };
}

function wrapClientInject(Client) {
  if (!Client || injectWrapped) {
    return;
  }
  const originalInject = Client.prototype.inject;
  if (typeof originalInject !== "function") {
    return;
  }

  Client.prototype.inject = async function oyonGuardedInject(...args) {
    if (this._oyonInjectLocked) {
      return;
    }
    try {
      return await originalInject.apply(this, args);
    } catch (error) {
      if (isDuplicatePageBindingError(error)) {
        console.warn("[whatsapp-web] duplicate page binding ignored during inject", {
          error: sanitizeError(error instanceof Error ? error.message : String(error)),
        });
        return;
      }
      throw error;
    }
  };
  injectWrapped = true;
}

function lockClientInject(activeClient) {
  if (activeClient) {
    activeClient._oyonInjectLocked = true;
  }
}

function installProcessErrorBoundary() {
  if (processBoundaryInstalled) {
    return;
  }
  processBoundaryInstalled = true;

  process.on("unhandledRejection", (reason) => {
    if (isDuplicatePageBindingError(reason) || isHarmlessPageLifecycleError(reason)) {
      console.warn("[whatsapp-web] ignored page-lifecycle unhandledRejection", {
        error: sanitizeError(
          reason instanceof Error ? reason.message : String(reason),
        ),
      });
      return;
    }
    console.error("[whatsapp-web] unhandledRejection", {
      error: sanitizeError(
        reason instanceof Error ? reason.message : String(reason),
      ),
    });
    process.exit(1);
  });

  process.on("uncaughtException", (error) => {
    if (isDuplicatePageBindingError(error) || isHarmlessPageLifecycleError(error)) {
      console.warn("[whatsapp-web] ignored page-lifecycle uncaughtException", {
        error: sanitizeError(error instanceof Error ? error.message : String(error)),
      });
      return;
    }
    console.error("[whatsapp-web] uncaughtException", {
      error: sanitizeError(error instanceof Error ? error.message : String(error)),
    });
    process.exit(1);
  });
}

module.exports = {
  installWhatsAppWebJsGuards,
  wrapClientInject,
  lockClientInject,
  installProcessErrorBoundary,
  isDuplicatePageBindingError,
  isHarmlessPageLifecycleError,
};
