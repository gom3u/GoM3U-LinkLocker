/**
 * GoM3U Link Locker — admin.js
 * ---------------------------------------------------------
 * Drives admin.html. Requires auth.js's guardAdminPage() to
 * have already confirmed the signed-in user is the admin.
 * ---------------------------------------------------------
 */

const Admin = {
  charts: {},

  init(user) {
    document.getElementById("admin-email").textContent = user.email;
    this.bindSidebar();
    this.bindLogout();
    this.bindForms();
    this.loadDashboardCards();
    this.loadPlaylistForm();
    this.loadAdsForm();
    this.loadAnnouncementForm();
    this.loadSettingsForm();
    this.loadAnalytics();
  },

  /* ---------------- Navigation ---------------- */

  bindSidebar() {
    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll(".nav-item")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        const target = btn.dataset.panel;
        document
          .querySelectorAll(".panel")
          .forEach((p) => p.classList.toggle("active", p.id === `panel-${target}`));

        document.getElementById("sidebar")?.classList.remove("open");
      });
    });

    document.getElementById("menu-toggle")?.addEventListener("click", () => {
      document.getElementById("sidebar").classList.toggle("open");
    });
  },

  bindLogout() {
    document.getElementById("logout-btn")?.addEventListener("click", async () => {
      await GoAuth.logout();
      window.location.href = "login.html";
    });
  },

  /* ---------------- Dashboard cards ---------------- */

  async loadDashboardCards() {
    const today = new Date().toISOString().slice(0, 10);

    GoDB.onDoc(DB_PATHS.statsRoot, (data) => {
      document.getElementById("card-total-unlocks").textContent =
        data?.totalUnlocks ?? 0;
    });

    GoDB.onDoc(`${DB_PATHS.statsDaily}/${today}`, (data) => {
      document.getElementById("card-today-unlocks").textContent =
        data?.count ?? 0;
    });

    GoDB.onDoc(DB_PATHS.playlist, (data) => {
      document.getElementById("card-playlist-version").textContent =
        data?.version ?? "-";
    });
  },

  /* ---------------- Playlist Manager ---------------- */

  async loadPlaylistForm() {
    const p = (await GoDB.getDoc(DB_PATHS.playlist)) || {};
    const f = document.getElementById("form-playlist");
    if (!f) return;
    f.url.value = p.url || "";
    f.name.value = p.name || "";
    f.version.value = p.version || "";
    f.channelCount.value = p.channelCount || "";
    f.fileSize.value = p.fileSize || "";
    f.updatedAt.value = p.updatedAt || "";
    f.telegram.value = p.telegram || "";
  },

  /* ---------------- Ads Manager ---------------- */

  async loadAdsForm() {
    const a = (await GoDB.getDoc(DB_PATHS.ads)) || {};
    const f = document.getElementById("form-ads");
    if (!f) return;
    f.slot1Code.value = a.slot1Code || "";
    f.slot2Code.value = a.slot2Code || "";
    f.popupCode.value = a.popupCode || "";
    f.nativeBannerCode.value = a.nativeBannerCode || "";
  },

  previewAd(textareaId, previewId) {
    const code = document.getElementById(textareaId).value;
    const container = document.getElementById(previewId);
    container.innerHTML = "";
    const wrapper = document.createElement("div");
    wrapper.innerHTML = code;
    wrapper.querySelectorAll("script").forEach((oldScript) => {
      const s = document.createElement("script");
      [...oldScript.attributes].forEach((a) => s.setAttribute(a.name, a.value));
      s.textContent = oldScript.textContent;
      oldScript.replaceWith(s);
    });
    container.appendChild(wrapper);
  },

  /* ---------------- Announcement Manager ---------------- */

  async loadAnnouncementForm() {
    const a = (await GoDB.getDoc(DB_PATHS.announcement)) || {};
    const f = document.getElementById("form-announcement");
    if (!f) return;
    f.enabled.checked = !!a.enabled;
    f.text.value = a.text || "";
    f.color.value = a.color || "#22D3B8";
  },

  /* ---------------- Settings Manager ---------------- */

  async loadSettingsForm() {
    const s = (await GoDB.getDoc(DB_PATHS.settings)) || window.APP_DEFAULTS;
    const f = document.getElementById("form-settings");
    if (!f) return;
    f.siteName.value = s.siteName || "";
    f.siteTagline.value = s.siteTagline || "";
    f.countdownStep1.value = s.countdownStep1 ?? 5;
    f.countdownStep2.value = s.countdownStep2 ?? 5;
    f.finalVerification.value = s.finalVerification ?? 20;
    f.autoLockAfter.value = s.autoLockAfter ?? 120;
    f.themeColor.value = s.themeColor || "#22D3B8";
  },

  /* ---------------- Form bindings ---------------- */

  bindForms() {
    // Playlist
    document.getElementById("form-playlist")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      if (!this.validateUrl(f.url.value)) {
        return this.toast("Enter a valid playlist URL (http/https).", "error");
      }
      await GoDB.setDoc(DB_PATHS.playlist, {
        url: f.url.value.trim(),
        name: f.name.value.trim(),
        version: f.version.value.trim(),
        channelCount: f.channelCount.value.trim(),
        fileSize: f.fileSize.value.trim(),
        updatedAt: f.updatedAt.value.trim(),
        telegram: f.telegram.value.trim()
      });
      this.toast("Playlist saved.", "success");
    });

    // Ads
    document.getElementById("preview-ads")?.addEventListener("click", () => {
      this.previewAd("slot1Code", "preview-slot1");
      this.previewAd("slot2Code", "preview-slot2");
    });

    document.getElementById("form-ads")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      await GoDB.setDoc(DB_PATHS.ads, {
        slot1Code: f.slot1Code.value,
        slot2Code: f.slot2Code.value,
        popupCode: f.popupCode.value,
        nativeBannerCode: f.nativeBannerCode.value
      });
      this.toast("Ad settings saved.", "success");
    });

    // Announcement
    document.getElementById("form-announcement")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      await GoDB.setDoc(DB_PATHS.announcement, {
        enabled: f.enabled.checked,
        text: f.text.value.trim(),
        color: f.color.value
      });
      this.toast("Announcement saved.", "success");
    });

    // Settings
    document.getElementById("form-settings")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      await GoDB.setDoc(DB_PATHS.settings, {
        siteName: f.siteName.value.trim(),
        siteTagline: f.siteTagline.value.trim(),
        countdownStep1: Number(f.countdownStep1.value) || 5,
        countdownStep2: Number(f.countdownStep2.value) || 5,
        finalVerification: Number(f.finalVerification.value) || 20,
        autoLockAfter: Number(f.autoLockAfter.value) || 120,
        themeColor: f.themeColor.value
      });
      this.toast("Settings saved.", "success");
    });
  },

  validateUrl(url) {
    try {
      const u = new URL(url);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  },

  /* ---------------- Analytics ---------------- */

  async loadAnalytics() {
    const events = await db
      .collection(DB_PATHS.unlockEvents)
      .orderBy("timestamp", "desc")
      .limit(500)
      .get();

    const devices = {};
    const browsers = {};
    events.forEach((doc) => {
      const d = doc.data();
      devices[d.device] = (devices[d.device] || 0) + 1;
      browsers[d.browser] = (browsers[d.browser] || 0) + 1;
    });

    this.renderPieChart("chart-devices", devices);
    this.renderPieChart("chart-browsers", browsers);
    await this.renderDailyChart();
  },

  async renderDailyChart() {
    const days = [];
    const today = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }

    const counts = await Promise.all(
      days.map(async (day) => {
        const doc = await GoDB.getDoc(`${DB_PATHS.statsDaily}/${day}`);
        return doc?.count || 0;
      })
    );

    const ctx = document.getElementById("chart-daily")?.getContext("2d");
    if (!ctx) return;
    this.charts.daily?.destroy();
    this.charts.daily = new Chart(ctx, {
      type: "line",
      data: {
        labels: days.map((d) => d.slice(5)),
        datasets: [
          {
            label: "Unlocks",
            data: counts,
            borderColor: "#22D3B8",
            backgroundColor: "rgba(34,211,184,0.15)",
            tension: 0.35,
            fill: true
          }
        ]
      },
      options: {
        plugins: { legend: { labels: { color: "#cbd5e1" } } },
        scales: {
          x: { ticks: { color: "#94a3b8" }, grid: { color: "#1e293b" } },
          y: { ticks: { color: "#94a3b8" }, grid: { color: "#1e293b" }, beginAtZero: true }
        }
      }
    });
  },

  renderPieChart(canvasId, dataObj) {
    const ctx = document.getElementById(canvasId)?.getContext("2d");
    if (!ctx) return;
    this.charts[canvasId]?.destroy();
    this.charts[canvasId] = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: Object.keys(dataObj),
        datasets: [
          {
            data: Object.values(dataObj),
            backgroundColor: ["#22D3B8", "#7C6CFF", "#FF5C7A", "#FFB020", "#4F7CFF"]
          }
        ]
      },
      options: { plugins: { legend: { labels: { color: "#cbd5e1" } } } }
    });
  },

  toast(message, type = "info") {
    const root = document.getElementById("toast-root");
    const node = document.createElement("div");
    node.className = `toast toast-${type}`;
    node.textContent = message;
    root.appendChild(node);
    requestAnimationFrame(() => node.classList.add("show"));
    setTimeout(() => {
      node.classList.remove("show");
      setTimeout(() => node.remove(), 300);
    }, 3200);
  }
};

guardAdminPage((user) => Admin.init(user));
