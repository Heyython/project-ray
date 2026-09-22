(() => {
  "use strict";

  const config = window.SITE_CONFIG;
  const store = window.HeyythStore; // still used for Vault + Anonymous Messages (per-browser features, unchanged)
  const api = window.HeyythAPI;     // GitHub-backed accounts / search / profiles / messages

  const state = {
    // "me" is populated from the backend session (GET /api/me), not
    // localStorage — accounts now live in GitHub, not the browser.
    me: null,
    username: null,       // kept for Vault/Anon Messages, which key their local data by username
    galleryFilter: "all",
    activeImageUrls: [],
    activeAudioUrls: [],
    viewingProfileId: null,   // whose profile view-profile is currently showing
    activeConversationId: null,
    conversationsCache: [],
    messagesRefreshTimer: null
  };

  // ------------------------------------------------------------
  // Sparkle background
  // ------------------------------------------------------------
  function initSparkles() {
    const container = document.getElementById("sparkles");
    for (let i = 0; i < 30; i++) {
      const s = document.createElement("span");
      s.className = "sparkle";
      s.style.left = Math.random() * 100 + "vw";
      s.style.top = Math.random() * 100 + "vh";
      s.style.animationDelay = (Math.random() * 3) + "s";
      s.style.animationDuration = (2 + Math.random() * 3) + "s";
      container.appendChild(s);
    }
  }

  // ------------------------------------------------------------
  // Loading screen
  // ------------------------------------------------------------
  function runLoadingScreen(messages) {
    return new Promise((resolve) => {
      const msgEl = document.getElementById("loading-msg");
      const fillEl = document.getElementById("progress-fill");
      const pctEl = document.getElementById("loading-pct");
      let pct = 0;
      let msgIndex = 0;
      msgEl.textContent = messages[0] || "loading...";

      const msgInterval = setInterval(() => {
        msgIndex = (msgIndex + 1) % messages.length;
        msgEl.textContent = messages[msgIndex];
      }, 550);

      const tick = () => {
        pct += Math.random() * 18 + 6;
        if (pct >= 100) {
          pct = 100;
          fillEl.style.width = "100%";
          pctEl.textContent = "100%";
          clearInterval(msgInterval);
          msgEl.textContent = "done. probably.";
          setTimeout(() => {
            const loadingView = document.getElementById("view-loading");
            loadingView.classList.add("fade-out");
            setTimeout(() => {
              loadingView.classList.remove("active");
              resolve();
            }, 500);
          }, 350);
          return;
        }
        fillEl.style.width = pct + "%";
        pctEl.textContent = Math.round(pct) + "%";
        setTimeout(tick, 220 + Math.random() * 200);
      };
      setTimeout(tick, 300);
    });
  }

  // ------------------------------------------------------------
  // Auth / Login
  // ------------------------------------------------------------
  function showLogin() {
    document.getElementById("view-login").classList.add("active");
  }
  function hideLogin() {
    document.getElementById("view-login").classList.remove("active");
  }
  function enterApp() {
    hideLogin();
    document.getElementById("app-shell").classList.add("active");
    document.getElementById("current-username").textContent = state.me.displayName || state.me.username;
    renderHome();
    // Quiet background fetch just to populate the unread dot — doesn't
    // touch the Messages view itself.
    api.listConversations()
      .then(({ conversations }) => { state.conversationsCache = conversations; refreshUnreadDot(); })
      .catch(() => {});
  }

  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value;
    const errEl = document.getElementById("login-error");
    const submitBtn = document.getElementById("login-submit-btn");
    errEl.textContent = "";
    submitBtn.disabled = true;
    try {
      const me = await api.login(username, password);
      state.me = me;
      state.username = me.username;
      enterApp();
    } catch (err) {
      errEl.textContent = err.message;
    } finally {
      submitBtn.disabled = false;
    }
  });

  document.getElementById("logout-btn").addEventListener("click", async () => {
    try { await api.logout(); } catch (e) { /* still reload even if this fails */ }
    location.reload();
  });

  // ------------------------------------------------------------
  // Nav
  // ------------------------------------------------------------
  const views = ["home", "gallery", "vault", "anon", "search", "profile", "messages"];
  function navigate(view) {
    views.forEach((v) => {
      document.getElementById(`view-${v}`).classList.toggle("active", v === view);
    });
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.nav === view);
    });
    if (view === "gallery") renderGallery();
    if (view === "vault") initVault();
    if (view === "anon") loadAnon();
    if (view === "search") document.getElementById("search-input").focus();
    if (view === "messages") loadConversationList();
    stopMessagesAutoRefresh();
    if (view === "messages") startMessagesAutoRefresh();
  }
  document.querySelectorAll("[data-nav]").forEach((el) => {
    el.addEventListener("click", () => navigate(el.dataset.nav));
  });
  document.getElementById("projects-btn").addEventListener("click", () => {
    window.location.href = "projects/index.html";
  });
  document.getElementById("my-profile-btn").addEventListener("click", () => {
    navigate("profile");
    openProfile(state.me.accountId);
  });

  // ------------------------------------------------------------
  // Home / wiki content
  // ------------------------------------------------------------
  function renderList(elId, items) {
    const el = document.getElementById(elId);
    el.innerHTML = "";
    (items || []).forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      el.appendChild(li);
    });
  }

  function renderHome() {
    document.title = config.pageTitle || "heyyth.";
    document.getElementById("hero-tagline").textContent = config.tagline || "";
    document.getElementById("about-content").innerHTML = (config.about || [])
      .map((p) => `<p>${escapeHtml(p)}</p>`).join("");
    renderList("interests-content", config.interests);
    renderList("favorites-content", config.favoriteThings);
    renderList("facts-content", config.randomFacts);
    renderList("currently-content", config.currentlyUpTo);

    const previewEl = document.getElementById("gallery-preview");
    previewEl.innerHTML = "";
    (config.gallery || []).slice(0, 3).forEach((item) => {
      const img = document.createElement("img");
      img.src = `gallery/images/${item.file}`;
      img.alt = item.caption || "";
      previewEl.appendChild(img);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ------------------------------------------------------------
  // Gallery
  // ------------------------------------------------------------
  function renderGallery() {
    const gallery = config.gallery || [];
    const categories = ["all", ...new Set(gallery.map((g) => g.category).filter(Boolean))];
    const filtersEl = document.getElementById("gallery-filters");
    filtersEl.innerHTML = "";
    categories.forEach((cat) => {
      const chip = document.createElement("button");
      chip.className = "filter-chip" + (cat === state.galleryFilter ? " active" : "");
      chip.textContent = cat;
      chip.addEventListener("click", () => { state.galleryFilter = cat; renderGallery(); });
      filtersEl.appendChild(chip);
    });

    const grid = document.getElementById("gallery-grid");
    grid.innerHTML = "";
    const items = gallery.filter((g) => state.galleryFilter === "all" || g.category === state.galleryFilter);
    if (!items.length) {
      grid.innerHTML = `<div class="empty-state"><span class="big">🖼️</span>nothing here yet.</div>`;
      return;
    }
    items.forEach((item) => {
      const card = document.createElement("div");
      card.className = "gallery-item";
      card.innerHTML = `
        <img src="gallery/images/${item.file}" alt="${escapeHtml(item.caption || "")}" loading="lazy" />
        <div class="gallery-item-info">
          <div class="cap">${escapeHtml(item.caption || "")}</div>
          <div class="meta">${item.date ? item.date + " · " : ""}${item.category || ""}</div>
        </div>`;
      card.addEventListener("click", () => openLightbox(`gallery/images/${item.file}`, item.caption));
      grid.appendChild(card);
    });
  }

  function openLightbox(src, caption) {
    document.getElementById("lightbox-img").src = src;
    document.getElementById("lightbox-caption").textContent = caption || "";
    document.getElementById("lightbox").classList.add("active");
  }
  document.getElementById("lightbox-close").addEventListener("click", () => {
    document.getElementById("lightbox").classList.remove("active");
  });
  document.getElementById("lightbox").addEventListener("click", (e) => {
    if (e.target.id === "lightbox") e.currentTarget.classList.remove("active");
  });

  // ------------------------------------------------------------
  // Vault
  // ------------------------------------------------------------
  let vaultActiveTab = "notes";

  async function initVault() {
    document.getElementById("vault-setup").classList.add("hidden");
    document.getElementById("vault-locked").classList.add("hidden");
    document.getElementById("vault-unlocked").classList.add("hidden");

    if (!store.hasVaultPassword(state.username)) {
      document.getElementById("vault-setup").classList.remove("hidden");
      return;
    }
    if (!store.isVaultUnlocked(state.username)) {
      document.getElementById("vault-locked").classList.remove("hidden");
      return;
    }
    showVaultUnlocked();
  }

  function showVaultUnlocked() {
    document.getElementById("vault-unlocked").classList.remove("hidden");
    loadVaultTab(vaultActiveTab);
  }

  document.getElementById("vault-create-btn").addEventListener("click", () => {
    const p1 = document.getElementById("vault-pass1").value;
    const p2 = document.getElementById("vault-pass2").value;
    const errEl = document.getElementById("vault-setup-error");
    if (!p1 || p1 !== p2) { errEl.textContent = "Passwords don't match."; return; }
    store.createVaultPassword(state.username, p1);
    document.getElementById("vault-setup").classList.add("hidden");
    showVaultUnlocked();
  });

  document.getElementById("vault-unlock-btn").addEventListener("click", () => {
    const pass = document.getElementById("vault-unlock-pass").value;
    const errEl = document.getElementById("vault-unlock-error");
    try {
      store.unlockVault(state.username, pass);
      document.getElementById("vault-locked").classList.add("hidden");
      showVaultUnlocked();
    } catch (err) {
      errEl.textContent = err.message;
    }
  });

  document.getElementById("vault-lock-btn").addEventListener("click", () => {
    store.lockVault(state.username);
    initVault();
  });

  document.querySelectorAll(".vault-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      vaultActiveTab = tab.dataset.vaultTab;
      document.querySelectorAll(".vault-tab").forEach((t) => t.classList.toggle("active", t === tab));
      document.querySelectorAll("[data-vault-panel]").forEach((p) => {
        p.classList.toggle("hidden", p.dataset.vaultPanel !== vaultActiveTab);
      });
      loadVaultTab(vaultActiveTab);
    });
  });

  document.getElementById("vault-search").addEventListener("input", () => loadVaultTab(vaultActiveTab));

  async function loadVaultTab(tab) {
    const search = document.getElementById("vault-search").value.trim().toLowerCase();
    if (tab === "notes") {
      const notes = store.listNotes(state.username);
      renderNotes(notes.filter((n) => n.name.toLowerCase().includes(search)));
    } else {
      const files = await store.listVaultFiles(state.username, tab);
      const filtered = files.filter((f) => f.name.toLowerCase().includes(search));
      if (tab === "images") await renderImages(filtered);
      else await renderFileList(tab, filtered);
    }
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function renderNotes(notes) {
    const el = document.getElementById("notes-list");
    el.innerHTML = "";
    if (!notes.length) {
      el.innerHTML = `<div class="empty-state"><span class="big">📝</span>No files here. tragic.</div>`;
      return;
    }
    notes.forEach((note) => {
      const row = document.createElement("div");
      row.className = "vault-row";
      row.innerHTML = `
        <div class="vault-row-main">
          <div>
            <div class="vault-row-name">${escapeHtml(note.name)}</div>
            <div class="vault-row-meta">${formatSize(note.size)} · ${new Date(note.modified).toLocaleString()}</div>
          </div>
        </div>
        <div class="vault-row-actions">
          <button class="icon-btn" data-action="edit" title="Edit">✎</button>
          <button class="icon-btn" data-action="delete" title="Delete">🗑</button>
        </div>`;
      row.querySelector('[data-action="edit"]').addEventListener("click", () => openNoteModal(note.name));
      row.querySelector('[data-action="delete"]').addEventListener("click", () => {
        if (!confirm(`Delete "${note.name}"?`)) return;
        store.deleteNote(state.username, note.name);
        loadVaultTab("notes");
      });
      el.appendChild(row);
    });
  }

  function revokeUrls(list) {
    list.forEach((u) => URL.revokeObjectURL(u));
    list.length = 0;
  }

  async function renderImages(images) {
    const el = document.getElementById("images-list");
    revokeUrls(state.activeImageUrls);
    el.innerHTML = "";
    if (!images.length) {
      el.innerHTML = `<div class="empty-state"><span class="big">🖼️</span>No files here. tragic.</div>`;
      return;
    }
    for (const img of images) {
      const blob = await store.getVaultFileBlob(state.username, "images", img.name);
      if (!blob) continue;
      const url = URL.createObjectURL(blob);
      state.activeImageUrls.push(url);
      const item = document.createElement("div");
      item.className = "vault-image-item";
      item.innerHTML = `<img src="${url}" alt="${escapeHtml(img.name)}" />
        <button class="icon-btn" title="Delete">🗑</button>`;
      item.querySelector("img").addEventListener("click", () => openLightbox(url, img.name));
      item.querySelector(".icon-btn").addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!confirm(`Delete "${img.name}"?`)) return;
        await store.deleteVaultFile(state.username, "images", img.name);
        loadVaultTab("images");
      });
      el.appendChild(item);
    }
  }

  async function renderFileList(type, files) {
    const el = document.getElementById(`${type}-list`);
    if (type === "audio") revokeUrls(state.activeAudioUrls);
    el.innerHTML = "";
    if (!files.length) {
      el.innerHTML = `<div class="empty-state"><span class="big">${type === "audio" ? "🎧" : "📁"}</span>No files here. tragic.</div>`;
      return;
    }
    for (const file of files) {
      const row = document.createElement("div");
      row.className = "vault-row";
      const isAudio = type === "audio";
      let audioUrl = "";
      if (isAudio) {
        const blob = await store.getVaultFileBlob(state.username, "audio", file.name);
        if (blob) { audioUrl = URL.createObjectURL(blob); state.activeAudioUrls.push(audioUrl); }
      }
      row.innerHTML = `
        <div class="vault-row-main" style="flex:1;">
          <div style="flex:1; min-width:0;">
            <div class="vault-row-name">${escapeHtml(file.name)}</div>
            <div class="vault-row-meta">${formatSize(file.size)} · ${file.ext || "file"} · ${new Date(file.modified).toLocaleDateString()}</div>
            ${isAudio && audioUrl ? `<audio controls style="width:100%; margin-top:.5em;" src="${audioUrl}"></audio>` : ""}
          </div>
        </div>
        <div class="vault-row-actions">
          <button class="icon-btn" data-action="download" title="Download">⬇</button>
          <button class="icon-btn" data-action="delete" title="Delete">🗑</button>
        </div>`;
      row.querySelector('[data-action="download"]').addEventListener("click", async () => {
        const blob = await store.getVaultFileBlob(state.username, type, file.name);
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = file.name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      });
      row.querySelector('[data-action="delete"]').addEventListener("click", async () => {
        if (!confirm(`Delete "${file.name}"?`)) return;
        await store.deleteVaultFile(state.username, type, file.name);
        loadVaultTab(type);
      });
      el.appendChild(row);
    }
  }

  // Note modal
  let editingNoteName = null;
  function openNoteModal(name) {
    editingNoteName = name || null;
    document.getElementById("note-modal").classList.remove("hidden");
    document.getElementById("note-title-input").value = name || "";
    document.getElementById("note-title-input").disabled = !!name;
    document.getElementById("note-body-input").value = name ? (store.getNote(state.username, name) || "") : "";
  }
  document.getElementById("note-new-btn").addEventListener("click", () => openNoteModal(null));
  document.getElementById("note-cancel-btn").addEventListener("click", () => {
    document.getElementById("note-modal").classList.add("hidden");
  });
  document.getElementById("note-save-btn").addEventListener("click", () => {
    let name = document.getElementById("note-title-input").value.trim();
    const content = document.getElementById("note-body-input").value;
    if (!name) return;
    if (!name.includes(".")) name += ".txt";
    store.saveNote(state.username, editingNoteName || name, content);
    document.getElementById("note-modal").classList.add("hidden");
    loadVaultTab("notes");
  });

  // Uploads (drag/drop + browse) for images/audio/files
  ["images", "audio", "files"].forEach((type) => {
    const zone = document.getElementById(`${type}-dropzone`);
    const input = document.getElementById(`${type}-input`);
    zone.addEventListener("click", (e) => { if (e.target === zone || e.target.tagName === "P") input.click(); });
    zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("drag-over"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("drag-over");
      handleUpload(type, e.dataTransfer.files);
    });
    input.addEventListener("change", () => { handleUpload(type, input.files); input.value = ""; });
  });

  async function handleUpload(type, fileList) {
    if (!fileList || !fileList.length) return;
    const progressEl = document.getElementById(`${type}-progress`);
    const row = document.createElement("div");
    row.className = "upload-progress-row";
    const total = fileList.length;
    row.textContent = `Saving ${total} file(s)...`;
    progressEl.appendChild(row);
    try {
      let done = 0;
      for (const file of Array.from(fileList)) {
        await store.saveVaultFile(state.username, type, file);
        done++;
        row.textContent = `Saving ${total} file(s)... ${Math.round((done / total) * 100)}%`;
      }
      row.textContent = `Done ✓`;
      setTimeout(() => row.remove(), 1200);
      loadVaultTab(type);
    } catch (e) {
      row.textContent = `Upload failed: ${e.message}`;
    }
  }

  // ------------------------------------------------------------
  // Anonymous messages
  // ------------------------------------------------------------
  function timeAgo(timestamp) {
    const then = new Date(timestamp.replace(" ", "T"));
    if (isNaN(then)) return timestamp;
    const diffMs = Date.now() - then.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return then.toLocaleDateString();
  }

  function loadAnon() {
    const messages = store.listAnon();
    document.getElementById("anon-count").textContent =
      messages.length ? `${messages.length} message${messages.length === 1 ? "" : "s"} — someone has opinions apparently` : "no messages yet. suspiciously quiet.";
    const el = document.getElementById("anon-list");
    el.innerHTML = "";
    if (!messages.length) {
      el.innerHTML = `<div class="empty-state"><span class="big">📭</span>nothing here yet.</div>`;
      return;
    }
    messages.forEach((m) => {
      const card = document.createElement("div");
      card.className = "anon-card";
      card.innerHTML = `
        <div class="anon-card-top">
          <span class="anon-user">${escapeHtml(m.username || "Anonymous")}</span>
          <span class="anon-time">${timeAgo(m.timestamp)}</span>
        </div>
        <p class="anon-msg">${escapeHtml(m.message)}</p>`;
      el.appendChild(card);
    });
  }

  document.getElementById("anon-refresh-btn").addEventListener("click", loadAnon);
  document.getElementById("anon-send-btn").addEventListener("click", () => {
    document.getElementById("anon-message-input").value = "";
    document.getElementById("anon-modal").classList.remove("hidden");
  });
  document.getElementById("anon-cancel-btn").addEventListener("click", () => {
    document.getElementById("anon-modal").classList.add("hidden");
  });
  document.getElementById("anon-submit-btn").addEventListener("click", () => {
    const message = document.getElementById("anon-message-input").value.trim();
    if (!message) return;
    store.appendAnon(state.username, message.slice(0, 2000));
    document.getElementById("anon-modal").classList.add("hidden");
    loadAnon();
  });

  // ------------------------------------------------------------
  // Search Accounts
  // ------------------------------------------------------------
  function renderAvatarImg(imgEl, accountId, pfpUrl) {
    if (pfpUrl) {
      // Cross-origin (frontend on GitHub Pages, backend elsewhere) —
      // needs use-credentials so the session cookie actually goes
      // along with the image request; the backend only serves this
      // to accounts allowed to see the profile it belongs to.
      imgEl.crossOrigin = "use-credentials";
      imgEl.src = api.pfpUrl(accountId);
      imgEl.onerror = () => { imgEl.removeAttribute("crossorigin"); imgEl.src = defaultAvatarDataUri(); };
    } else {
      imgEl.removeAttribute("crossorigin");
      imgEl.src = defaultAvatarDataUri();
    }
  }

  function defaultAvatarDataUri() {
    return "data:image/svg+xml," + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <rect width="100" height="100" rx="20" fill="#1d2542"/>
        <text x="50" y="62" font-size="46" text-anchor="middle" fill="#ff8fc4" font-family="sans-serif">?</text>
      </svg>`
    );
  }

  async function runSearch() {
    const q = document.getElementById("search-input").value.trim();
    const resultsEl = document.getElementById("search-results");
    if (!q) { resultsEl.innerHTML = ""; return; }
    resultsEl.innerHTML = `<p class="search-hint">searching...</p>`;
    try {
      const { results } = await api.search(q);
      if (!results.length) {
        resultsEl.innerHTML = `<div class="empty-state"><span class="big">🔎</span>nothing found (or nothing you're allowed to see).</div>`;
        return;
      }
      resultsEl.innerHTML = "";
      results.forEach((r) => {
        const card = document.createElement("div");
        card.className = "result-card";
        card.innerHTML = `
          <img class="result-avatar" alt="" />
          <div class="result-info">
            <div class="result-name">${escapeHtml(r.displayName)}</div>
            <div class="result-username">@${escapeHtml(r.username)}</div>
          </div>
          <button class="btn btn-ghost btn-sm">View</button>`;
        renderAvatarImg(card.querySelector(".result-avatar"), r.accountId, r.pfp);
        card.querySelector("button").addEventListener("click", () => {
          navigate("profile");
          openProfile(r.accountId);
        });
        resultsEl.appendChild(card);
      });
    } catch (err) {
      resultsEl.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
    }
  }
  document.getElementById("search-btn").addEventListener("click", runSearch);
  document.getElementById("search-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") runSearch();
  });

  // ------------------------------------------------------------
  // Profile (view + edit)
  // ------------------------------------------------------------
  async function openProfile(accountId) {
    state.viewingProfileId = accountId;
    const errEl = document.getElementById("profile-error");
    errEl.textContent = "";
    document.getElementById("profile-edit-mode").classList.add("hidden");
    document.getElementById("profile-view-mode").classList.remove("hidden");
    try {
      const profile = await api.getProfile(accountId);
      const isSelf = accountId === state.me.accountId;
      document.getElementById("profile-heading").textContent = isSelf ? "My Profile" : "Profile";
      document.getElementById("profile-username").textContent = "@" + profile.username;
      document.getElementById("profile-id").textContent = isSelf ? profile.accountId : "";
      document.getElementById("profile-display-name").textContent = profile.displayName;
      document.getElementById("profile-bio").textContent = profile.bio || "(no bio yet)";
      renderAvatarImg(document.getElementById("profile-avatar"), accountId, profile.pfp);
      document.getElementById("profile-avatar-edit").classList.toggle("hidden", !isSelf);
      document.getElementById("profile-message-btn").classList.toggle("hidden", isSelf);
      document.getElementById("profile-edit-btn").classList.toggle("hidden", !isSelf);
    } catch (err) {
      document.getElementById("profile-username").textContent = "";
      document.getElementById("profile-display-name").textContent = "";
      document.getElementById("profile-bio").textContent = "";
      document.getElementById("profile-avatar-edit").classList.add("hidden");
      document.getElementById("profile-message-btn").classList.add("hidden");
      document.getElementById("profile-edit-btn").classList.add("hidden");
      errEl.textContent = err.message;
    }
  }

  document.getElementById("profile-message-btn").addEventListener("click", () => {
    navigate("messages");
    openConversation(state.viewingProfileId);
  });

  document.getElementById("profile-edit-btn").addEventListener("click", () => {
    document.getElementById("profile-edit-displayname").value = document.getElementById("profile-display-name").textContent;
    const bio = document.getElementById("profile-bio").textContent;
    document.getElementById("profile-edit-bio").value = bio === "(no bio yet)" ? "" : bio;
    document.getElementById("profile-view-mode").classList.add("hidden");
    document.getElementById("profile-edit-mode").classList.remove("hidden");
  });
  document.getElementById("profile-edit-cancel").addEventListener("click", () => {
    document.getElementById("profile-edit-mode").classList.add("hidden");
    document.getElementById("profile-view-mode").classList.remove("hidden");
  });
  document.getElementById("profile-edit-save").addEventListener("click", async () => {
    const errEl = document.getElementById("profile-error");
    errEl.textContent = "";
    try {
      await api.updateProfile({
        displayName: document.getElementById("profile-edit-displayname").value.trim(),
        bio: document.getElementById("profile-edit-bio").value
      });
      document.getElementById("profile-edit-mode").classList.add("hidden");
      document.getElementById("profile-view-mode").classList.remove("hidden");
      await openProfile(state.me.accountId);
      // Refresh the nav display name too.
      const me = await api.me();
      state.me = me;
      document.getElementById("current-username").textContent = me.displayName || me.username;
    } catch (err) {
      errEl.textContent = err.message;
    }
  });

  document.getElementById("profile-pfp-input").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const errEl = document.getElementById("profile-error");
    errEl.textContent = "";
    try {
      await api.uploadPfp(file);
      await openProfile(state.me.accountId);
    } catch (err) {
      errEl.textContent = err.message;
    }
  });

  // ------------------------------------------------------------
  // Messages
  // ------------------------------------------------------------
  async function loadConversationList() {
    const listEl = document.getElementById("conversation-list");
    try {
      const { conversations } = await api.listConversations();
      state.conversationsCache = conversations;
      refreshUnreadDot();
      if (!conversations.length) {
        listEl.innerHTML = `<div class="empty-state"><span class="big">💬</span>no conversations yet.</div>`;
        return;
      }
      listEl.innerHTML = "";
      conversations.forEach((c) => {
        const row = document.createElement("div");
        row.className = "conversation-row" + (c.accountId === state.activeConversationId ? " active" : "");
        row.innerHTML = `
          <div class="conversation-row-top">
            <span class="conversation-name">${escapeHtml(c.displayName)}${c.unread ? `<span class="unread-badge">${c.unread}</span>` : ""}</span>
            <span class="conversation-time">${timeAgo(c.lastTimestamp)}</span>
          </div>
          <div class="conversation-preview">${escapeHtml(c.lastMessage)}</div>`;
        row.addEventListener("click", () => openConversation(c.accountId));
        listEl.appendChild(row);
      });
    } catch (err) {
      listEl.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
    }
  }

  async function openConversation(accountId) {
    state.activeConversationId = accountId;
    const threadEl = document.getElementById("conversation-thread");
    threadEl.innerHTML = `<div class="empty-state thread-empty">loading...</div>`;
    try {
      const [{ messages }, profile] = await Promise.all([
        api.getConversation(accountId),
        api.getProfile(accountId).catch(() => ({ displayName: accountId, username: accountId }))
      ]);
      threadEl.innerHTML = `
        <div class="thread-header">
          <span class="thread-name">${escapeHtml(profile.displayName)}</span>
          <span class="thread-username">@${escapeHtml(profile.username)}</span>
        </div>
        <div class="thread-messages" id="thread-messages"></div>
        <div class="thread-input-row">
          <input type="text" id="thread-input" placeholder="type a message..." maxlength="2000" />
          <button class="btn btn-primary btn-sm" id="thread-send-btn">Send</button>
        </div>`;
      const msgsEl = document.getElementById("thread-messages");
      if (!messages.length) {
        msgsEl.innerHTML = `<div class="empty-state thread-empty"><span class="big">👋</span>say hi.</div>`;
      } else {
        messages.forEach((m) => msgsEl.appendChild(renderMessageBubble(m)));
        msgsEl.scrollTop = msgsEl.scrollHeight;
      }

      document.getElementById("thread-send-btn").addEventListener("click", () => sendCurrentMessage(accountId));
      document.getElementById("thread-input").addEventListener("keydown", (e) => {
        if (e.key === "Enter") sendCurrentMessage(accountId);
      });

      // Mark unread messages from this account as read.
      if (messages.some((m) => m.receiver === state.me.accountId && !m.read)) {
        await api.markRead(accountId);
        loadConversationList();
      } else {
        loadConversationList();
      }
    } catch (err) {
      threadEl.innerHTML = `<div class="empty-state thread-empty">${escapeHtml(err.message)}</div>`;
    }
  }

  function renderMessageBubble(m) {
    const div = document.createElement("div");
    const mine = m.sender === state.me.accountId;
    div.className = "thread-bubble" + (mine ? " mine" : "");
    div.innerHTML = `<div class="bubble-content">${escapeHtml(m.content)}</div><div class="bubble-time">${new Date(m.timestamp).toLocaleString()}</div>`;
    return div;
  }

  async function sendCurrentMessage(accountId) {
    const input = document.getElementById("thread-input");
    const content = input.value.trim();
    if (!content) return;
    input.value = "";
    try {
      await api.sendMessage(accountId, content);
      await openConversation(accountId);
    } catch (err) {
      alert(err.message);
    }
  }

  document.getElementById("messages-refresh-btn").addEventListener("click", () => {
    loadConversationList();
    if (state.activeConversationId) openConversation(state.activeConversationId);
  });

  function refreshUnreadDot() {
    const total = state.conversationsCache.reduce((sum, c) => sum + (c.unread || 0), 0);
    document.getElementById("messages-unread-dot").classList.toggle("hidden", total === 0);
  }

  function startMessagesAutoRefresh() {
    // Gentle periodic refresh while the Messages tab is open — GitHub
    // is not a realtime database, so this is a courteous poll, not a
    // live feed. Stops the moment you navigate elsewhere.
    state.messagesRefreshTimer = setInterval(() => {
      loadConversationList();
      if (state.activeConversationId) openConversation(state.activeConversationId);
    }, 20000);
  }
  function stopMessagesAutoRefresh() {
    if (state.messagesRefreshTimer) {
      clearInterval(state.messagesRefreshTimer);
      state.messagesRefreshTimer = null;
    }
  }

  // ------------------------------------------------------------
  // Boot sequence
  // ------------------------------------------------------------
  async function boot() {
    initSparkles();
    store.seedAnonIfNeeded(config.sampleAnonMessages);
    const loadingDone = runLoadingScreen(config.loadingMessages || ["loading..."]);

    // Check for an existing backend session (httpOnly cookie) in
    // parallel with the loading animation, so we don't add extra wait.
    let me = null;
    try {
      me = await api.me();
    } catch (e) {
      me = null; // not logged in, or session expired — that's fine
    }

    await loadingDone;

    if (me) {
      state.me = me;
      state.username = me.username;
      enterApp();
    } else {
      showLogin();
    }
  }

  boot();
})();
