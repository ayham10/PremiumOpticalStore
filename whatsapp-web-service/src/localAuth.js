const { LocalAuth } = require("whatsapp-web.js");

/**
 * LocalAuth.logout() deletes the Chromium userDataDir.
 * whatsapp-web.js also calls that from page navigation after LOGOUT /
 * post_logout=1. Automatic browser recovery must never take that path.
 */
class PreserveLocalAuth extends LocalAuth {
  constructor(options = {}) {
    super(options);
    this.sessionDeleteEnabled = false;
  }

  allowSessionDelete() {
    this.sessionDeleteEnabled = true;
  }

  async logout() {
    if (!this.sessionDeleteEnabled) {
      console.warn(
        "[whatsapp-web] LocalAuth.logout suppressed; session preserved",
      );
      return;
    }
    return super.logout();
  }
}

module.exports = {
  PreserveLocalAuth,
};
