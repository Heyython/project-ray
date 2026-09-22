(() => {
  const config = window.SITE_CONFIG || { projects: [] };
  const grid = document.getElementById("hub-grid");
  grid.innerHTML = "";
  (config.projects || []).forEach((p) => {
    const card = document.createElement("a");
    card.className = "hub-card";
    card.href = `${p.id}.html`;
    card.style.setProperty("--accent", p.color || "#ff8fc4");
    card.innerHTML = `<h2>${p.name}</h2><p>${p.tagline}</p><span class="arrow">→</span>`;
    grid.appendChild(card);
  });
})();
