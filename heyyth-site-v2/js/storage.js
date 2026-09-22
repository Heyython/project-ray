// ============================================================
//  heyyth-site storage layer  (static-site version)
//
//  There is no server anymore — this file is a stand-in for the
//  old filesystem/backend logic, using the browser's own storage:
//
//   - localStorage  → accounts, vault passwords, notes, anon messages
//   - IndexedDB     → vault images / audio / files (actual binary data)
//   - sessionStorage → "logged in" / "vault unlocked" state for this tab
//
//  Everything lives in the visitor's own browser. Nothing is sent
//  to a server (there isn't one). That means the Vault + Anonymous
//  Messages are per-browser, not shared across devices — see the
//  README for what that means in practice.
// ============================================================

const HeyythStore = (() => {
  "use strict";

  const LS_USERS = "heyyth:users";                 // { username: base64password }
  const LS_VAULT_PW = (u) => `heyyth:vaultpw:${u}`;  // base64password
  const LS_NOTES = (u) => `heyyth:notes:${u}`;       // { name: content }
  const LS_ANON = "heyyth:anon";                     // [{username, message, timestamp}]
  const LS_ANON_SEEDED = "heyyth:anon_seeded";        // "1" once seeded

  const SS_SESSION = "heyyth:session";                // username
  const SS_VAULT_UNLOCKED = (u) => `heyyth:vaultunlocked:${u}`; // "1"

  // ---------------- helpers ----------------
  function b64(str) { return btoa(unescape(encodeURIComponent(str))); }
  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
  function isValidUsername(username) {
    return typeof username === "string" && /^[a-zA-Z0-9_-]{2,32}$/.test(username);
  }

  // ---------------- auth ----------------
  function getUsers() { return readJSON(LS_USERS, {}); }

  function login(username, password) {
    if (!isValidUsername(username)) {
      throw new Error("Usernames can only contain letters, numbers, _ and -, (2-32 chars).");
    }
    if (!password) throw new Error("Password required.");
    const users = getUsers();
    let created = false;
    if (!(username in users)) {
      users[username] = b64(password);
      writeJSON(LS_USERS, users);
      created = true;
    } else if (users[username] !== b64(password)) {
      throw new Error("Wrong password.");
    }
    sessionStorage.setItem(SS_SESSION, username);
    return { username, created };
  }

  function logout() {
    sessionStorage.removeItem(SS_SESSION);
  }

  function currentUser() {
    return sessionStorage.getItem(SS_SESSION);
  }

  // ---------------- vault password / lock state ----------------
  function hasVaultPassword(username) {
    return localStorage.getItem(LS_VAULT_PW(username)) !== null;
  }
  function createVaultPassword(username, password) {
    localStorage.setItem(LS_VAULT_PW(username), b64(password));
    sessionStorage.setItem(SS_VAULT_UNLOCKED(username), "1");
  }
  function checkVaultPassword(username, password) {
    return localStorage.getItem(LS_VAULT_PW(username)) === b64(password);
  }
  function unlockVault(username, password) {
    if (!checkVaultPassword(username, password)) throw new Error("Wrong vault password.");
    sessionStorage.setItem(SS_VAULT_UNLOCKED(username), "1");
  }
  function lockVault(username) {
    sessionStorage.removeItem(SS_VAULT_UNLOCKED(username));
  }
  function isVaultUnlocked(username) {
    return sessionStorage.getItem(SS_VAULT_UNLOCKED(username)) === "1";
  }

  // ---------------- notes ----------------
  function listNotes(username) {
    const notes = readJSON(LS_NOTES(username), {});
    return Object.keys(notes).map((name) => ({
      name,
      size: new Blob([notes[name].content]).size,
      modified: notes[name].modified
    })).sort((a, b) => new Date(b.modified) - new Date(a.modified));
  }
  function getNote(username, name) {
    const notes = readJSON(LS_NOTES(username), {});
    return notes[name] ? notes[name].content : null;
  }
  function saveNote(username, name, content) {
    const notes = readJSON(LS_NOTES(username), {});
    notes[name] = { content, modified: new Date().toISOString() };
    writeJSON(LS_NOTES(username), notes);
  }
  function deleteNote(username, name) {
    const notes = readJSON(LS_NOTES(username), {});
    delete notes[name];
    writeJSON(LS_NOTES(username), notes);
  }

  // ---------------- IndexedDB (images / audio / files) ----------------
  const DB_NAME = "heyyth-vault";
  const DB_VERSION = 1;
  const STORE = "files";
  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error("IndexedDB not available in this browser.")); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "key" });
          store.createIndex("byUserType", "userType", { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function fileKey(username, type, name) { return `${username}:${type}:${name}`; }

  async function listVaultFiles(username, type) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const idx = tx.objectStore(STORE).index("byUserType");
      const req = idx.getAll(IDBKeyRange.only(`${username}:${type}`));
      req.onsuccess = () => {
        const results = req.result.map((r) => ({
          name: r.name, size: r.size, modified: r.modified,
          ext: (r.name.split(".").pop() || "").toLowerCase(), mime: r.mime
        })).sort((a, b) => new Date(b.modified) - new Date(a.modified));
        resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function saveVaultFile(username, type, file) {
    const db = await openDB();
    // avoid name collisions
    const existing = await listVaultFiles(username, type);
    let finalName = file.name;
    let counter = 1;
    const existingNames = new Set(existing.map((f) => f.name));
    while (existingNames.has(finalName)) {
      const dot = file.name.lastIndexOf(".");
      const base = dot > -1 ? file.name.slice(0, dot) : file.name;
      const ext = dot > -1 ? file.name.slice(dot) : "";
      finalName = `${base}-${counter}${ext}`;
      counter++;
    }
    const record = {
      key: fileKey(username, type, finalName),
      userType: `${username}:${type}`,
      name: finalName,
      size: file.size,
      mime: file.type,
      modified: new Date().toISOString(),
      blob: file
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () => resolve(finalName);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getVaultFileBlob(username, type, name) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(fileKey(username, type, name));
      req.onsuccess = () => resolve(req.result ? req.result.blob : null);
      req.onerror = () => reject(req.error);
    });
  }

  async function deleteVaultFile(username, type, name) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(fileKey(username, type, name));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ---------------- anonymous messages ----------------
  function seedAnonIfNeeded(sampleMessages) {
    if (localStorage.getItem(LS_ANON_SEEDED)) return;
    writeJSON(LS_ANON, sampleMessages || []);
    localStorage.setItem(LS_ANON_SEEDED, "1");
  }
  function listAnon() {
    return readJSON(LS_ANON, []).slice().reverse();
  }
  function appendAnon(username, message) {
    const messages = readJSON(LS_ANON, []);
    const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
    const entry = { username: username || "Anonymous", message, timestamp };
    messages.push(entry);
    writeJSON(LS_ANON, messages);
    return entry;
  }

  return {
    isValidUsername,
    login, logout, currentUser,
    hasVaultPassword, createVaultPassword, checkVaultPassword,
    unlockVault, lockVault, isVaultUnlocked,
    listNotes, getNote, saveNote, deleteNote,
    listVaultFiles, saveVaultFile, getVaultFileBlob, deleteVaultFile,
    seedAnonIfNeeded, listAnon, appendAnon
  };
})();
