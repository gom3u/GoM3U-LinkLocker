/**
 * GoM3U Link Locker — config.js
 * ---------------------------------------------------------
 * This is the ONLY file most people need to edit to deploy.
 * 1. Paste your Firebase project config below.
 * 2. Set the admin email that is allowed into /admin.html.
 * 3. Adjust default lock/ad timings if you want.
 * ---------------------------------------------------------
 */

// 🔥 Firebase project config — get this from
// Firebase Console → Project settings → General → Your apps → SDK setup
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyDoinDVef8tnm8rJvt3BC9lmlVuMvyiT0E",
  authDomain: "gom3u-locker.firebaseapp.com",
  projectId: "gom3u-locker",
  storageBucket: "gom3u-locker.firebasestorage.app",
  messagingSenderId: "472144757627",
  appId: "1:472144757627:web:c825f2ca7c33efd46ab3de",
  measurementId: "G-K22SWQE7GJ"
};

// 👤 Only this email can sign in to admin.html (extra client-side check;
// the real enforcement lives in Firestore rules — see firestore.rules)
window.ADMIN_EMAIL = "gom3u.site@gmail.com";

// ⚙️ App-wide defaults (overridden live by Firestore "settings/general" doc)
window.APP_DEFAULTS = {
  siteName: "GoM3U",
  siteTagline: "Premium IPTV Playlist Access",
  countdownStep1: 5,      // seconds for ad step 1
  countdownStep2: 5,      // seconds for ad step 2
  finalVerification: 20,  // seconds for final verification ring
  autoLockAfter: 120,     // seconds until the link re-locks
  themeColor: "#22D3B8",
  supportTelegram: "https://t.me/gom3u"
};

// 📦 Firestore collection/document paths used across the app — change here
// once and every file stays in sync.
window.DB_PATHS = {
  settings: "settings/general",
  ads: "settings/ads",
  announcement: "settings/announcement",
  playlist: "playlist/current",
  statsRoot: "stats",
  statsDaily: "stats_daily",
  unlockEvents: "unlock_events"
};
