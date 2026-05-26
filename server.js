const http = require("http");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const publicDir = path.join(__dirname, "public");
const port = Number(process.env.PORT || 3000);
const databaseUrl = process.env.DATABASE_URL || buildRailwayDatabaseUrl();
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;
let dbReadyPromise;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".txt": "text/plain; charset=utf-8"
};

function buildRailwayDatabaseUrl() {
  const { PGUSER, POSTGRES_PASSWORD, RAILWAY_PRIVATE_DOMAIN, PGDATABASE } = process.env;
  if (!PGUSER || !POSTGRES_PASSWORD || !RAILWAY_PRIVATE_DOMAIN || !PGDATABASE) return "";
  return `postgresql://${encodeURIComponent(PGUSER)}:${encodeURIComponent(POSTGRES_PASSWORD)}@${RAILWAY_PRIVATE_DOMAIN}:5432/${encodeURIComponent(PGDATABASE)}`;
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 5_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error("Invalid JSON")); }
    });
    req.on("error", reject);
  });
}

async function ensureDb() {
  if (!pool) throw new Error("Postgres is not configured. Set DATABASE_URL or Railway PG variables.");
  dbReadyPromise ||= pool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      key text PRIMARY KEY,
      value jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  return dbReadyPromise;
}

async function handleApi(req, res) {
  try {
    if (req.url === "/api/health") {
      if (!pool) return sendJson(res, 200, { ok: true, database: "not-configured" });
      await ensureDb();
      return sendJson(res, 200, { ok: true, database: "postgres" });
    }

    if (req.url === "/api/state" && req.method === "GET") {
      await ensureDb();
      const result = await pool.query("SELECT value FROM app_state WHERE key = $1", ["commission-tracker"]);
      return sendJson(res, 200, { state: result.rows[0]?.value || null });
    }

    if (req.url === "/api/state" && req.method === "PUT") {
      await ensureDb();
      const body = await readJsonBody(req);
      if (!body || typeof body !== "object" || !Array.isArray(body.students)) {
        return sendJson(res, 400, { error: "Invalid state payload" });
      }
      await pool.query(
        `INSERT INTO app_state (key, value, updated_at) VALUES ($1, $2::jsonb, now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        ["commission-tracker", JSON.stringify(body)]
      );
      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    console.error("API error", error);
    return sendJson(res, 500, { error: error.message || "Server error" });
  }
}

function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const requested = normalized === "/" ? "/index.html" : normalized;
  const filePath = path.join(publicDir, requested);
  if (!filePath.startsWith(publicDir)) return null;
  return filePath;
}

const server = http.createServer((req, res) => {
  if ((req.url || "").startsWith("/api/")) {
    handleApi(req, res);
    return;
  }

  const filePath = resolveFile(req.url || "/");
  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      fs.readFile(path.join(publicDir, "index.html"), (fallbackError, fallback) => {
        if (fallbackError) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        res.writeHead(200, { "content-type": mimeTypes[".html"] });
        res.end(fallback);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "content-type": mimeTypes[ext] || "application/octet-stream",
      "cache-control": ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable"
    });
    res.end(data);
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`wu.autotask.solutions site listening on ${port}`);
  console.log(pool ? "Postgres persistence enabled" : "Postgres persistence disabled: DATABASE_URL / PG vars missing");
});
