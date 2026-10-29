import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const dataDir = join(root, "app-data");
const publicDir = join(root, "public");
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(join(dataDir, "mon-livre.sqlite"));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL COLLATE NOCASE,
    display_name TEXT NOT NULL, salt BLOB NOT NULL, password_hash BLOB NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL, document TEXT NOT NULL, updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS projects_by_user ON projects(user_id, updated_at DESC);
`);

const COOKIE = "monlivre_session";
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const server = createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  try {
    if (req.url?.startsWith("/api/")) await routeApi(req, res);
    else serveStatic(req, res);
  } catch (error) {
    console.error(error);
    json(res, 500, { error: "Une erreur est survenue. Réessayez." });
  }
});

function json(res, status, value) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(value));
}

function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map((part) => {
    const i = part.indexOf("=");
    return i < 0 ? ["", ""] : [part.slice(0, i).trim(), decodeURIComponent(part.slice(i + 1).trim())];
  }).filter(([key]) => key));
}

function body(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 10_000_000) {
        reject(new Error("Le fichier envoyé est trop volumineux."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { reject(new Error("Données invalides.")); }
    });
    req.on("error", reject);
  });
}

function currentUser(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (!token) return null;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const session = db.prepare("SELECT user_id, expires_at FROM sessions WHERE token_hash = ?").get(tokenHash);
  if (!session || session.expires_at < Date.now()) {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
    return null;
  }
  return db.prepare("SELECT id, email, display_name FROM users WHERE id = ?").get(session.user_id) || null;
}

function issueSession(res, userId) {
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  const expires = Date.now() + SESSION_MS;
  db.prepare("INSERT INTO sessions(token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(hash, userId, expires);
  res.setHeader("Set-Cookie", `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MS / 1000}`);
}

function clearSession(req, res) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(createHash("sha256").update(token).digest("hex"));
  res.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  return !origin || new URL(origin).host === req.headers.host;
}

async function routeApi(req, res) {
  if (!["GET", "HEAD"].includes(req.method) && !sameOrigin(req)) return json(res, 403, { error: "Origine de requête refusée." });
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const path = url.pathname;

  if (req.method === "GET" && path === "/api/health") return json(res, 200, { ok: true, storage: "SQLite local" });
  if (req.method === "GET" && path === "/api/session") {
    const user = currentUser(req);
    return json(res, 200, { user: user ? { id: user.id, email: user.email, displayName: user.display_name } : null });
  }
  if (req.method === "POST" && path === "/api/register") {
    const input = await body(req);
    const email = String(input.email || "").trim().toLowerCase();
    const displayName = String(input.displayName || "").trim().slice(0, 60);
    const password = String(input.password || "");
    if (!/^\S+@\S+\.\S+$/.test(email) || !displayName || password.length < 10 || password.length > 200)
      return json(res, 400, { error: "Indiquez un nom, un e-mail valide et un mot de passe de 10 caractères minimum." });
    const salt = randomBytes(16);
    const passwordHash = scryptSync(password, salt, 64);
    const id = randomUUID();
    try {
      db.prepare("INSERT INTO users(id,email,display_name,salt,password_hash,created_at) VALUES(?,?,?,?,?,?)")
        .run(id, email, displayName, salt, passwordHash, Date.now());
    } catch {
      return json(res, 409, { error: "Un compte existe déjà avec cette adresse e-mail." });
    }
    issueSession(res, id);
    return json(res, 201, { user: { id, email, displayName } });
  }
  if (req.method === "POST" && path === "/api/login") {
    const input = await body(req);
    const email = String(input.email || "").trim().toLowerCase();
    const password = String(input.password || "");
    const user = db.prepare("SELECT id,email,display_name,salt,password_hash FROM users WHERE email = ?").get(email);
    if (!user || password.length > 200) return json(res, 401, { error: "Adresse e-mail ou mot de passe incorrect." });
    const expected = Buffer.from(user.password_hash);
    const actual = scryptSync(password, Buffer.from(user.salt), expected.length);
    if (!timingSafeEqual(expected, actual)) return json(res, 401, { error: "Adresse e-mail ou mot de passe incorrect." });
    issueSession(res, user.id);
    return json(res, 200, { user: { id: user.id, email: user.email, displayName: user.display_name } });
  }
  if (req.method === "POST" && path === "/api/logout") {
    clearSession(req, res);
    return json(res, 200, { ok: true });
  }

  const user = currentUser(req);
  if (!user) return json(res, 401, { error: "Connectez-vous pour accéder à vos livres." });
  if (req.method === "GET" && path === "/api/projects") {
    const projects = db.prepare("SELECT id,title,updated_at AS updatedAt FROM projects WHERE user_id = ? ORDER BY updated_at DESC").all(user.id);
    return json(res, 200, { projects });
  }
  const match = path.match(/^\/api\/projects\/([a-f0-9-]{36})$/i);
  if (match && req.method === "GET") {
    const project = db.prepare("SELECT id,title,document,updated_at AS updatedAt FROM projects WHERE id = ? AND user_id = ?").get(match[1], user.id);
    if (!project) return json(res, 404, { error: "Livre introuvable." });
    return json(res, 200, { ...project, document: JSON.parse(project.document) });
  }
  if (match && req.method === "PUT") {
    const input = await body(req);
    const document = input.document;
    if (!document || typeof document !== "object" || !Array.isArray(document.pages) || document.pages.length > 300)
      return json(res, 400, { error: "Structure du livre invalide." });
    const text = JSON.stringify(document);
    if (Buffer.byteLength(text, "utf8") > 8_000_000) return json(res, 413, { error: "Le livre est trop volumineux pour être sauvegardé." });
    const id = match[1];
    const title = String(document.title || "Sans titre").trim().slice(0, 180) || "Sans titre";
    const existing = db.prepare("SELECT id FROM projects WHERE id = ? AND user_id = ?").get(id, user.id);
    if (existing) db.prepare("UPDATE projects SET title = ?, document = ?, updated_at = ? WHERE id = ? AND user_id = ?").run(title, text, Date.now(), id, user.id);
    else db.prepare("INSERT INTO projects(id,user_id,title,document,updated_at) VALUES(?,?,?,?,?)").run(id, user.id, title, text, Date.now());
    return json(res, 200, { ok: true, id, title });
  }
  if (match && req.method === "DELETE") {
    db.prepare("DELETE FROM projects WHERE id = ? AND user_id = ?").run(match[1], user.id);
    return json(res, 200, { ok: true });
  }
  return json(res, 404, { error: "Route API introuvable." });
}

function serveStatic(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    return res.end("Méthode non autorisée");
  }
  const path = new URL(req.url, "http://localhost").pathname;
  const safePath = path.split("/").filter(Boolean).join("/");
  const candidate = join(publicDir, safePath || "index.html");
  if (!candidate.startsWith(publicDir)) {
    res.writeHead(404); return res.end();
  }
  import("node:fs").then(({ createReadStream, existsSync, statSync }) => {
    let file = candidate;
    if (!existsSync(file) || !statSync(file).isFile()) file = join(publicDir, "index.html");
    const types = { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".svg":"image/svg+xml", ".webmanifest":"application/manifest+json", ".json":"application/json", ".png":"image/png" };
    const ext = file.slice(file.lastIndexOf("."));
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream", "Cache-Control": file.endsWith("service-worker.js") ? "no-cache" : "public, max-age=3600" });
    if (req.method === "HEAD") return res.end();
    createReadStream(file).pipe(res);
  }).catch(() => { res.writeHead(500); res.end(); });
}

const port = Number(process.env.PORT || 4321);
server.listen(port, "0.0.0.0", () => {
  console.log(`Mon Livre est prêt : http://localhost:${port}`);
  console.log(`Données locales : ${join(dataDir, "mon-livre.sqlite")}`);
});
