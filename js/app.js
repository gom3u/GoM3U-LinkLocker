/**
 * GoM3U Link Locker — app.js
 * ---------------------------------------------------------
 * Drives index.html (and embed.html, which reuses this file):
 *  - loads live settings / playlist / ads / announcement
 *  - runs the multi-step unlock flow with countdowns
 *  - logs unlock analytics to Firestore
 *  - handles copy / open / download + auto re-lock
 *  - basic anti-abuse hardening (right-click, devtools, multi-unlock)
 * ---------------------------------------------------------
 */

const Locker = {
  state: {
    step: "locked",       // locked | ad1 | ad2 | verify | unlocked
    playlist: null,
    settings: window.APP_DEFAULTS,
    ads: null,
    unlockedAt: null,
    relockTimer: null,
    hasUnlockedThisSession: false
  },

  async init() {
    this.cacheEls();
    this.bindStaticEvents();
    this.applySecurityHardening();
    this.watchConnection();

    await this.loadSettings();
    await this.loadAds();
    await this.loadAnnouncement();
    await this.loadPlaylist();

    this.renderPlaylistMeta();
    this.showStep("locked");
    this.hideSkeleton();
  },

  cacheEls() {
    this.el = {
      skeleton: document.getElementById("skeleton-loader"),
      main: document.getElementById("main-content"),
      getLinkBtn: document.getElementById("get-link-btn"),
      steps: {
        locked: document.getElementById("step-locked"),
        ad1: document.getElementById("step-ad1"),
        ad2: document.getElementById("step-ad2"),
        verify: document.getElementById("step-verify"),
        unlocked: document.getElementById("step-unlocked")
      },
      ad1Continue: document.getElementById("ad1-continue"),
      ad2Continue: document.getElementById("ad2-unlock"),
      ring1: document.getElementById("ring1"),
      ring2: document.getElementById("ring2"),
      ringVerify: document.getElementById("ring-verify"),
      verifyLabel: document.getElementById("verify-label"),
      playlistUrl: document.getElementById("playlist-url"),
      copyBtn: document.getElementById("copy-btn"),
      openBtn: document.getElementById("open-btn"),
      downloadBtn: document.getElementById("download-btn"),
      relockNotice: document.getElementById("relock-notice"),
      relockCountdown: document.getElementById("relock-countdown"),
      meta: {
        name: document.getElementById("meta-name"),
        version: document.getElementById("meta-version"),
        channels: document.getElementById("meta-channels"),
        size: document.getElementById("meta-size"),
        updated: document.getElementById("meta-updated")
      },
      announcementBar: document.getElementById("announcement-bar"),
      announcementText: document.getElementById("announcement-text"),
      adSlot1: document.getElementById("ad-slot-1"),
      adSlot2: document.getElementById("ad-slot-2"),
      toastRoot: document.getElementById("toast-root"),
      offlineNotice: document.getElementById("offline-notice")
    };
  },

  bindStaticEvents() {
    this.el.getLinkBtn?.addEventListener("click", () => this.startFlow());
    this.el.ad1Continue?.addEventListener("click", () => {}); // enabled only after countdown
    this.el.ad2Continue?.addEventListener("click", () => {});
    this.el.copyBtn?.addEventListener("click", () => this.copyUrl());
    this.el.openBtn?.addEventListener("click", () => this.openUrl());
    this.el.downloadBtn?.addEventListener("click", () => this.downloadUrl());
  },

  /* ---------------- Data loading ---------------- */

  async loadSettings() {
    const s = await GoDB.getDoc(DB_PATHS.settings);
    if (s) this.state.settings = { ...window.APP_DEFAULTS, ...s };
    this.applyTheme(this.state.settings.themeColor);
  },

  async loadAds() {
    this.state.ads = (await GoDB.getDoc(DB_PATHS.ads)) || {};
    if (this.state.ads.slot1Code && this.el.adSlot1) {
      this.injectAdCode(this.el.adSlot1, this.state.ads.slot1Code);
    }
    if (this.state.ads.slot2Code && this.el.adSlot2) {
      this.injectAdCode(this.el.adSlot2, this.state.ads.slot2Code);
    }
  },

  async loadAnnouncement() {
    const a = await GoDB.getDoc(DB_PATHS.announcement);
    if (a && a.enabled && a.text) {
      this.el.announcementText.textContent = a.text;
      this.el.announcementBar.style.background = a.color || "#22D3B8";
      this.el.announcementBar.hidden = false;
    }
  },

  async loadPlaylist() {
    this.state.playlist = (await GoDB.getDoc(DB_PATHS.playlist)) || {
      name: "GoM3U Playlist",
      url: "",
      version: "-",
      channelCount: "-",
      fileSize: "-",
      updatedAt: "-"
    };
  },

  renderPlaylistMeta() {
    const p = this.state.playlist;
    this.el.meta.name.textContent = p.name || "GoM3U Playlist";
    this.el.meta.version.textContent = p.version || "-";
    this.el.meta.channels.textContent = p.channelCount || "-";
    this.el.meta.size.textContent = p.fileSize || "-";
    this.el.meta.updated.textContent = p.updatedAt || "-";
  },

  applyTheme(hex) {
    if (!hex) return;
    document.documentElement.style.setProperty("--accent", hex);
  },

  injectAdCode(container, code) {
    // Ad networks (Monetag, Adsterra, etc.) hand out raw <script> snippets.
    // Assigning via innerHTML does not execute <script> tags, so we
    // rebuild and re-append them manually.
    container.innerHTML = code;
    container.querySelectorAll("script").forEach((oldScript) => {
      const newScript = document.createElement("script");
      [...oldScript.attributes].forEach((attr) =>
        newScript.setAttribute(attr.name, attr.value)
      );
      newScript.textContent = oldScript.textContent;
      oldScript.replaceWith(newScript);
    });
  },

  /* ---------------- Flow control ---------------- */

  showStep(name) {
    Object.entries(this.el.steps).forEach(([key, node]) => {
      if (!node) return;
      node.classList.toggle("active", key === name);
    });
    this.state.step = name;
  },

  startFlow() {
    if (this.state.hasUnlockedThisSession) {
      this.toast("Already unlocked — scroll down to grab your link.", "info");
      this.showStep("unlocked");
      return;
    }
    if (!this.state.playlist?.url) {
      this.toast("Playlist isn't configured yet. Check back soon.", "error");
      return;
    }
    this.showStep("ad1");
    this.runCountdown(this.el.ring1, this.state.settings.countdownStep1, () => {
      this.enableContinue(this.el.ad1Continue, () => this.goToAd2());
    });
  },

  goToAd2() {
    this.showStep("ad2");
    this.runCountdown(this.el.ring2, this.state.settings.countdownStep2, () => {
      this.enableContinue(this.el.ad2Continue, () => this.goToVerify());
    });
  },

  goToVerify() {
    this.showStep("verify");
    const total = this.state.settings.finalVerification;
    this.runCountdown(this.el.ringVerify, total, () => this.unlock(), (left) => {
      if (this.el.verifyLabel) {
        this.el.verifyLabel.textContent = `Verifying… ${left}s`;
      }
    });
  },

  /**
   * Drives an SVG ring countdown. `ringEl` must contain a <circle class="ring-progress">.
   * onTick(secondsLeft) is optional, called every second.
   */
  runCountdown(ringEl, seconds, onDone, onTick) {
    if (!ringEl) return onDone();
    const circle = ringEl.querySelector(".ring-progress");
    const label = ringEl.querySelector(".ring-label");
    const circumference = 2 * Math.PI * 54; // matches r=54 in the SVG markup
    circle.style.strokeDasharray = `${circumference}`;
    let left = seconds;

    const tick = () => {
      const progress = left / seconds;
      circle.style.strokeDashoffset = `${circumference * (1 - progress)}`;
      if (label) label.textContent = left;
      if (onTick) onTick(left);
      if (left <= 0) {
        clearInterval(timer);
        onDone();
        return;
      }
      left -= 1;
    };

    tick();
    const timer = setInterval(tick, 1000);
  },

  enableContinue(btn, handler) {
    if (!btn) return handler();
    btn.disabled = false;
    btn.classList.add("ready");
    const fresh = btn.cloneNode(true); // strip old listeners to prevent double-binds
    btn.replaceWith(fresh);
    fresh.addEventListener("click", handler, { once: true });
  },

  async unlock() {
    this.state.hasUnlockedThisSession = true;
    this.state.unlockedAt = Date.now();
    this.el.playlistUrl.value = this.state.playlist.url;
    this.showStep("unlocked");
    this.toast("Playlist unlocked!", "success");
    this.logUnlock();
    this.scheduleAutoRelock();
  },

  scheduleAutoRelock() {
    const seconds = this.state.settings.autoLockAfter || 120;
    let left = seconds;
    this.el.relockNotice.hidden = false;
    clearInterval(this.state.relockTimer);
    this.state.relockTimer = setInterval(() => {
      left -= 1;
      this.el.relockCountdown.textContent = left;
      if (left <= 0) {
        clearInterval(this.state.relockTimer);
        this.relock();
      }
    }, 1000);
  },

  relock() {
    this.state.hasUnlockedThisSession = false;
    this.el.relockNotice.hidden = true;
    this.showStep("locked");
    this.toast("Link locked again. Unlock it once more to continue.", "info");
  },

  /* ---------------- Copy / Open / Download ---------------- */

  async copyUrl() {
    try {
      await navigator.clipboard.writeText(this.state.playlist.url);
      this.toast("URL copied to clipboard.", "success");
    } catch {
      this.el.playlistUrl.select();
      document.execCommand("copy");
      this.toast("URL copied.", "success");
    }
  },

  openUrl() {
    window.open(this.state.playlist.url, "_blank", "noopener,noreferrer");
  },

  downloadUrl() {
    const a = document.createElement("a");
    a.href = this.state.playlist.url;
    a.download = (this.state.playlist.name || "playlist") + ".m3u";
    document.body.appendChild(a);
    a.click();
    a.remove();
  },

  /* ---------------- Analytics ---------------- */

  async logUnlock() {
    try {
      const now = new Date();
      const dayKey = now.toISOString().slice(0, 10); // YYYY-MM-DD

      await GoDB.addDoc(DB_PATHS.unlockEvents, {
        timestamp: GoDB.serverTimestamp(),
        device: this.detectDevice(),
        browser: this.detectBrowser(),
        userAgent: navigator.userAgent,
        language: navigator.language || null
      });

      await GoDB.setDoc(DB_PATHS.statsRoot, {
        totalUnlocks: GoDB.increment(1)
      });

      await GoDB.setDoc(`${DB_PATHS.statsDaily}/${dayKey}`, {
        count: GoDB.increment(1),
        date: dayKey
      });
    } catch (err) {
      console.warn("[GoM3U] Failed to log unlock:", err);
    }
  },

  detectDevice() {
    const ua = navigator.userAgent;
    if (/TV|SmartTV|GoogleTV|AppleTV/i.test(ua)) return "Android TV";
    if (/Mobi|Android/i.test(ua)) return "Mobile";
    if (/Tablet|iPad/i.test(ua)) return "Tablet";
    return "Desktop";
  },

  detectBrowser() {
    const ua = navigator.userAgent;
    if (ua.includes("Firefox")) return "Firefox";
    if (ua.includes("Edg")) return "Edge";
    if (ua.includes("Chrome")) return "Chrome";
    if (ua.includes("Safari")) return "Safari";
    return "Other";
  },

  /* ---------------- UI helpers ---------------- */

  hideSkeleton() {
    this.el.skeleton?.classList.add("hidden");
    this.el.main?.classList.add("visible");
  },

  toast(message, type = "info") {
    const node = document.createElement("div");
    node.className = `toast toast-${type}`;
    node.textContent = message;
    this.el.toastRoot.appendChild(node);
    requestAnimationFrame(() => node.classList.add("show"));
    setTimeout(() => {
      node.classList.remove("show");
      setTimeout(() => node.remove(), 300);
    }, 3200);
  },

  watchConnection() {
    const update = () => {
      if (this.el.offlineNotice) {
        this.el.offlineNotice.hidden = navigator.onLine;
      }
    };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    update();
  },

  /* ---------------- Security hardening ---------------- */

  applySecurityHardening() {
    document.addEventListener("contextmenu", (e) => e.preventDefault());
    document.addEventListener("dragstart", (e) => e.preventDefault());
    document.addEventListener("keydown", (e) => {
      const blocked =
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key)) ||
        (e.ctrlKey && e.key === "U");
      if (blocked) e.preventDefault();
    });
  }
};

document.addEventListener("DOMContentLoaded", () => Locker.init());

// Register the service worker for PWA/offline support
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}
