// Servidor de Rocket Retro: muestra la página del juego y conecta a los jugadores online.
// Correrlo con:  npm install  (una sola vez)  y después  npm start
// Cómo funciona el online: el que crea la sala ("anfitrión") calcula el partido en su compu y le manda
// el estado al otro ("invitado"), que le manda sus teclas. El servidor solo pasa los mensajes de uno al otro.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.css': 'text/css', '.md': 'text/plain; charset=utf-8' };

// Archivos del juego (solo lo que está dentro de la carpeta, y nada de node_modules ni archivos ocultos)
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.normalize(path.join(ROOT, url === '/' ? 'index.html' : url));
  const hidden = file.includes('node_modules') || path.basename(file).startsWith('.') || ['server.js', 'package.json', 'package-lock.json'].includes(path.basename(file));
  if (!file.startsWith(ROOT) || hidden || !TYPES[path.extname(file)]) {
    res.writeHead(404).end('No encontrado');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) return res.writeHead(404).end('No encontrado');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

// ---------- Salas online ----------
const rooms = new Map(); // código -> { host, guest }
const newCode = () => {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sin I ni O para no confundir con 1 y 0
  let code;
  do code = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  while (rooms.has(code));
  return code;
};
const send = (ws, msg) => ws && ws.readyState === 1 && ws.send(JSON.stringify(msg));
const cleanName = n => String(n || 'JUGADOR').slice(0, 12).replace(/[^\p{L}\p{N}_]/gu, '') || 'JUGADOR';

// ---------- Jugadores conectados (para la lista de amigos) ----------
// ponytail: los nombres solo se "reservan" mientras el jugador está conectado; cuentas de verdad necesitan base de datos
const users = new Map(); // nombre en minúsculas -> ws
const userKey = name => cleanName(name).toLowerCase();

function createRoom(ws) {
  leaveRoom(ws);
  const code = newCode();
  rooms.set(code, { host: ws, guest: null });
  ws.room = code; ws.role = 'host';
  send(ws, { t: 'created', code });
  return code;
}

function joinRoom(ws, code) {
  const room = rooms.get(String(code || '').toUpperCase());
  if (!room) return send(ws, { t: 'error', text: 'No existe esa sala' });
  if (room.guest) return send(ws, { t: 'error', text: 'La sala ya está llena' });
  if (room.host === ws) return send(ws, { t: 'error', text: 'Esa sala es tuya' });
  leaveRoom(ws);
  room.guest = ws; ws.room = String(code).toUpperCase(); ws.role = 'guest';
  send(ws, { t: 'joined', code: ws.room, host: room.host.name });
  send(room.host, { t: 'guest', name: ws.name });
}

// Salir de la sala sin cortar la conexión (la lista de amigos sigue funcionando)
function leaveRoom(ws) {
  const room = rooms.get(ws.room);
  if (room) {
    send(ws.role === 'host' ? room.guest : room.host, { t: 'left' });
    for (const p of [room.host, room.guest]) if (p) { p.room = null; p.role = null; }
    rooms.delete(ws.room);
  }
  ws.room = null; ws.role = null;
}

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });
wss.on('connection', ws => {
  ws.name = 'JUGADOR';
  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.t === 'hello') {
      // "Este soy yo": queda visible para los amigos. Si el nombre ya está conectado en otro lado, se avisa.
      const key = userKey(msg.name), other = users.get(key);
      if (other && other !== ws && other.readyState === 1) return send(ws, { t: 'hello_err', text: 'Ese nombre ya está conectado en otro lado' });
      if (ws.userKey && users.get(ws.userKey) === ws) users.delete(ws.userKey);
      ws.name = cleanName(msg.name); ws.userKey = key;
      users.set(key, ws);
      send(ws, { t: 'hello_ok', name: ws.name });
    } else if (msg.t === 'status') {
      // ¿Cuáles de mis amigos están conectados? ('online' = libre para jugar, 'playing' = en una sala)
      const status = {};
      for (const n of (msg.names || []).slice(0, 100)) {
        const u = users.get(userKey(n));
        status[n] = !u || u.readyState !== 1 ? 'offline' : u.room ? 'playing' : 'online';
      }
      send(ws, { t: 'status', status });
    } else if (msg.t === 'invite') {
      const friend = users.get(userKey(msg.to));
      if (!friend || friend.readyState !== 1) return send(ws, { t: 'error', text: `${msg.to} no está conectado` });
      if (friend.room) return send(ws, { t: 'error', text: `${friend.name} está jugando` });
      const code = createRoom(ws);
      send(friend, { t: 'invite', from: ws.name, code });
    } else if (msg.t === 'decline') {
      const room = rooms.get(String(msg.code || '').toUpperCase());
      if (room && !room.guest) send(room.host, { t: 'declined', name: ws.name });
    } else if (msg.t === 'create') {
      if (msg.name) ws.name = cleanName(msg.name);
      createRoom(ws);
    } else if (msg.t === 'join') {
      if (msg.name) ws.name = cleanName(msg.name);
      joinRoom(ws, msg.code);
    } else if (msg.t === 'leave') {
      leaveRoom(ws);
    } else if (ws.room) {
      // Cualquier otro mensaje (estado del partido, teclas, etc.) se le pasa al otro jugador
      const room = rooms.get(ws.room);
      if (room) send(ws.role === 'host' ? room.guest : room.host, msg);
    }
  });
  ws.on('close', () => {
    leaveRoom(ws);
    if (ws.userKey && users.get(ws.userKey) === ws) users.delete(ws.userKey);
  });
});

server.listen(PORT, () => console.log(`Rocket Retro en http://localhost:${PORT}`));
