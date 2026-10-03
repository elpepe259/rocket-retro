// Conexión online con el servidor (server.js) por WebSocket.
// Queda conectada mientras la página está abierta: así los amigos ven que estás conectado y te pueden invitar.
// En una sala, uno es el anfitrión (crea la sala, auto rojo) y el otro el invitado (auto azul).
// El anfitrión calcula el partido y le manda el estado al invitado; el invitado le manda sus teclas.
const net = {
  ws: null,
  ready: false,        // conectado al servidor
  role: null,          // 'host' | 'guest' | null (sin sala)
  names: ['', ''],     // [anfitrión, invitado]
  me: '',              // mi nombre, para que me vean los amigos
  onMessage: () => {}, // lo completa game.js
  onChange: () => {},  // avisa cuando se conecta o se desconecta

  // Conecta si hace falta. Si el servidor no está (por ejemplo con python -m http.server), falla.
  connect() {
    if (this.ready) return Promise.resolve();
    if (this.connecting) return this.connecting;
    this.connecting = new Promise((resolve, reject) => {
      const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
      ws.onopen = () => {
        this.ws = ws; this.ready = true; this.connecting = null;
        if (this.me) this.send({ t: 'hello', name: this.me });
        this.onChange();
        resolve();
      };
      ws.onerror = () => { this.connecting = null; reject(new Error('No se pudo conectar. El modo online necesita el servidor (npm start).')); };
      ws.onmessage = e => { try { this.onMessage(JSON.parse(e.data)); } catch {} };
      ws.onclose = () => {
        if (this.ws !== ws) return;
        this.ws = null; this.ready = false;
        if (this.role) { this.role = null; this.onMessage({ t: 'left' }); }
        this.onChange();
        setTimeout(() => this.connect().catch(() => {}), 3000); // se reconecta solo
      };
    });
    return this.connecting;
  },

  // Decirle al servidor quién soy (al conectarme o al cambiar de nombre)
  hello(name) {
    this.me = name;
    this.send({ t: 'hello', name });
  },

  send(msg) {
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(msg));
  },

  // Salir de la sala (la conexión sigue abierta para los amigos)
  leaveRoom() {
    if (this.role) this.send({ t: 'leave' });
    this.role = null;
  },
};
