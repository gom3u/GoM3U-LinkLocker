/**
 * GoM3U Link Locker — firebase.js
 * ---------------------------------------------------------
 * Initializes Firebase (compat SDK, chosen deliberately so this
 * project runs on GitHub Pages with plain <script> tags — no
 * bundler, no npm install, no build step) and exposes small
 * reusable helpers other files call into.
 * ---------------------------------------------------------
 */

// Guard: config.js must load before this file
if (!window.FIREBASE_CONFIG) {
  console.error("[GoM3U] Missing config.js — load it before firebase.js");
}

firebase.initializeApp(window.FIREBASE_CONFIG);

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Enable offline persistence where possible — keeps the site usable
// on flaky mobile connections (Android TV browsers included).
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  console.warn("[GoM3U] Firestore persistence unavailable:", err.code);
});

/* ---------------------------------------------------------
 * Reusable data helpers
 * --------------------------------------------------------- */

const GoDB = {
  /** Fetch a single document by path (e.g. "playlist/current") */
  async getDoc(path) {
    const snap = await db.doc(path).get();
    return snap.exists ? snap.data() : null;
  },

  /** Listen live to a single document, calling cb(data) on every change */
  onDoc(path, cb) {
    return db.doc(path).onSnapshot((snap) => {
      cb(snap.exists ? snap.data() : null);
    });
  },

  /** Merge-write a document (creates it if missing) */
  async setDoc(path, data) {
    return db.doc(path).set(data, { merge: true });
  },

  /** Add a new document with an auto ID to a collection */
  async addDoc(collectionPath, data) {
    return db.collection(collectionPath).add(data);
  },

  /** Increment a numeric field atomically */
  increment(amount = 1) {
    return firebase.firestore.FieldValue.increment(amount);
  },

  serverTimestamp() {
    return firebase.firestore.FieldValue.serverTimestamp();
  }
};

/* ---------------------------------------------------------
 * Auth helpers
 * --------------------------------------------------------- */

const GoAuth = {
  login(email, password) {
    return auth.signInWithEmailAndPassword(email, password);
  },
  logout() {
    return auth.signOut();
  },
  onChange(cb) {
    return auth.onAuthStateChanged(cb);
  },
  isAdmin(user) {
    return !!user && user.email === window.ADMIN_EMAIL;
  }
};

window.GoDB = GoDB;
window.GoAuth = GoAuth;
