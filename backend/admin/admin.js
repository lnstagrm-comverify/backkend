const sessionsDiv = document.getElementById("sessions");

const ws = new WebSocket(
  (location.protocol === "https:" ? "wss://" : "ws://") + location.host
);

ws.onopen = () => {
  console.log("Admin WS connected");
  ws.send(JSON.stringify({ type: "register-admin" }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === "all-sessions") {
    renderSessions(data.sessions);
  }
};

function renderSessions(sessions) {
  sessionsDiv.innerHTML = "";

  sessions.forEach((s) => {
    const div = document.createElement("div");
    div.className = "session";

    div.innerHTML = `
      <div class="row"><b>Session:</b> ${s.sessionId}</div>
      <div class="row"><b>Status:</b> ${s.status || "-"}</div>
      <div class="row"><b>Username:</b> ${s.username || "-"}</div>
      <div class="row"><b>Email:</b> ${s.email || "-"}</div>
      <div class="row"><b>Name:</b> ${s.name || "-"}</div>
      <div class="row"><b>IP:</b> ${s.ip || "-"}</div>
      <div class="row"><b>Created:</b> ${s.time || "-"}</div>
    `;

    if (s.image) {
      const img = document.createElement("img");
      img.src = `data:${s.image.type};base64,${s.image.buffer}`;
      div.appendChild(img);
    }

    if (!s.score) {
      const input = document.createElement("input");
      input.placeholder = "Score";

      const btn = document.createElement("button");
      btn.textContent = "Send";

      btn.onclick = () => {
        ws.send(JSON.stringify({
          type: "send-score",
          sessionId: s.sessionId,
          score: input.value
        }));
      };

      div.appendChild(input);
      div.appendChild(btn);
    } else {
      div.innerHTML += `<div class="row"><b>Score sent:</b> ${s.score}</div>`;
    }

    sessionsDiv.appendChild(div);
  });
}
