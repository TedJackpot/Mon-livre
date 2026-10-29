const $ = (selector, root = document) => root.querySelector(selector);
const app = $("#app");
const dialog = $("#account-dialog");
const toastNode = $("#toast");
const CATALOGUES = [
  ["Canva · Livres photo", "Albums, récits de voyage, famille et portfolio.", "https://www.canva.com/photo-books/templates/"],
  ["Canva · Couvertures", "Couvertures de livres, romans et albums.", "https://www.canva.com/book-covers/templates/"],
  ["Adobe Express · Livres", "Modèles de livre à personnaliser dans Express.", "https://www.adobe.com/express/templates/book"],
  ["Adobe Express · Couvertures", "Couvertures modifiables avec le filtre gratuit.", "https://www.adobe.com/express/templates/cover"],
];
const LAYOUTS = [
  ["image-right", "Récit illustré", "Texte à gauche · image à droite"],
  ["image-top", "Album photo", "Image au premier plan"],
  ["text-only", "Page texte", "Une page épurée pour le récit"],
  ["full-image", "Image pleine page", "Une image en grand format"],
];
const COVER_STYLES = [["classic", "Classique"], ["atelier", "Atelier"], ["botanical", "Botanique"], ["midnight", "Nuit"], ["terracotta", "Terre cuite"]];
const PALETTES = ["#fffdf8", "#f4e7dc", "#edf0e8", "#f1e3e2", "#e9edf2", "#f6f0d9"];
let account = null;
let panel = "layout";
let pageIndex = 0;
let installPrompt = null;
let saveTimer;
let toastTimer;
let book = makeBook();

function makePage() {
  return { id: crypto.randomUUID(), heading: "Nouveau chapitre", text: "", image: "", layout: "image-right", color: PALETTES[0], bookmark: false };
}
function makeBook() {
  return { id: crypto.randomUUID(), title: "Mon premier livre", subtitle: "Une histoire à composer", author: "", cover: "classic", font: "serif", pages: [{ ...makePage(), heading: "Le début de votre histoire", text: "Ajoutez ici votre texte, puis donnez-lui la forme d’un livre. Importez vos images, choisissez une maquette et ajustez chaque détail." }] };
}
function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}
function currentPage() { return book.pages[pageIndex] || book.pages[0]; }
function notify(message) {
  toastNode.textContent = message;
  toastNode.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastNode.classList.remove("visible"), 3000);
}
function openLocalDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("mon-livre-local", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("documents");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function localRead(key) {
  try {
    const db = await openLocalDB();
    return await new Promise((resolve, reject) => {
      const request = db.transaction("documents").objectStore("documents").get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch {
    try { return JSON.parse(localStorage.getItem(`mon-livre:${key}`) || "null"); } catch { return null; }
  }
}
async function localWrite(key, value) {
  try {
    const db = await openLocalDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction("documents", "readwrite");
      tx.objectStore("documents").put(value, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    try { localStorage.setItem(`mon-livre:${key}`, JSON.stringify(value)); }
    catch { notify("Stockage local plein. Exportez votre livre pour le conserver."); }
  }
}
function persistDraft() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => localWrite("draft", book), 250);
}
async function api(path, options = {}) {
  const response = await fetch(path, { credentials: "same-origin", ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Connexion au serveur local impossible.");
  return data;
}
function update(change) {
  book = { ...book, ...change };
  persistDraft();
}
function updatePage(change) {
  book = { ...book, pages: book.pages.map((page, i) => i === pageIndex ? { ...page, ...change } : page) };
  persistDraft();
}
function escapeAttr(value) { return escapeHTML(value).replace(/\n/g, "&#10;"); }

function render() {
  const page = currentPage();
  app.dataset.panel = panel;
  const layoutList = LAYOUTS.map(([id, title, description]) => `
    <button class="layout-card ${page.layout === id ? "selected" : ""}" data-layout="${id}">
      <span class="layout-swatch ${id}"><i></i></span><b>${title}</b><small>${description}</small>
    </button>`).join("");
  const coverButtons = COVER_STYLES.map(([id, label]) => `<button class="choice ${book.cover === id ? "selected" : ""}" data-cover="${id}">${label}<span>${book.cover === id ? "✓" : ""}</span></button>`).join("");
  const nav = [["layout", "Maquettes", "▧"], ["text", "Textes", "T"], ["images", "Images", "▤"], ["cover", "Couverture", "▣"], ["catalogues", "Modèles gratuits", "✦"]];
  const navHtml = nav.map(([id, label, icon]) => `<button class="rail-button ${panel === id ? "active" : ""}" data-panel="${id}"><span aria-hidden="true">${icon}</span>${label}</button>`).join("");
  const imageHtml = page.image ? `<img class="spread-image" src="${page.image}" alt="Illustration de la page">` : `<button class="image-placeholder" data-action="upload"><span>＋</span><b>Ajouter une illustration</b><small>PNG, JPG ou image créée</small><em>Importer une image</em></button>`;
  const pagesHtml = book.pages.map((item, i) => `<button class="page-thumb ${i === pageIndex ? "current" : ""}" data-page="${i}"><span>${item.image ? `<img src="${item.image}" alt="">` : ""}</span><b>${String(i + 1).padStart(2, "0")}</b></button>`).join("");
  const panelTitle = { layout: "Mise en page", text: "Typographie", images: "Bibliothèque", cover: "Couverture", catalogues: "Modèles gratuits" }[panel];
  const panelContent = panel === "layout" ? `
    <label class="section-label">CHOISIR UNE MAQUETTE</label><div class="layout-list">${layoutList}</div>
    <label class="section-label">AMBIANCE DE PAGE</label><div class="swatches">${PALETTES.map((color) => `<button class="swatch ${page.color === color ? "chosen" : ""}" style="--swatch:${color}" data-color="${color}" aria-label="Couleur ${color}"></button>`).join("")}</div>
    <label class="section-label">OUTILS DE PAGE</label>
    <button class="text-action" data-action="duplicate">＋ Dupliquer cette page</button>
    <button class="text-action" data-action="delete" ${book.pages.length < 2 ? "disabled" : ""}>⌫ Supprimer cette page</button>` : "";
  const textContent = panel === "text" ? `
    <label class="section-label" for="chapter-heading">TITRE DE LA PAGE</label><input id="chapter-heading" class="field" value="${escapeAttr(page.heading)}" placeholder="Titre du chapitre">
    <label class="section-label" for="chapter-copy">TEXTE</label><textarea id="chapter-copy" class="field body-field" placeholder="Écrivez ou collez votre texte…">${escapeHTML(page.text)}</textarea>
    <label class="section-label">POLICE DU TEXTE</label><button class="choice ${book.font === "serif" ? "selected" : ""}" data-font="serif">Édition littéraire <span>${book.font === "serif" ? "✓" : ""}</span></button><button class="choice ${book.font === "sans" ? "selected" : ""}" data-font="sans">Sans empattement <span>${book.font === "sans" ? "✓" : ""}</span></button>` : "";
  const imageContent = panel === "images" ? `
    <label class="section-label">AJOUTER UNE IMAGE</label><button class="upload-card" data-action="upload"><span>↑</span><b>Choisir une image</b><small>Import local, sans envoi à un service externe.</small></button>
    ${page.image ? `<div class="asset"><img src="${page.image}" alt=""><button class="text-action" data-action="remove-image">Supprimer l’image</button></div>` : `<p class="tip">Les images sont enregistrées avec le livre dans la base locale de cette installation.</p>`}` : "";
  const coverContent = panel === "cover" ? `
    <label class="section-label">MODÈLE DE COUVERTURE</label><div class="cover-picker">${coverButtons}</div>
    <label class="section-label" for="book-subtitle">SOUS-TITRE</label><input id="book-subtitle" class="field" value="${escapeAttr(book.subtitle)}" placeholder="Sous-titre">
    <label class="section-label" for="book-author">AUTEUR·RICE</label><input id="book-author" class="field" value="${escapeAttr(book.author)}" placeholder="Votre nom">` : "";
  const cataloguesContent = panel === "catalogues" ? `
    <p class="tip">Les modèles s’ouvrent sur leur plateforme d’origine. Choisissez un modèle portant le badge « gratuit ».</p>
    ${CATALOGUES.map(([title, description, url]) => `<a class="catalogue-card" href="${url}" target="_blank" rel="noopener noreferrer"><b>${title}</b><small>${description}</small><span>Ouvrir ↗</span></a>`).join("")}
    <p class="fine-print">Le catalogue externe n’est pas téléchargé dans Mon Livre. Vous pouvez composer vos pages directement dans cette app.</p>` : "";
  const words = book.pages.reduce((total, item) => total + (item.text.trim() ? item.text.trim().split(/\s+/).length : 0), 0);
  app.innerHTML = `
    <header class="topbar">
      <a class="brand" href="/"><span class="brand-icon">▤</span><span><b>Mon Livre</b><small>STUDIO ÉDITORIAL</small></span></a>
      <div class="project-name"><i></i><span id="display-title">${escapeHTML(book.title || "Sans titre")}</span></div>
      <div class="top-actions"><button class="quiet-button" id="install-button" hidden>Installer l’app</button><button class="quiet-button" data-action="export">Exporter</button><button class="account-button" data-action="account">${account ? escapeHTML(account.displayName) : "Compte"}</button><button class="save-button" data-action="save">Enregistrer</button></div>
    </header>
    <div class="workspace">
      <aside class="rail"><div class="rail-label">VOTRE LIVRE</div>${navHtml}<hr><div class="rail-label">MES PROJETS</div><div id="project-list" class="project-list"><small>${account ? "Chargement des projets…" : "Vos livres restent sur cet appareil."}</small></div><div class="rail-foot">${account ? "Compte local actif" : "Mode local"}<small>Vos données restent sur cet appareil.</small></div></aside>
      <main class="editor">
        <div class="editor-heading"><div><small>ATELIER DE MISE EN PAGE</small><input id="book-title" value="${escapeAttr(book.title)}" aria-label="Titre du livre"></div><span class="local-indicator"><i></i> Brouillon local</span></div>
        <div class="toolbar"><div><button data-panel="layout">▧ Modèle</button><button data-panel="text">T Texte</button><button data-action="upload">＋ Image</button></div><div class="page-nav"><span>${String(pageIndex + 1).padStart(2, "0")} / ${String(book.pages.length).padStart(2, "0")}</span><button data-action="previous" ${pageIndex === 0 ? "disabled" : ""}>‹</button><button data-action="next" ${pageIndex === book.pages.length - 1 ? "disabled" : ""}>›</button></div></div>
        <section class="stage"><div class="spread layout-${page.layout} ${page.bookmark ? "has-bookmark" : ""}">
          <article class="paper" style="--paper:${page.color};--book-font:${book.font === "sans" ? "Arial, sans-serif" : "Georgia, serif"}"><div class="paper-top"><span>MON LIVRE</span><span>${String(pageIndex + 1).padStart(2, "0")}</span></div><input id="preview-heading" value="${escapeAttr(page.heading)}" placeholder="Titre du chapitre" aria-label="Titre de page"><div class="preview-copy">${escapeHTML(page.text || "Votre texte apparaîtra ici…")}</div><small class="page-no">${pageIndex + 1}</small></article>
          <div class="spine"></div><div class="illustration">${imageHtml}<button class="bookmark ${page.bookmark ? "marked" : ""}" data-action="bookmark" aria-label="Marque-page">▾</button>${page.image ? `<button class="remove-image" data-action="remove-image" aria-label="Retirer l’image">×</button>` : ""}</div>
          <section class="cover-preview ${`cover-${book.cover}`}"><small>MON LIVRE</small><strong>${escapeHTML(book.title || "Votre titre")}</strong><span>${escapeHTML(book.subtitle || "Sous-titre")}</span><em>${escapeHTML(book.author || "Votre nom")}</em></section>
        </div></section>
        <div class="pages-strip"><div><b>VOS PAGES</b><small>${book.pages.length} page${book.pages.length > 1 ? "s" : ""}</small></div><div class="thumbs">${pagesHtml}</div><button class="add-page" data-action="add-page">＋ Ajouter une page</button></div>
        <footer class="editor-footer"><span>${words} mots · ${book.pages.length} page${book.pages.length > 1 ? "s" : ""}</span><div><button data-action="print">Imprimer / PDF</button><button data-action="export">Exporter JSON</button></div></footer>
      </main>
      <aside class="inspector"><small class="inspector-kicker">PERSONNALISATION</small><h2>${panelTitle}</h2>${panelContent}<div class="inspector-bottom"><span>Enregistrement local automatique</span><button data-action="save">Enregistrer le projet</button></div></aside>
    </div>
    <input type="file" id="image-file" accept="image/*" hidden>
  `;
  bindEvents();
  if (account) loadProjects();
}

function bindEvents() {
  app.querySelectorAll("[data-panel]").forEach((button) => button.addEventListener("click", () => { panel = button.dataset.panel; render(); }));
  app.querySelectorAll("[data-layout]").forEach((button) => button.addEventListener("click", () => { updatePage({ layout: button.dataset.layout }); render(); }));
  app.querySelectorAll("[data-color]").forEach((button) => button.addEventListener("click", () => { updatePage({ color: button.dataset.color }); render(); }));
  app.querySelectorAll("[data-cover]").forEach((button) => button.addEventListener("click", () => { update({ cover: button.dataset.cover }); render(); }));
  app.querySelectorAll("[data-font]").forEach((button) => button.addEventListener("click", () => { update({ font: button.dataset.font }); render(); }));
  app.querySelectorAll("[data-page]").forEach((button) => button.addEventListener("click", () => { pageIndex = Number(button.dataset.page); render(); }));
  $("#book-title")?.addEventListener("input", (event) => { book.title = event.target.value; $("#display-title").textContent = book.title || "Sans titre"; persistDraft(); });
  $("#preview-heading")?.addEventListener("input", (event) => { updatePage({ heading: event.target.value }); const field = $("#chapter-heading"); if (field) field.value = event.target.value; });
  $("#chapter-heading")?.addEventListener("input", (event) => { updatePage({ heading: event.target.value }); const field = $("#preview-heading"); if (field) field.value = event.target.value; });
  $("#chapter-copy")?.addEventListener("input", (event) => { updatePage({ text: event.target.value }); const preview = $(".preview-copy"); if (preview) preview.textContent = event.target.value || "Votre texte apparaîtra ici…"; });
  $("#book-subtitle")?.addEventListener("input", (event) => { update({ subtitle: event.target.value }); const preview = $(".cover-preview span"); if (preview) preview.textContent = event.target.value || "Sous-titre"; });
  $("#book-author")?.addEventListener("input", (event) => { update({ author: event.target.value }); const preview = $(".cover-preview em"); if (preview) preview.textContent = event.target.value || "Votre nom"; });
  $("#image-file")?.addEventListener("change", (event) => importImage(event.target.files?.[0]));
  app.querySelectorAll('[data-action="upload"]').forEach((button) => button.addEventListener("click", () => $("#image-file")?.click()));
  app.querySelectorAll('[data-action="bookmark"]').forEach((button) => button.addEventListener("click", () => { updatePage({ bookmark: !currentPage().bookmark }); render(); }));
  app.querySelectorAll('[data-action="remove-image"]').forEach((button) => button.addEventListener("click", () => { updatePage({ image: "" }); render(); }));
  app.querySelectorAll('[data-action="add-page"]').forEach((button) => button.addEventListener("click", () => { book.pages.push(makePage()); pageIndex = book.pages.length - 1; persistDraft(); render(); }));
  app.querySelectorAll('[data-action="duplicate"]').forEach((button) => button.addEventListener("click", () => { book.pages.splice(pageIndex + 1, 0, { ...currentPage(), id: crypto.randomUUID() }); pageIndex++; persistDraft(); render(); }));
  app.querySelectorAll('[data-action="delete"]').forEach((button) => button.addEventListener("click", () => { if (book.pages.length > 1) { book.pages.splice(pageIndex, 1); pageIndex = Math.max(0, pageIndex - 1); persistDraft(); render(); } }));
  app.querySelectorAll('[data-action="previous"]').forEach((button) => button.addEventListener("click", () => { pageIndex = Math.max(0, pageIndex - 1); render(); }));
  app.querySelectorAll('[data-action="next"]').forEach((button) => button.addEventListener("click", () => { pageIndex = Math.min(book.pages.length - 1, pageIndex + 1); render(); }));
  app.querySelectorAll('[data-action="save"]').forEach((button) => button.addEventListener("click", saveProject));
  app.querySelectorAll('[data-action="export"]').forEach((button) => button.addEventListener("click", exportBook));
  app.querySelectorAll('[data-action="print"]').forEach((button) => button.addEventListener("click", () => window.print()));
  app.querySelectorAll('[data-action="account"]').forEach((button) => button.addEventListener("click", openAccount));
}

async function importImage(file) {
  if (!file) return;
  try {
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Lecture de l’image impossible."));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error("Format d’image non reconnu."));
        image.onload = () => {
          const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
          const canvas = document.createElement("canvas"); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
          const context = canvas.getContext("2d");
          if (!context) return reject(new Error("Traitement d’image indisponible."));
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.78));
        };
        image.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
    updatePage({ image: data }); panel = "images"; render(); notify("Image ajoutée au livre.");
  } catch (error) { notify(error.message); }
}

function exportBook() {
  const url = URL.createObjectURL(new Blob([JSON.stringify(book, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${(book.title || "mon-livre").replace(/[^\p{L}\p{N}-]+/gu, "-")}.json`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function saveProject() {
  persistDraft();
  if (!account) return openAccount("register");
  try {
    await api(`/api/projects/${book.id}`, { method: "PUT", body: JSON.stringify({ document: book }) });
    notify("Livre enregistré dans la base locale.");
    loadProjects();
  } catch (error) { notify(`Brouillon gardé sur cet appareil. ${error.message}`); }
}

async function loadProjects() {
  const list = $("#project-list");
  if (!list || !account) return;
  try {
    const { projects } = await api("/api/projects");
    list.innerHTML = projects.length ? projects.map((project) => `<button class="project-link" data-open-project="${project.id}">${escapeHTML(project.title)}</button>`).join("") : "<small>Aucun livre enregistré.</small>";
    list.querySelectorAll("[data-open-project]").forEach((button) => button.addEventListener("click", () => openProject(button.dataset.openProject)));
  } catch { list.innerHTML = "<small>Serveur local indisponible.</small>"; }
}

async function openProject(id) {
  try {
    const result = await api(`/api/projects/${id}`);
    book = { ...result.document, id: result.id };
    pageIndex = 0; panel = "layout"; persistDraft(); render(); notify("Livre ouvert.");
  } catch (error) { notify(error.message); }
}

function openAccount(mode = "login") {
  if (account) {
    dialog.innerHTML = `<div class="dialog-head"><div><small>ESPACE LOCAL</small><h2 id="account-title">${escapeHTML(account.displayName)}</h2></div><button class="dialog-close" data-close>×</button></div><p class="dialog-copy">Compte conservé sur cet ordinateur. Les données ne sont envoyées vers aucun serveur externe.</p><p class="dialog-email">${escapeHTML(account.email)}</p><button class="dialog-submit secondary" id="logout-button">Se déconnecter</button>`;
    dialog.showModal();
    $(`[data-close]`, dialog).addEventListener("click", () => dialog.close());
    $("#logout-button", dialog).addEventListener("click", async () => { await api("/api/logout", { method: "POST", body: "{}" }).catch(() => {}); account = null; dialog.close(); render(); notify("Session fermée."); });
    return;
  }
  renderAccountForm(mode);
}

function renderAccountForm(mode = "login", error = "") {
  const registering = mode === "register";
  dialog.innerHTML = `<div class="dialog-head"><div><small>VOTRE ESPACE ÉDITORIAL</small><h2 id="account-title">${registering ? "Créer un compte local" : "Se connecter"}</h2></div><button class="dialog-close" data-close>×</button></div>
    <p class="dialog-copy">Ce compte et les livres sont stockés uniquement dans la base SQLite de cette installation.</p>
    ${error ? `<div class="form-error">${escapeHTML(error)}</div>` : ""}
    <form id="account-form" class="account-form">${registering ? `<label>Nom affiché<input name="displayName" required maxlength="60" autocomplete="name"></label>` : ""}<label>Adresse e-mail<input name="email" type="email" required autocomplete="email"></label><label>Mot de passe<input name="password" type="password" required minlength="${registering ? 10 : 1}" autocomplete="${registering ? "new-password" : "current-password"}"></label>${registering ? `<small>10 caractères minimum.</small>` : ""}<button class="dialog-submit">${registering ? "Créer mon compte" : "Se connecter"}</button></form>
    <button class="mode-switch" id="switch-mode">${registering ? "J’ai déjà un compte" : "Créer un compte local"}</button>`;
  dialog.showModal();
  $(`[data-close]`, dialog).addEventListener("click", () => dialog.close());
  $("#switch-mode", dialog).addEventListener("click", () => renderAccountForm(registering ? "login" : "register"));
  $("#account-form", dialog).addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    try {
      const result = await api(registering ? "/api/register" : "/api/login", { method: "POST", body: JSON.stringify(payload) });
      account = result.user; dialog.close(); render(); notify(registering ? "Compte local créé." : "Connexion réussie.");
    } catch (submitError) { renderAccountForm(mode, submitError.message); }
  });
}

async function init() {
  const savedDraft = await localRead("draft");
  if (savedDraft?.pages?.length) book = savedDraft;
  try { account = (await api("/api/session")).user; } catch { account = null; }
  render();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); installPrompt = event;
    const button = $("#install-button"); if (button) button.hidden = false;
  });
  document.addEventListener("click", async (event) => {
    if (event.target.closest("#install-button")) {
      if (!installPrompt) return notify("Dans le menu du navigateur, choisissez « Installer l’application ».");
      await installPrompt.prompt(); installPrompt = null; $("#install-button").hidden = true;
    }
  });
}

init();
