/**
 * GoM3U Link Locker — auth.js
 * ---------------------------------------------------------
 * Shared by login.html and admin.html.
 * - On login.html: handles the sign-in form.
 * - On admin.html: guards the page, redirecting anyone who
 *   isn't the configured admin back to login.html.
 * ---------------------------------------------------------
 */

const LoginPage = {
  init() {
    const form = document.getElementById("login-form");
    if (!form) return; // not on the login page

    // If already logged in as admin, skip straight to dashboard
    GoAuth.onChange((user) => {
      if (GoAuth.isAdmin(user)) window.location.href = "admin.html";
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      this.attemptLogin();
    });
  },

  async attemptLogin() {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const btn = document.getElementById("login-btn");
    const errorBox = document.getElementById("login-error");

    errorBox.textContent = "";
    btn.disabled = true;
    btn.textContent = "Signing in…";

    try {
      const cred = await GoAuth.login(email, password);
      if (!GoAuth.isAdmin(cred.user)) {
        await GoAuth.logout();
        throw new Error("This account is not authorized for admin access.");
      }
      window.location.href = "admin.html";
    } catch (err) {
      errorBox.textContent = this.friendlyError(err);
      btn.disabled = false;
      btn.textContent = "Sign In";
    }
  },

  friendlyError(err) {
    const map = {
      "auth/invalid-email": "That email address doesn't look right.",
      "auth/user-not-found": "No account found with that email.",
      "auth/wrong-password": "Incorrect password. Try again.",
      "auth/invalid-credential": "Incorrect email or password.",
      "auth/too-many-requests": "Too many attempts. Please wait a moment."
    };
    return map[err.code] || err.message || "Sign-in failed. Please try again.";
  }
};

/** Guards admin.html — call this at the top of admin.js */
function guardAdminPage(onAuthorized) {
  GoAuth.onChange((user) => {
    if (!GoAuth.isAdmin(user)) {
      window.location.href = "login.html";
      return;
    }
    onAuthorized(user);
  });
}

document.addEventListener("DOMContentLoaded", () => LoginPage.init());
