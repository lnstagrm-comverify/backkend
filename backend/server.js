const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");
const multer = require("multer");

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

// file uploads (images)
const upload = multer({ storage: multer.memoryStorage() });

// --- WebSocket connections ---
const clients = new Map(); // sessionId -> ws
const admins = new Set();  // admin sockets

wss.on("connection", (ws, req) => {
  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());

      // user registers socket
      if (data.type === "register-user") {
        clients.set(data.sessionId, ws);
      }

      // admin registers socket
      if (data.type === "register-admin") {
        admins.add(ws);
        ws.send(JSON.stringify({
          type: "all-sessions",
          sessions: getAllSessions(),
        }));
      }

      // admin sends score
      if (data.type === "send-score") {
        updateSession(data.sessionId, {
          score: data.score,
          status: "scored",
        });

        const userSocket = clients.get(data.sessionId);
        if (userSocket) {
          userSocket.send(JSON.stringify({
            type: "score",
            score: data.score,
          }));
        }

        broadcastToAdmins();
      }
    } catch {}
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

// --- API endpoints ---

// initial submit (username, IP, etc.)
app.post("/api/start", (req, res) => {
  const { sessionId, username } = req.body;

  createSession(sessionId, {
    username,
    ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
    status: "started",
  });

  broadcastToAdmins();
  res.json({ ok: true });
});

// email step
app.post("/api/email", (req, res) => {
  const { sessionId, email } = req.body;
  updateSession(sessionId, { email, status: "email added" });
  broadcastToAdmins();
  res.json({ ok: true });
});

// name step
app.post("/api/name", (req, res) => {
  const { sessionId, name } = req.body;
  updateSession(sessionId, { name, status: "ready for scoring" });
  broadcastToAdmins();
  res.json({ ok: true });
});

// image upload
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

// --- start server ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
