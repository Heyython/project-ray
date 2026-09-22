// ============================================================
//  Client for the secure backend bridge.
//
//  This file never talks to GitHub directly and never holds a
//  GitHub token — it only ever calls our own backend, which holds
//  the real credentials. Auth is a session cookie the backend sets
//  on login (httpOnly — this JS can't read it, only send it back
//  automatically via `credentials: "include"`).
// ============================================================

const HeyythAPI = (() => {
  "use strict";

  const BASE = (window.SITE_CONFIG && window.SITE_CONFIG.apiBaseUrl) || "";

  async function request(path, { method = "GET", body, isForm = false } = {}) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      credentials: "include", // send/receive the httpOnly session cookie
      headers: isForm ? undefined : { "Content-Type": "application/json" },
      body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined
    });

    let data = null;
    try { data = await res.json(); } catch (e) { /* no JSON body (e.g. image) */ }

    if (!res.ok) {
      throw new Error((data && data.error) || `Request failed (${res.status})`);
    }
    return data;
  }

  return {
    // ---- auth ----
    login: (username, password) => request("/api/login", { method: "POST", body: { username, password } }),
    logout: () => request("/api/logout", { method: "POST" }),
    me: () => request("/api/me"),

    // ---- search ----
    search: (q) => request(`/api/search?q=${encodeURIComponent(q)}`),

    // ---- profiles ----
    getProfile: (id) => request(`/api/profile/${encodeURIComponent(id)}`),
    updateProfile: (fields) => request("/api/profile", { method: "PUT", body: fields }),
    uploadPfp: (file) => {
      const fd = new FormData();
      fd.append("pfp", file);
      return request("/api/profile/pfp", { method: "POST", isForm: true, body: fd });
    },
    pfpUrl: (id) => `${BASE}/api/pfp/${encodeURIComponent(id)}`,

    // ---- messages ----
    listConversations: () => request("/api/messages"),
    getConversation: (id) => request(`/api/messages/${encodeURIComponent(id)}`),
    sendMessage: (to, content) => request("/api/messages", { method: "POST", body: { to, content } }),
    markRead: (id) => request(`/api/messages/${encodeURIComponent(id)}/read`, { method: "POST" })
  };
})();

window.HeyythAPI = HeyythAPI;
