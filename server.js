const http = require("http");
const WebSocket = require("ws");

// Store latest game state
const gameState = {
  player: null,
  inventory: [],
  equipment: [],
  events: [],
  lastUpdate: null
};

const MAX_EVENTS = 100;

// HTML Dashboard
const dashboard = `
<!DOCTYPE html>
<html>
<head>
  <title>RuneLite Dashboard</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', sans-serif; background: #1a1a2e; color: #e0e0e0; padding: 20px; }
    h1 { color: #e6c84c; margin-bottom: 20px; }
    .status { padding: 8px 16px; border-radius: 20px; display: inline-block; margin-bottom: 20px; font-size: 14px; }
    .connected { background: #1b4332; color: #95d5b2; }
    .disconnected { background: #442222; color: #ff6b6b; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 16px; }
    .card { background: #16213e; border-radius: 12px; padding: 20px; border: 1px solid #2a3a5c; }
    .card h2 { color: #e6c84c; font-size: 16px; margin-bottom: 12px; border-bottom: 1px solid #2a3a5c; padding-bottom: 8px; }
    .stat-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #1a1a2e; }
    .stat-label { color: #8899aa; }
    .stat-value { color: #ffffff; font-weight: bold; }
    .hp { color: #ff4444; }
    .prayer { color: #44bbff; }
    .event { padding: 8px; margin: 4px 0; background: #1a1a2e; border-radius: 6px; font-size: 13px; }
    .event-time { color: #666; font-size: 11px; }
    .event-loot { border-left: 3px solid #e6c84c; }
    .event-levelup { border-left: 3px solid #00ff88; }
    .event-death { border-left: 3px solid #ff4444; }
    .event-kill { border-left: 3px solid #ff8844; }
    .item-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
    .item { background: #1a1a2e; padding: 6px; border-radius: 4px; font-size: 12px; text-align: center; }
    .item-qty { color: #e6c84c; font-size: 11px; }
    #events-list { max-height: 400px; overflow-y: auto; }
  </style>
</head>
<body>
  <h1>RuneLite Live Dashboard</h1>
  <div id="status" class="status disconnected">Connecting...</div>
  <div class="grid">
    <div class="card">
      <h2>Player</h2>
      <div id="player">Waiting for data...</div>
    </div>
    <div class="card">
      <h2>Skills</h2>
      <div id="skills">Waiting for data...</div>
    </div>
    <div class="card">
      <h2>Inventory</h2>
      <div id="inventory" class="item-grid">Waiting for data...</div>
    </div>
    <div class="card">
      <h2>Events</h2>
      <div id="events-list">Waiting for data...</div>
    </div>
  </div>
  <script>
    let ws;
    function connect() {
      ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
      ws.onopen = () => {
        document.getElementById('status').className = 'status connected';
        document.getElementById('status').textContent = 'Connected';
        ws.send(JSON.stringify({ type: 'dashboard', action: 'subscribe' }));
      };
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'state') updateAll(data.state);
          if (data.type === 'player') updatePlayer(data);
          if (data.type === 'inventory') updateInventory(data.items);
          if (data.type === 'event') addEvent(data);
          if (data.type === 'skills') updateSkills(data);
        } catch(err) { console.log('Parse error:', err); }
      };
      ws.onclose = () => {
        document.getElementById('status').className = 'status disconnected';
        document.getElementById('status').textContent = 'Disconnected - reconnecting...';
        setTimeout(connect, 3000);
      };
    }
    function updateAll(state) {
      if (state.player) updatePlayer(state.player);
      if (state.inventory) updateInventory(state.inventory);
      if (state.events) state.events.forEach(e => addEvent(e));
    }
    function updatePlayer(p) {
      document.getElementById('player').innerHTML =
        '<div class="stat-row"><span class="stat-label">Name</span><span class="stat-value">' + (p.name || '?') + '</span></div>' +
        '<div class="stat-row"><span class="stat-label">Combat</span><span class="stat-value">' + (p.combatLevel || '?') + '</span></div>' +
        '<div class="stat-row"><span class="stat-label">HP</span><span class="stat-value hp">' + (p.hp || '?') + ' / ' + (p.maxHp || '?') + '</span></div>' +
        '<div class="stat-row"><span class="stat-label">Prayer</span><span class="stat-value prayer">' + (p.prayer || '?') + ' / ' + (p.maxPrayer || '?') + '</span></div>' +
        '<div class="stat-row"><span class="stat-label">World</span><span class="stat-value">' + (p.world || '?') + '</span></div>' +
        '<div class="stat-row"><span class="stat-label">Location</span><span class="stat-value">' + (p.x || '?') + ', ' + (p.y || '?') + '</span></div>';
    }
    function updateSkills(s) {
      let html = '';
      if (s.skills) {
        for (const [name, data] of Object.entries(s.skills)) {
          html += '<div class="stat-row"><span class="stat-label">' + name + '</span><span class="stat-value">' + data.level + ' (' + (data.xp || 0).toLocaleString() + ' xp)</span></div>';
        }
      }
      document.getElementById('skills').innerHTML = html || 'Waiting for data...';
    }
    function updateInventory(items) {
      if (!items || items.length === 0) return;
      document.getElementById('inventory').innerHTML = items.map(i =>
        '<div class="item">' + i.name + '<br><span class="item-qty">x' + (i.quantity || 1) + '</span></div>'
      ).join('');
    }
    function addEvent(evt) {
      const el = document.getElementById('events-list');
      if (el.textContent === 'Waiting for data...') el.innerHTML = '';
      const cls = 'event event-' + (evt.event || 'default');
      const time = evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
      el.insertAdjacentHTML('afterbegin',
        '<div class="' + cls + '"><span class="event-time">' + time + '</span> ' + (evt.message || JSON.stringify(evt)) + '</div>'
      );
      while (el.children.length > 100) el.removeChild(el.lastChild);
    }
    connect();
  </script>
</body>
</html>
`;

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(dashboard);
});

const wss = new WebSocket.Server({ server });

const clients = new Map();
const dashboards = new Set();

wss.on("connection", (ws, req) => {
  const id = req.headers["x-client-id"] || `client-${Date.now()}`;
  clients.set(id, ws);
  console.log(`${id} connected (${clients.size} total)`);

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());

      // Dashboard subscribing
      if (msg.type === "dashboard" && msg.action === "subscribe") {
        dashboards.add(ws);
        // Send current state
        ws.send(JSON.stringify({ type: "state", state: gameState }));
        console.log("Dashboard subscribed");
        return;
      }

      // Game data coming in from RuneLite
      msg.timestamp = msg.timestamp || Date.now();

      if (msg.type === "player") {
        gameState.player = msg;
        gameState.lastUpdate = Date.now();
      }

      if (msg.type === "skills") {
        gameState.skills = msg;
        gameState.lastUpdate = Date.now();
      }

      if (msg.type === "inventory") {
        gameState.inventory = msg.items || [];
        gameState.lastUpdate = Date.now();
      }

      if (msg.type === "event") {
        gameState.events.unshift(msg);
        if (gameState.events.length > MAX_EVENTS) gameState.events.pop();
        gameState.lastUpdate = Date.now();
      }

      // Forward to all dashboards
      const out = JSON.stringify(msg);
      for (const dash of dashboards) {
        if (dash.readyState === WebSocket.OPEN) {
          dash.send(out);
        }
      }

      console.log(`${id} [${msg.type}]: ${msg.message || JSON.stringify(msg).slice(0, 80)}`);
    } catch (err) {
      console.log(`${id} raw: ${data.toString().slice(0, 100)}`);
    }
  });

  ws.on("close", () => {
    clients.delete(id);
    dashboards.delete(ws);
    console.log(`${id} disconnected`);
  });
});

server.listen(8080, () => {
  console.log("Server running on http://0.0.0.0:8080");
});