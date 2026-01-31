const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");
const multer = require("multer");
const path = require("path");

const {
  createSession,
  updateSession,
  getSession,
  getAllSessions,
} = require("./store");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

// ===============================
// SERVE ADMIN PANEL
// ===============================
app.use(
  "/admin",
  express.static(path.join(__dirname, "admin"))
);

// ===============================
// FILE UPLOADS (IMAGES)
// ===============================
const upload = multer({ storage: multer.memoryStorage() });

// ===============================
// WEBSOCKET STATE
// ===============================
const clients = new Map(); // sessionId -> user ws
const admins = new Set();  // admin ws connections

// ===============================
// WEBSOCKET HANDLER
// ===============================
wss.on("connection", (ws) => {
  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());

      // User registers socket
      if (data.type === "register-user") {
        clients.set(data.sessionId, ws);
      }

      // Admin registers socket
      if (data.type === "register-admin") {
        admins.add(ws);
        ws.send(JSON.stringify({
          type: "all-sessions",
          sessions: getAllSessions(),
        }));
      }

      // Admin sends score
      if (data.type === "send-score") {
        updateSession(data.sessionId, {
          score: data.score,
          status: "scored",
        });

        const userSocket = clients.get(data.sessionId);
        if (userSocket && userSocket.readyState === WebSocket.OPEN) {
          userSocket.send(JSON.stringify({
            type: "score",
            score: data.score,
          }));
        }

        broadcastToAdmins();
      }
    } catch (err) {
      console.error("WS error:", err);
    }
  });

  ws.on("close", () => {
    admins.delete(ws);
    for (const [id, socket] of clients.entries()) {
      if (socket === ws) clients.delete(id);
    }
  });
});

function broadcastToAdmins() {
  const payload = JSON.stringify({
    type: "all-sessions",
    sessions: getAllSessions(),
  });

  admins.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });
}

// ===============================
// API ENDPOINTS (FLOW)
// ===============================

// Step 1 — username
app.post("/api/start", (req, res) => {
  const { sessionId, username } = req.body;

  createSession(sessionId, {
    sessionId,
    username,
    ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
    time: new Date().toISOString(),
    status: "started",
  });

  broadcastToAdmins();
  res.json({ ok: true });
});

// Step 2 — email
app.post("/api/email", (req, res) => {
  const { sessionId, email } = req.body;

  updateSession(sessionId, {
    email,
    status: "email added",
  });

  broadcastToAdmins();
  res.json({ ok: true });
});

// Step 3 — name
app.post("/api/name", (req, res) => {
  const { sessionId, name } = req.body;

  updateSession(sessionId, {
    name,
    status: "ready for scoring",
  });

  broadcastToAdmins();
  res.json({ ok: true });
});

// Step 4 — image upload
app.post("/api/upload", upload.single("image"), (req, res) => {
  const { sessionId } = req.body;

  updateSession(sessionId, {
    image: {
      buffer: req.file.buffer.toString("base64"),
      type: req.file.mimetype,
    },
    status: "image uploaded",
  });

  broadcastToAdmins();
  res.json({ ok: true });
});

// ===============================
// START SERVER
// ===============================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
