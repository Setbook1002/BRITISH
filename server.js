const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data", "cases.json");
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf"
};

function setCORSHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}

function ensureDataFile() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, "[]");
  }
}

function loadCases() {
  ensureDataFile();
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return [];
  }
}

let cases = loadCases();

function saveCases() {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(cases, null, 2));
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(JSON.stringify(payload));
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    res.writeHead(200, { 
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*"
    });
    res.end(content);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function getCaseSummary(entry) {
  return {
    id: entry.id,
    type: entry.type,
    status: entry.status,
    submittedAt: entry.submittedAt,
    name: entry.data?.full_name || null,
    email: entry.data?.email || null,
    orderNumber: entry.data?.order_number || entry.data?.order || null
  };
}

function buildTimeline(entry) {
  return [
    "Case logged successfully",
    entry.type === "wizard" ? "Assigned to the UK resolutions desk" : "Review request received",
    entry.status
  ];
}

const server = http.createServer(async (req, res) => {
  setCORSHeaders(res);

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  // Handle OPTIONS requests for CORS
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === "GET" && pathname === "/health") {
    sendJson(res, 200, { status: "ok", timestamp: new Date().toISOString() });
    return;
  }

  if (req.method === "GET" && pathname === "/api/cases") {
    sendJson(res, 200, { 
      success: true, 
      count: cases.length,
      cases: cases.slice(0, 50).map(getCaseSummary)
    });
    return;
  }

  if (req.method === "GET" && pathname.startsWith("/api/cases/")) {
    const caseId = pathname.replace("/api/cases/", "");
    const found = cases.find((c) => c.id === caseId);
    if (!found) {
      sendJson(res, 404, { success: false, message: "Case not found" });
      return;
    }
    sendJson(res, 200, { 
      success: true, 
      case: getCaseSummary(found),
      timeline: buildTimeline(found),
      details: found.data
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/submit") {
    try {
      const body = await readBody(req);
      const payload = body ? JSON.parse(body) : {};
      const formType = payload.formType === "wizard" ? "wizard" : "complaint";
      const data = payload.data || {};

      if (!data.full_name || !data.email || !data.order_number) {
        sendJson(res, 400, { success: false, message: "Please complete the required fields before submitting." });
        return;
      }

      const entry = {
        id: `BHD-${Date.now().toString(36).toUpperCase()}`,
        type: formType,
        status: "Received",
        submittedAt: new Date().toISOString(),
        data
      };

      cases.unshift(entry);
      saveCases();

      sendJson(res, 200, {
        success: true,
        caseId: entry.id,
        message: formType === "wizard"
          ? "Your support case has been received by the resolutions desk."
          : "Your complaint has been received and will be reviewed shortly."
      });
    } catch (error) {
      console.error("Submit error:", error);
      sendJson(res, 500, { success: false, message: "The server could not process the form. Please try again." });
    }
    return;
  }

  if (req.method === "POST" && pathname === "/api/track") {
    try {
      const body = await readBody(req);
      const payload = body ? JSON.parse(body) : {};
      const name = (payload.name || "").trim().toLowerCase();
      const email = (payload.email || "").trim().toLowerCase();
      const order = (payload.order || "").trim().toLowerCase();

      if (!name && !email && !order) {
        sendJson(res, 400, { success: false, message: "Please provide at least one search criterion." });
        return;
      }

      const found = cases.find((entry) => {
        const entryName = (entry.data?.full_name || "").trim().toLowerCase();
        const entryEmail = (entry.data?.email || "").trim().toLowerCase();
        const entryOrder = (entry.data?.order_number || entry.data?.order || "").trim().toLowerCase();
        return (!name || entryName === name) && (!email || entryEmail === email) && (!order || entryOrder === order);
      });

      if (!found) {
        sendJson(res, 404, {
          success: false,
          message: "We could not find a matching case. Please double-check your details or contact support."
        });
        return;
      }

      sendJson(res, 200, {
        success: true,
        case: getCaseSummary(found),
        timeline: buildTimeline(found),
        message: "Case details retrieved successfully."
      });
    } catch (error) {
      console.error("Track error:", error);
      sendJson(res, 500, { success: false, message: "The tracking lookup could not be completed." });
    }
    return;
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/cases/")) {
    const caseId = pathname.replace("/api/cases/", "");
    const index = cases.findIndex((c) => c.id === caseId);
    if (index === -1) {
      sendJson(res, 404, { success: false, message: "Case not found" });
      return;
    }
    cases.splice(index, 1);
    saveCases();
    sendJson(res, 200, { success: true, message: "Case deleted successfully" });
    return;
  }

  if (req.method === "GET") {
    const filePath = pathname === "/" ? path.join(__dirname, "index.html") : path.join(__dirname, pathname.replace(/^\//, ""));
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      sendFile(res, filePath);
      return;
    }
  }

  sendJson(res, 404, { success: false, message: "Route not found." });
});

server.listen(PORT, () => {
  console.log(`\n✓ Support hub running at http://localhost:${PORT}`);
  console.log(`  - Main: http://localhost:${PORT}`);
  console.log(`  - Health check: http://localhost:${PORT}/health`);
  console.log(`  - API: http://localhost:${PORT}/api/cases\n`);
});
