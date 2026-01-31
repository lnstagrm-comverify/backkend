// Simple in-memory store (can be replaced with DB later)
const sessions = new Map();

function createSession(sessionId, data) {
  sessions.set(sessionId, {
    sessionId,
    createdAt: new Date().toISOString(),
    status: "started",
    score: null,
    ...data,
  });
}

function updateSession(sessionId, data) {
  if (!sessions.has(sessionId)) return;
  sessions.set(sessionId, {
    ...sessions.get(sessionId),
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

function getSession(sessionId) {
  return sessions.get(sessionId);
}

function getAllSessions() {
  return Array.from(sessions.values());
}

module.exports = {
  createSession,
  updateSession,
  getSession,
  getAllSessions,
};
