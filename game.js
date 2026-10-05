const W = 1280, H = 540; // tamaño de la cancha (ancho x alto)
const FLOOR = 500, MATCH_SECONDS = 120;
const COUNTDOWN_STEP = 800; // milisegundos entre cada número de la cuenta regresiva
const MENU_PREVIEW_MS = 5000; // cambio de cancha en el menú
const GOAL_TOP = 250, GOAL_BOTTOM = 400; // arcos elevados, estilo Sideswipe
const RAMP_ANGLE = 55;  // qué tan empinada termina la rampa (grados)
const RAMP_CURVE = 150; // radio de la curva (más chico = más corta y empinada)
// Rampa izquierda (la derecha es un espejo): sale suave del piso en curva y termina a RAMP_ANGLE en la boca del arco.
// Lista de puntos desde el piso hasta el arco.
const RAMP_PTS = (() => {
  const R = RAMP_CURVE, e = RAMP_ANGLE * Math.PI / 180, rise = FLOOR - GOAL_BOTTOM;
  const x0 = 50 + (rise - R * (1 - Math.cos(e))) / Math.tan(e) + R * Math.sin(e); // dónde empieza la curva en el piso
  const pts = [];
  for (let i = 0; i <= 6; i++) {
    const t = e * i / 6;
    pts.push({ x: x0 - R * Math.sin(t), y: FLOOR - R * (1 - Math.cos(t)) });
  }
  pts.push({ x: 50, y: GOAL_BOTTOM });
  return pts;
})();

// Inclinación (en grados) de la rampa en la posición x. 0 = piso plano.
// Positivo en la rampa izquierda, negativo en la derecha.
function rampSlope(x) {
  const pts = x < W / 2 ? RAMP_PTS : RAMP_PTS.map(p => ({ x: W - p.x, y: p.y }));
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if ((x - a.x) * (x - b.x) <= 0) return Math.atan((b.y - a.y) / (b.x - a.x)) * 180 / Math.PI;
  }
  return 0;
}
const FIELD_TOP = 380; // dónde empieza el césped (solo dibujo)
// Grupos de choque: la pelota no choca con las barreras de los arcos (solo los autos)
const CAT = { WORLD: 0x1, CAR: 0x2, BALL: 0x4, CAR_ONLY: 0x8 }; // ojo: cada collisionFilter necesita group: 0, si no los cuerpos no chocan entre sí
const CAR_W = 100, CAR_H = 48;  // tamaño del cuerpo físico del auto (cada cancha puede cambiar el alto con carH)
const CAR_Y = FLOOR - CAR_H / 2; // altura del centro de un auto de alto normal apoyado en el piso

// Valores para tunear jugando
const SPEED = 5.2;          // velocidad máxima normal
const ACCEL = 0.12;         // qué tan rápido acelera (más chico = más pesado)
const BRAKE = 0.18;         // qué tan rápido frena al soltar o al cambiar de dirección
const AIR_CONTROL = 0.07;   // cuánto se puede mover en el aire
const FLIP_FRAMES = 30;     // cuánto dura la voltereta (cuadros; 60 = 1 segundo)
const FLIP_SPEED = 9;       // empujón hacia el costado al dar la voltereta
const FLIP_HIT = 16;        // fuerza del pelotazo si le pega a la pelota durante la voltereta
const JUMP = 10, CAR_GRAVITY = 0.15, FAST_FALL = 12; // el auto cae más rápido que la pelota
const BOOST_SPEED = 8.5, BOOST_ACCEL = 0.35, BOOST_DRAIN = 1, BOOST_RECHARGE = 0.3;
const CAR_DENSITY = 0.003;  // peso del auto (empuja más fuerte la pelota y al otro auto)

// Entrenamiento
const TRAINING_ROUNDS = 10;      // cuántos tiros / atajadas tiene cada ejercicio
const TRAINING_SHOT_TIME = 7000; // ms para meter el gol en "Tiros"
const TRAINING_SAVE_TIME = 5000; // ms que hay que aguantar sin gol en "Arquero"

// Carteles de jugadas
const SHOT_SPEED = 7;       // velocidad mínima hacia el arco rival para que sea "¡TIRO!"
const SAVE_SPEED = 5;       // velocidad mínima que traía la pelota hacia mi arco para "¡SALVADA ÉPICA!"
const SAVE_DIST = 350;      // la salvada cuenta si la pelota estaba a menos de esto de mi arco
const GOLAZO_MARGIN = 60;   // "¡GOLAZO!" si el tiro salió desde media cancha (con este margen) o más lejos

// Explosión del gol
const BLAST_RADIUS = 400; // hasta qué distancia vuelan los autos
const BLAST_POWER = 30;   // qué tan fuerte salen volando
const TEAM_COLORS = [{ hex: 0xff5555, css: '#ff5555' }, { hex: 0x55aaff, css: '#55aaff' }];

// Pelota
const BALL_KEY = 'ball_original'; // pelota clásica blanca y negra en todas las canchas y modos
const BALL_BOUNCE = 0.8;     // rebote (0 = nada, 1 = súper pelota)
const BALL_DENSITY = 0.0012; // peso
const BALL_DRAG = 0.008;     // freno del aire
const BALL_GRAVITY = 0.06;   // gravedad extra: cae más pesada

// Controles de teclado (códigos de event.code). Cambialos acá.
// Además, cada jugador puede usar un joystick: el 1º joystick es J1 y el 2º es J2.
// El turbo NO va en Shift: en Windows, apretar Shift 5 veces abre "Teclas especiales" y mantenerlo abre
// "Teclas filtro", y el juego se corta. "Slash" es la tecla al lado del Shift derecho (- en teclado español).
const CONTROLS = {
  // Local: los dos en el mismo teclado, J1 a la izquierda y J2 a la derecha.
  local: [
    { left: ['KeyA'], right: ['KeyD'], jump: ['KeyW'], down: ['KeyS'], boost: ['Space'] },
    { left: ['ArrowLeft'], right: ['ArrowRight'], jump: ['ArrowUp'], down: ['ArrowDown'], boost: ['Slash', 'Enter', 'Numpad0'] },
  ],
  // Online: cada uno en su compu, así que sirven las dos manos del teclado.
  online: {
    left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], jump: ['KeyW', 'ArrowUp'],
    down: ['KeyS', 'ArrowDown'], boost: ['Space', 'Slash', 'Enter', 'Numpad0'],
  },
};

// Las teclas que cada uno cambia en "Controles" quedan guardadas en el navegador.
// (Se guardan como "controls2": los guardados viejos tenían el turbo en Shift y se descartan.)
const DEFAULT_LOCAL = JSON.stringify(CONTROLS.local);
try { const saved = JSON.parse(localStorage.getItem('controls2')); if (saved) CONTROLS.local = saved; } catch {}
const saveControls = () => { try { localStorage.setItem('controls2', JSON.stringify(CONTROLS.local)); } catch {} };

// Teclas apretadas en este momento
const held = new Set();
const touchPointers = new Map(); // pointerId -> acción; cada dedo se suelta por separado
const touchDrags = new Map(); // dedos que acomodan botones, sin jugar
let touchPlayer = 0;
const isGameKey = code => [CONTROLS.online, ...CONTROLS.local].some(set => Object.values(set).flat().includes(code));
// Windows a veces no avisa cuando se suelta Shift (sobre todo Shift derecho + flechas) y la tecla queda "trabada".
// Cada evento de teclado trae el estado real de Shift/Ctrl/Alt: si dice que no está apretado, lo sacamos.
const syncModifiers = e => {
  for (const [mod, on] of [['Shift', e.shiftKey], ['Control', e.ctrlKey], ['Alt', e.altKey], ['Meta', e.metaKey]]) {
    if (!on) { held.delete(mod + 'Left'); held.delete(mod + 'Right'); }
  }
};
addEventListener('keydown', e => {
  held.add(e.code);
  syncModifiers(e);
  const typing = e.target.tagName === 'INPUT';
  if (!typing && isGameKey(e.code) && document.getElementById('menu').classList.contains('hidden')) e.preventDefault(); // que no scrollee la página
});
addEventListener('keyup', e => { held.delete(e.code); syncModifiers(e); });
addEventListener('blur', () => held.clear());

const FONT = { fontFamily: '"Press Start 2P", monospace', fontSize: '20px', color: '#ffffff' };

class Match extends Phaser.Scene {
  constructor() { super('match'); }

  // Dibujos de los autos (y el segundo cuadro de cada uno, con las ruedas giradas).
  preload() {
    for (const key of new Set(Object.values(STADIUMS).flatMap(st => st.cars))) {
      if (!this.textures.exists(key)) {
        this.load.image(key, `assets/cars/${key}.png`);
        this.load.image(key + '_b', `assets/cars/${key}_b.png`);
      }
    }
  }

  create() {
    this.matter.resume();
    // Textura nativa de 32 px: la pelota original, sin variantes por escenario.
    if (!this.textures.exists(BALL_KEY)) {
      const dibujo = this.make.graphics({ add: false });
      dibujo.fillStyle(0x172132).fillCircle(16, 16, 16);
      dibujo.fillStyle(0xa4b1bf).fillCircle(16, 16, 15);
      dibujo.fillStyle(0xf3f5ed).fillCircle(14, 14, 13);
      dibujo.lineStyle(1, 0x788593);
      for (const [x, y] of [[16, 2], [29, 12], [24, 28], [7, 28], [2, 12]]) dibujo.lineBetween(16, 16, x, y);
      for (const puntos of [
        [[16, 10], [22, 14], [20, 21], [12, 21], [10, 14]],
        [[10, 2], [19, 1], [21, 5], [14, 7], [9, 5]],
        [[27, 6], [30, 12], [28, 19], [25, 16], [24, 10]],
        [[24, 24], [25, 28], [19, 31], [15, 29], [18, 25]],
        [[6, 22], [10, 26], [9, 28], [4, 24]],
        [[2, 10], [6, 9], [7, 16], [3, 19], [1, 16]],
      ]) dibujo.fillStyle(0x263247).fillPoints(puntos.map(([x, y]) => ({ x, y })), true);
      dibujo.fillStyle(0xffffff, 0.8).fillRect(8, 7, 3, 2).fillRect(7, 9, 2, 3);
      dibujo.generateTexture(BALL_KEY, 32, 32);
      dibujo.destroy();
    }
    const wall = (x, y, w, h) => this.matter.add.rectangle(x, y, w, h, { isStatic: true });
    wall(W / 2, FLOOR + 20, W, 40);              // piso
    wall(W / 2, -20, W, 40);                     // techo
    wall(25, GOAL_TOP / 2, 50, GOAL_TOP);        // pared izquierda (sobre el arco)
    wall(W - 25, GOAL_TOP / 2, 50, GOAL_TOP);    // pared derecha
    wall(25, (GOAL_BOTTOM + FLOOR) / 2, 50, FLOOR - GOAL_BOTTOM);      // pared izquierda (debajo del arco)
    wall(W - 25, (GOAL_BOTTOM + FLOOR) / 2, 50, FLOOR - GOAL_BOTTOM);  // pared derecha (debajo del arco)
    wall(-10, (GOAL_TOP + GOAL_BOTTOM) / 2, 20, GOAL_BOTTOM - GOAL_TOP);     // fondo arco izquierdo
    wall(W + 10, (GOAL_TOP + GOAL_BOTTOM) / 2, 20, GOAL_BOTTOM - GOAL_TOP);  // fondo arco derecho

    // Barrera invisible en la boca de cada arco: frena a los autos pero deja pasar la pelota.
    // Sin esto un auto se mete entero en el arco, lo tapa y a veces queda trabado adentro.
    const carOnly = { isStatic: true, collisionFilter: { group: 0, category: CAT.CAR_ONLY, mask: CAT.CAR } };
    this.matter.add.rectangle(30, (GOAL_TOP + GOAL_BOTTOM) / 2, 6, GOAL_BOTTOM - GOAL_TOP, carOnly); // 20 px adentro del arco: el auto puede empujar la pelota hasta adentro
    this.matter.add.rectangle(W - 30, (GOAL_TOP + GOAL_BOTTOM) / 2, 6, GOAL_BOTTOM - GOAL_TOP, carOnly);

    // Rampas: una tabla inclinada que va del piso hasta la boca del arco
    const ramp = (x1, y1, x2, y2, t = 20) => {
      const a = Math.atan2(y2 - y1, x2 - x1);
      const cx = (x1 + x2) / 2 - Math.sin(a) * t / 2, cy = (y1 + y2) / 2 + Math.cos(a) * t / 2; // la cara de arriba queda sobre la línea
      this.matter.add.rectangle(cx, cy, Math.hypot(x2 - x1, y2 - y1), t, { isStatic: true, angle: a });
    };
    for (let i = 1; i < RAMP_PTS.length; i++) {
      const p = RAMP_PTS[i - 1], q = RAMP_PTS[i];
      ramp(q.x, q.y, p.x, p.y);             // izquierda (de arriba hacia abajo, así la tabla queda debajo de la línea)
      ramp(W - p.x, p.y, W - q.x, q.y);     // derecha (espejo)
    }

    // Saber si cada auto está apoyado en algo (piso o rampa) para poder saltar
    const markGrounded = e => {
      for (const p of e.pairs) {
        for (const car of this.cars ?? []) {
          const other = p.bodyA === car.body.body ? p.bodyB : p.bodyB === car.body.body ? p.bodyA : null;
          // Apoyado = toca algo fijo por abajo y la superficie no es una pared (normal más vertical que horizontal).
          // Sin el chequeo de la normal, rozar una pared contaba como piso y se podía saltar infinito.
          const n = p.collision.normal;
          if (other?.isStatic && Math.abs(n.y) > 0.5 && p.collision.supports.some(s => s.y > car.body.y + 10)) car.grounded = true;
        }
      }
    };
    this.matter.world.on('collisionstart', markGrounded);
    this.matter.world.on('collisionactive', markGrounded);
    // Si un auto en plena voltereta toca la pelota, se marca para darle el pelotazo en update()
    this.matter.world.on('collisionstart', e => {
      for (const p of e.pairs) {
        for (const car of this.cars ?? []) {
          const bodies = [p.bodyA, p.bodyB];
          if (!bodies.includes(car.body.body) || !bodies.includes(this.ball.body)) continue;
          // Toque de pelota: se guarda la velocidad que traía la pelota ANTES del choque (para ver si fue tiro o salvada)
          this.touches.push({ team: car.player, preVx: this.ball.body.velocity.x });
          if (car.flip > 0 && !car.flipHit) {
            car.flipHit = true;
            this.flipHitBy = car;
          }
        }
      }
    });
    this.drawStadium();

    if (!this.textures.exists('spark')) { // chispa cuadrada de 4x4 para la explosión
      const s = this.make.graphics({ add: false });
      s.fillStyle(0xffffff).fillRect(0, 0, 4, 4).generateTexture('spark', 4, 4);
      s.destroy();
    }
    // Polvo de las ruedas (frenadas, saltos y aterrizajes)
    this.dust = this.add.particles(0, 0, 'spark', {
      speed: { min: 20, max: 90 }, angle: { min: 200, max: 340 }, scale: { start: 2.5, end: 0 },
      alpha: { start: 0.8, end: 0 }, lifespan: { min: 250, max: 500 }, gravityY: 150,
      tint: [0x9e8b6e, 0xcfc6b0, 0x6b5b45], emitting: false,
    });
    this.training = mode.training; // null = partido; 'libre', 'tiros' o 'arquero' = entrenamiento
    this.cars = [this.makeCar(this.training === 'arquero' ? 150 : 320, STADIUMS[selectedStadium()].cars[0], 0, 1)]; // J1 (equipo rojo)
    if (this.training === 'arquero') this.cars[0].startY = this.cars[0].y0 - 40; // de arquero: arranca sobre la rampa, al lado del arco
    if (!this.training) this.cars.push(this.makeCar(W - 320, STADIUMS[selectedStadium()].cars[1], 1, -1)); // J2 (equipo azul)
    this.ball = this.matter.add.sprite(W / 2, 200, BALL_KEY, null, {
      shape: { type: 'circle', radius: 16 }, restitution: BALL_BOUNCE, frictionAir: BALL_DRAG, density: BALL_DENSITY,
      collisionFilter: { group: 0, category: CAT.BALL, mask: CAT.WORLD | CAT.CAR | CAT.BALL }, // atraviesa las barreras de los arcos
    });

    this.score = [0, 0];
    this.timeLeft = MATCH_SECONDS;
    this.golden = false;
    this.over = false;
    this.add.rectangle(W / 2, 30, this.training ? 340 : 240, 44, 0x000000).setStrokeStyle(3, 0xffd23f); // tablero
    this.scoreText = this.add.text(W / 2, 30, '', { ...FONT, fontSize: this.training ? '14px' : '20px' }).setOrigin(0.5);
    this.msg = this.add.text(W / 2, H / 2 - 60, '', { ...FONT, fontSize: '36px', color: '#ffd23f' })
      .setOrigin(0.5).setStroke('#000000', 8);
    this.scorerText = this.add.text(W / 2, H / 2 - 10, '', { ...FONT, fontSize: '22px' }).setOrigin(0.5).setStroke('#000000', 6);
    this.names = mode.online ? net.names.map(n => n.toUpperCase()) : playerNames();
    this.names.slice(0, this.cars.length).forEach((name, i) => { // nombre debajo de cada barra de turbo
      this.add.text(i === 0 ? 70 : W - 70, 40, name, { ...FONT, fontSize: '9px', color: TEAM_COLORS[i].css })
        .setOrigin(i === 0 ? 0 : 1, 0).setStroke('#000000', 3);
    });
    if (this.training) {
      this.add.text(W - 70, 22, 'ENTRENAMIENTO · ' + TRAINING_NAMES[this.training], { ...FONT, fontSize: '10px', color: '#90e0ef' }).setOrigin(1, 0);
      this.add.text(W - 70, 40, 'R: reiniciar  ·  P: pausa', { ...FONT, fontSize: '8px', color: '#aaaaaa' }).setOrigin(1, 0);
    }
    this.hud = this.add.graphics();
    this.attempts = 0;
    this.hits = 0;
    this.kickoff();
    this.netEvents = [];   // cosas que el invitado tiene que dibujar (explosiones, carteles)
    this.countLabel = '';  // número de la cuenta regresiva que se está mostrando
    if (mode.online === 'guest') {
      // El invitado no calcula nada: dibuja lo que le manda el anfitrión (updateGuest)
      this.matter.pause();
      this.guestCount = this.add.text(W / 2, H / 2 - 40, '', { ...FONT, fontSize: '72px' }).setOrigin(0.5).setStroke('#000000', 10);
      return;
    }
    if (mode.online === 'host') {
      const send = () => this.sendSnapshot();
      this.events.on('postupdate', send);
      this.events.once('shutdown', () => this.events.off('postupdate', send));
    }
    // En "Tiros" y "Arquero" la primera jugada arranca con el GO!
    this.startCountdown(this.training && this.training !== 'libre' ? () => this.nextAttempt() : null);
  }

  // ---------- Online ----------
  // Anfitrión: manda el estado de todo al invitado en cada cuadro
  sendSnapshot() {
    const r = v => Math.round(v * 10) / 10;
    net.send({
      t: 's',
      c: this.cars.map(c => [r(c.body.x), r(c.body.y), r(c.view.x), r(c.view.y), r(c.view.angle), c.facing, r(c.view.scaleX), r(c.view.scaleY),
        Math.round(c.boost), (c.boosting ? 1 : 0) + (c.view.texture.key.endsWith('_b') ? 2 : 0) + (c.boostEmpty ? 4 : 0)]),
      b: [r(this.ball.x), r(this.ball.y), r(this.ball.angle), this.ball.visible ? 1 : 0],
      sc: this.score, tl: r(this.timeLeft), g: this.golden ? 1 : 0,
      m: [this.msg.text, this.msg.style.color], st: [this.scorerText.text, this.scorerText.style.color, r(this.scorerText.scale)],
      cd: this.countLabel, ev: this.netEvents.splice(0),
    });
  }

  // Invitado: dibuja el último estado que llegó y manda sus teclas
  updateGuest() {
    const k = this.readInput(this.guestPad ??= { player: 0, prevJump: false });
    if (k.jumpPressed) this.jumpSeq = (this.jumpSeq ?? 0) + 1;
    const input = { t: 'in', l: k.left, r: k.right, j: k.jump, d: k.down, b: k.boost, js: this.jumpSeq ?? 0 };
    const key = JSON.stringify(input);
    if (key !== this.lastInput || (this.inputTimer = (this.inputTimer ?? 0) + 1) % 30 === 0) { net.send(input); this.lastInput = key; }

    const s = this.netState;
    if (!s) return this.drawHud();
    s.c.forEach((d, i) => {
      const c = this.cars[i];
      c.body.setPosition(d[0], d[1]);
      c.facing = d[5];
      c.boost = d[8];
      c.boostEmpty = !!(d[9] & 4);
      c.view.setPosition(d[2], d[3]).setAngle(d[4]).setFlipX(d[5] < 0).setScale(d[6], d[7]).setTexture(d[9] & 2 ? c.texture + '_b' : c.texture);
      if (d[9] & 1) this.shootFlame(c);
    });
    this.ball.setPosition(s.b[0], s.b[1]).setAngle(s.b[2]).setVisible(!!s.b[3]);
    this.score = s.sc; this.timeLeft = s.tl; this.golden = !!s.g;
    this.msg.setText(s.m[0]).setColor(s.m[1]);
    this.scorerText.setText(s.st[0]).setColor(s.st[1]).setScale(s.st[2]);
    if (s.cd !== this.guestCount.text) {
      this.guestCount.setText(s.cd).setColor(s.cd === 'GO!' ? '#14f195' : '#ffd23f').setScale(2.5);
      this.tweens.add({ targets: this.guestCount, scale: 1, duration: 300, ease: 'Back.Out' });
    }
    for (const e of s.ev) {
      if (e.k === 'pop') this.popAt(e.text, e.team, e.x, e.y);
      if (e.k === 'boom') this.boomFx(e.team, e.x, e.y);
    }
    s.ev = []; // los eventos se dibujan una sola vez
    this.drawHud();
  }

  // Anfitrión: las teclas del invitado (llegan por la red)
  remoteInput(c) {
    const n = this.remote ?? {};
    const s = { left: !!n.l, right: !!n.r, jump: !!n.j, down: !!n.d, boost: !!n.b };
    s.jumpPressed = (n.js ?? 0) !== (c.lastJs ?? 0); // cada salto nuevo sube el contador
    c.lastJs = n.js ?? 0;
    return s;
  }

  // 3, 2, 1, GO! antes de arrancar: los autos y la pelota quedan quietos y el reloj no corre
  startCountdown(onGo) {
    this.countingDown = true;
    this.ball.setStatic(true);
    const countText = this.add.text(W / 2, H / 2 - 40, '', { ...FONT, fontSize: '72px' }).setOrigin(0.5).setStroke('#000000', 10);
    ['3', '2', '1', 'GO!'].forEach((t, i) => this.time.delayedCall(i * COUNTDOWN_STEP, () => {
      const go = t === 'GO!';
      this.countLabel = t;
      countText.setText(t).setColor(go ? '#14f195' : '#ffd23f').setScale(2.5).setAlpha(1);
      this.tweens.add({ targets: countText, scale: 1, duration: 300, ease: 'Back.Out' });
      if (go) {
        this.countingDown = false;
        this.ball.setStatic(false);
        onGo?.();
        this.tweens.add({ targets: countText, alpha: 0, delay: 500, duration: 300, onComplete: () => { countText.destroy(); this.countLabel = ''; } });
      }
    }));
  }

  // Solo dibujo: fondo de la cancha elegida (stadiums.js), piso, líneas y arcos. La física está en create().
  drawStadium(key = selectedStadium()) {
    const st = STADIUMS[key];
    const fondo = this.add.graphics();
    const fieldH = FLOOR - FIELD_TOP;

    // Techo (ahí va el marcador) y fondo de la cancha, con su público (salta cuando hay gol)
    fondo.fillStyle(0x0b0b14).fillRect(0, 0, W, 56);
    this.crowd = this.add.graphics();
    st.backdrop(this, fondo, this.crowd);
    // Piso, paredes y arcos por delante de las animaciones del paisaje.
    const g = this.add.graphics();

    // Piso a franjas
    for (let x = 50, i = 0; x < W - 50; x += 60, i++) {
      g.fillStyle(st.floor[i % 2]).fillRect(x, FIELD_TOP, Math.min(60, W - 50 - x), fieldH);
    }
    g.fillStyle(st.under).fillRect(0, FLOOR, W, H - FLOOR);
    // Grano fino del material, con semilla fija: más detalle sin animar cientos de objetos.
    const rng = rngFor(key + '-material');
    for (let i = 0; i < 150; i++) {
      g.fillStyle(i % 2 ? 0xffffff : 0x000000, 0.07).fillRect(rng.between(60, W - 60), rng.between(FIELD_TOP + 5, FLOOR - 5), rng.between(1, 3), 1);
    }
    st.floorDetail?.(this, g); // manchas, grietas, arena, placas... (stadiums.js)

    // Líneas de la cancha
    g.lineStyle(3, 0xffffff, 0.85);
    g.lineBetween(50, FIELD_TOP + 2, W - 50, FIELD_TOP + 2);
    g.lineBetween(0, FLOOR, W, FLOOR);
    g.lineBetween(W / 2, FIELD_TOP, W / 2, FLOOR);
    g.strokeEllipse(W / 2, (FIELD_TOP + FLOOR) / 2, 180, 70);
    for (const side of [1, -1]) {
      const gx = side > 0 ? 50 : W - 50;
      g.strokeRect(side > 0 ? gx : gx - 130, FIELD_TOP + 18, 130, fieldH - 18); // área grande
      g.strokeRect(side > 0 ? gx : gx - 50, FIELD_TOP + 50, 50, fieldH - 50);   // área chica
      g.fillStyle(0xffffff).fillCircle(gx + side * 95, (FIELD_TOP + FLOOR) / 2 + 10, 3); // punto penal
    }
    g.fillStyle(0xffffff).fillCircle(W / 2, (FIELD_TOP + FLOOR) / 2, 4);

    // Paredes arriba y abajo de los arcos
    g.fillStyle(st.wall)
      .fillRect(0, 56, 50, GOAL_TOP - 56).fillRect(W - 50, 56, 50, GOAL_TOP - 56)
      .fillRect(0, GOAL_BOTTOM, 50, FLOOR - GOAL_BOTTOM).fillRect(W - 50, GOAL_BOTTOM, 50, FLOOR - GOAL_BOTTOM);
    // Relieve en las paredes: juntas, borde iluminado y sombra interior.
    for (const x of [0, W - 50]) {
      for (const [top, bottom] of [[56, GOAL_TOP], [GOAL_BOTTOM, FLOOR]]) {
        g.fillStyle(0xffffff, 0.1).fillRect(x + 2, top, 3, bottom - top);
        g.fillStyle(0x000000, 0.2).fillRect(x + 44, top, 6, bottom - top);
        for (let y = top + 14, i = 0; y < bottom - 2; y += 18, i++) {
          g.lineStyle(1, 0x000000, 0.22).lineBetween(x + 4, y, x + 44, y);
          g.lineBetween(x + (i % 2 ? 14 : 30), y - 14, x + (i % 2 ? 14 : 30), y);
        }
      }
    }

    // Rampas de las esquinas
    const mirror = RAMP_PTS.map(p => ({ x: W - p.x, y: p.y }));
    for (const pts of [RAMP_PTS, mirror]) {
      g.fillStyle(st.wall).fillPoints([...pts, { x: pts.at(-1).x, y: FLOOR }], true);
      g.lineStyle(4, 0xffd23f).strokePoints(pts);
    }

    // Arcos: red, color del equipo y palos blancos
    const goalH = GOAL_BOTTOM - GOAL_TOP;
    for (const [x0, color] of [[0, 0xff5555], [W - 50, 0x55aaff]]) {
      g.fillStyle(color, 0.25).fillRect(x0, GOAL_TOP, 50, goalH);
      g.lineStyle(1, 0xffffff, 0.35);
      for (let x = x0; x <= x0 + 50; x += 10) g.lineBetween(x, GOAL_TOP, x, GOAL_BOTTOM);
      for (let y = GOAL_TOP; y <= GOAL_BOTTOM; y += 10) g.lineBetween(x0, y, x0 + 50, y);
      const postX = x0 === 0 ? 46 : W - 52;
      g.fillStyle(0xffffff)
        .fillRect(x0, GOAL_TOP - 4, 50, 6)            // travesaño
        .fillRect(x0, GOAL_BOTTOM - 2, 50, 6)         // base
        .fillRect(postX, GOAL_TOP - 4, 6, goalH + 8); // palo
    }
  }

  makeCar(x, texture, player, facing) {
    // Fuego del turbo: se crea antes que el auto para que quede dibujado detrás
    const flame = this.add.particles(0, 0, 'spark', {
      speed: { min: 120, max: 240 }, scale: { start: 3.5, end: 0.5 }, alpha: { start: 1, end: 0 },
      lifespan: { min: 180, max: 380 }, color: [0xffffff, 0xffd23f, 0xff8c1a, 0xff3b1a, 0x442222], // de blanco caliente a humo
      emitting: false,
    });
    // El cuerpo físico es invisible y siempre está derecho (así sube bien las rampas).
    // Lo que se ve es `view`, un dibujo que lo sigue y se inclina, da volteretas y gira.
    // Mismo tamaño de cuerpo para todos los autos, así ninguno tiene ventaja.
    // Mismo cuerpo para los dos autos de la cancha. Los autos deportivos bajos usan un cuerpo más bajo (carH).
    const h = STADIUMS[selectedStadium()].carH ?? CAR_H, y0 = FLOOR - h / 2;
    const body = this.matter.add.sprite(x, y0, texture, null, {
      shape: { type: 'rectangle', width: CAR_W, height: h },
      friction: 0, density: CAR_DENSITY, chamfer: { radius: 14 }, // esquinas redondeadas: sube mejor las rampas
      collisionFilter: { group: 0, category: CAT.CAR, mask: CAT.WORLD | CAT.CAR | CAT.BALL | CAT.CAR_ONLY },
    });
    body.setFixedRotation().setVisible(false);
    const view = this.add.sprite(x, y0, texture).setFlipX(facing < 0);
    const viewDy = h / 2 - view.height / 2; // los dibujos tienen distinto alto: se apoyan todos en el piso
    view.y += viewDy;
    return {
      body, view, viewDy, h, y0, texture, angle: 0, flame, player, facing, startFacing: facing, startX: x, jumps: 2, boost: 100, boostEmpty: false, prevJump: false,
      wheel: 0, pitch: 0, sx: 1, sy: 1, // animación: ruedas, cabeceo y estirar/aplastar
    };
  }

  // Animaciones del dibujo del auto: ruedas, cabeceo al acelerar/frenar, estirarse con turbo, polvo
  animateCar(c, { grounded, landed, braking, boosting, ax }) {
    const speed = Math.abs(c.body.body.velocity.x);
    const wheelY = c.body.y + c.h / 2 - 4;

    // Ruedas: alternan entre dos cuadros, más rápido cuanto más rápido va
    if (grounded) c.wheel += speed * 0.12;
    c.view.setTexture(Math.floor(c.wheel) % 2 ? c.texture + '_b' : c.texture);

    // Cabeceo: al acelerar levanta la trompa, al frenar la baja
    const pitchTarget = grounded ? Phaser.Math.Clamp(-ax * 30, -8, 8) : 0;
    c.pitch += (pitchTarget - c.pitch) * 0.2;

    // Frenada fuerte: polvo en las ruedas
    if (grounded && braking && speed > 1.5) {
      this.dust.emitParticleAt(c.body.x - 30, wheelY, 2);
      this.dust.emitParticleAt(c.body.x + 30, wheelY, 2);
    }

    // Aterrizaje: se aplasta y levanta polvo
    if (landed) {
      c.sx = 1.15; c.sy = 0.82;
      this.dust.emitParticleAt(c.body.x - 30, wheelY, 6);
      this.dust.emitParticleAt(c.body.x + 30, wheelY, 6);
    }

    // Turbo: se estira y tiembla un poquito
    const sxTarget = boosting ? 1.08 : 1, syTarget = boosting ? 0.94 : 1;
    c.sx += (sxTarget - c.sx) * 0.2;
    c.sy += (syTarget - c.sy) * 0.2;
    const shake = boosting ? Phaser.Math.Between(-1, 1) : 0;
    return { shake };
  }

  // Salto: se estira para arriba y tira polvo
  jumpPuff(c) {
    c.sx = 0.85; c.sy = 1.2;
    this.dust.emitParticleAt(c.body.x, c.body.y + c.h / 2, 8);
  }

  // Doble salto (voltereta): un anillo blanco que se agranda
  flipPuff(c) {
    const ring = this.add.circle(c.body.x, c.body.y, 10).setStrokeStyle(4, 0xffffff, 0.9);
    this.tweens.add({ targets: ring, scale: 5, alpha: 0, duration: 350, ease: 'Cubic.Out', onComplete: () => ring.destroy() });
  }

  // Tira fuego por la parte de atrás del auto
  shootFlame(c) {
    const back = -c.facing; // atrás = al revés de donde mira
    c.flame.setEmitterAngle(back > 0 ? { min: -20, max: 20 } : { min: 160, max: 200 });
    c.flame.emitParticleAt(c.body.x + back * (CAR_W / 2 - 2), c.body.y + 4, 4);
  }

  // Junta teclado, joystick y botones táctiles en el mismo estado.
  readInput(c) {
    if (mode.online === 'host' && c.player === 1) return this.remoteInput(c);
    // Online cada uno juega en su compu y en entrenamiento hay un solo auto: sirven las teclas de J1 y de J2
    const k = mode.online ? CONTROLS.online : this.training ? mergedControls() : CONTROLS.local[c.player];
    const pad = this.input.gamepad?.getPad(mode.online ? 0 : c.player);
    const tactil = mode.online || this.training || c.player === touchPlayer ? new Set(touchPointers.values()) : new Set();
    const on = action => tactil.has(action) || k[action].some(code => held.has(code));
    const stick = pad ? pad.leftStick.x : 0;
    const s = {
      left: on('left') || !!pad?.left || stick < -0.3,
      right: on('right') || !!pad?.right || stick > 0.3,
      jump: on('jump') || !!pad?.A,
      down: on('down') || !!pad?.down || !!pad?.B,
      boost: on('boost') || !!pad?.X || (pad?.R2 ?? 0) > 0.3,
    };
    s.jumpPressed = s.jump && !c.prevJump;
    c.prevJump = s.jump;
    return s;
  }

  kickoff() {
    for (const c of this.cars) {
      c.body.setPosition(c.startX, c.startY ?? c.y0).setVelocity(0, 0);
      c.angle = 0;
      c.facing = c.startFacing;
      c.spin = 0;
      c.flip = 0;
      c.lastVx = 0;
      c.boost = 100;
      c.boostEmpty = false;
      // El dibujo también va a su lugar ya (durante la cuenta regresiva drive() no corre y no lo movería)
      c.pitch = 0; c.sx = 1; c.sy = 1;
      c.view.setPosition(c.startX, (c.startY ?? c.y0) + c.viewDy).setAngle(0).setScale(1).setFlipX(c.facing < 0);
    }
    this.ball.setStatic(false).setVisible(true).setPosition(W / 2, 200).setVelocity(0, 0).setAngularVelocity(0);
    this.resetting = false;
    this.msg.setColor('#ffd23f');
    this.scorerText.setText('');
    if (!this.golden) this.msg.setText('');
    this.touches = [];
    this.lastTouch = null;
  }

  // Después de cada toque: ¿fue una salvada o un tiro al arco?
  judgeTouch({ team, preVx }) {
    if (this.resetting) return;
    const ball = this.ball, vx = ball.body.velocity.x;
    const own = team === 0 ? -1 : 1;                      // hacia dónde está el arco propio
    const distOwn = team === 0 ? ball.x : W - ball.x;     // distancia a mi arco
    this.lastTouch = { team, distGoal: W - distOwn };     // distancia al arco rival (para el golazo)
    if (this.time.now < this.popUntil) return;            // no llenar la pantalla de carteles
    if (preVx * own > SAVE_SPEED && distOwn < SAVE_DIST && vx * own <= 0) {
      this.pop('¡SALVADA ÉPICA!', team);                   // la pelota iba a mi arco y la saqué
    } else if (-vx * own > SHOT_SPEED && W - distOwn < W * 0.6) {
      this.pop('¡TIRO!', team);                            // le pegué fuerte hacia el arco rival
    }
  }

  // Cartel chiquito que sale arriba de la pelota, del color del equipo, y se va flotando
  pop(text, team) {
    this.popUntil = this.time.now + 900;
    const x = Phaser.Math.Clamp(this.ball.x, 130, W - 130), y = this.ball.y - 40;
    this.netEvents.push({ k: 'pop', text, team, x, y });
    this.popAt(text, team, x, y);
  }

  popAt(text, team, x, y) {
    const t = this.add.text(x, y, text, { ...FONT, fontSize: '18px', color: TEAM_COLORS[team].css })
      .setOrigin(0.5).setStroke('#000000', 6).setScale(0.3);
    this.tweens.add({ targets: t, scale: 1, duration: 200, ease: 'Back.Out' });
    this.tweens.add({ targets: t, y: t.y - 50, alpha: 0, delay: 700, duration: 500, onComplete: () => t.destroy() });
  }

  update(time, delta) {
    if (this.over) return;
    if (mode.online === 'guest') return this.updateGuest();
    if (this.countingDown) return this.drawHud();
    for (const c of this.cars) this.drive(c);
    if (this.flipHitBy) { // pelotazo de voltereta: sale fuerte hacia donde giró el auto
      const c = this.flipHitBy;
      this.flipHitBy = null;
      this.ball.setVelocity(c.flipDir * FLIP_HIT, Math.min(this.ball.body.velocity.y, -FLIP_HIT * 0.3));
      this.cameras.main.shake(120, 0.006);
    }
    for (const t of this.touches.splice(0)) this.judgeTouch(t);
    this.ball.setVelocityY(this.ball.body.velocity.y + BALL_GRAVITY);

    if (this.training) {
      if (!this.resetting) this.updateTraining(delta);
      return this.drawHud();
    }
    if (!this.resetting) {
      if (!this.golden) {
        this.timeLeft -= delta / 1000;
        if (this.timeLeft <= 0) {
          this.timeLeft = 0;
          if (this.score[0] !== this.score[1]) return this.end();
          this.golden = true;
          this.msg.setText('¡GOL DE ORO!');
        }
      }
      if (this.ball.x < 34) this.goal(1);          // pelota en el arco rojo: gol del azul
      else if (this.ball.x > W - 34) this.goal(0); // pelota en el arco azul: gol del rojo
    }
    this.drawHud();
  }

  drive(c) {
    const k = this.readInput(c), b = c.body;
    const v = b.body.velocity;
    const dir = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    if (dir) c.facing = dir;

    const grounded = c.grounded;
    c.grounded = false; // la física lo vuelve a marcar si sigue apoyado
    if (grounded) c.boostEmpty = false; // tocar el suelo o la rampa habilita otra vez la recarga
    if (grounded && v.y >= 0) c.jumps = 2;
    const landed = grounded && (c.airFrames ?? 0) > 10; // venía volando y tocó el piso
    c.airFrames = grounded ? 0 : (c.airFrames ?? 0) + 1;
    const slope = c.airFrames < 8 ? rampSlope(b.x) : 0; // unos cuadros de memoria: en la rampa a veces se despega un instante

    // Acelera de a poco (se siente pesado) pero frena rápido (fácil de controlar)
    // En la rampa usamos la velocidad que traía el auto: los choques contra la pendiente no lo frenan
    const onSlope = grounded && Math.abs(slope) > 5;
    const baseVx = onSlope ? (c.lastVx ?? v.x) : v.x;
    const braking = dir === 0 || dir * baseVx < 0;
    const grip = grounded ? (braking ? BRAKE : ACCEL) : AIR_CONTROL;
    let vx = baseVx + (dir * SPEED - baseVx) * grip;
    const boosting = k.boost && c.boost > 0 && !c.boostEmpty;
    c.boosting = boosting; // (para mandarlo al invitado)
    if (boosting) {
      vx += (c.facing * BOOST_SPEED - vx) * BOOST_ACCEL; // el turbo empuja de a poco, no teletransporta
      c.boost = this.training ? 100 : Math.max(0, c.boost - BOOST_DRAIN); // en entrenamiento el turbo es infinito
      c.boostEmpty = c.boost === 0 && !grounded;
      this.shootFlame(c);
    } else if (!c.boostEmpty) {
      c.boost = Math.min(100, c.boost + BOOST_RECHARGE);
    }
    b.setVelocityX(vx);
    const ax = vx - (c.lastVx ?? 0); // aceleración de este cuadro (para el cabeceo)
    c.lastVx = vx;
    if (onSlope) {
      b.setVelocityY(vx * Math.tan(slope * Math.PI / 180)); // en la rampa maneja a lo largo de ella
    }

    // Dibujo: sigue al cuerpo físico y se inclina / gira
    if (c.flip > 0) { // dando la voltereta: una vuelta completa hacia donde saltó
      c.flip--;
      c.angle = c.flip ? c.flipDir * 360 * (1 - c.flip / FLIP_FRAMES) : 0;
    } else if (c.spin) { // girando por la explosión
      c.angle += c.spin;
      c.spin *= 0.97;
      if (Math.abs(c.spin) < 0.5) { c.spin = 0; c.angle = 0; }
    } else { // apoyado: se acomoda a la rampa; en el aire vuelve de a poco a quedar derecho
      c.angle += (slope - c.angle) * (c.airFrames < 8 ? 0.3 : 0.08);
    }
    const sink = c.flip || c.spin ? 0 : Math.abs(Math.sin(c.angle * Math.PI / 180)) * 12; // inclinado, el dibujo baja un poco para apoyarse en la rampa
    const { shake } = this.animateCar(c, { grounded, landed, braking: grounded && braking && dir * vx <= 0, boosting, ax });
    const pitch = c.flip || c.spin ? 0 : c.pitch;
    c.view.setPosition(b.x + shake, b.y + c.viewDy + sink + (c.sy < 1 ? (1 - c.sy) * 20 : 0)) // al aplastarse queda pegado al piso
      .setAngle(c.angle + pitch).setFlipX(c.facing < 0).setScale(c.sx, c.sy);

    if (k.jumpPressed && c.jumps === 1 && !grounded) {
      // Doble salto = voltereta hacia donde mira el auto
      c.jumps = 0;
      c.flip = FLIP_FRAMES;
      c.flipDir = c.facing;
      c.flipHit = false;
      b.setVelocity(c.facing * FLIP_SPEED, -JUMP * 0.5);
      this.flipPuff(c);
    } else if (k.jumpPressed && c.jumps > 0) {
      b.setVelocityY(-JUMP);
      c.jumps--;
      this.jumpPuff(c);
    } else if (k.down && !grounded) {
      b.setVelocityY(Math.max(v.y, FAST_FALL)); // bajar rápido
    } else if (!grounded) {
      b.setVelocityY(v.y + CAR_GRAVITY); // gravedad extra: el auto es pesado
    }
  }

  goal(i) {
    this.score[i]++;
    this.resetting = true;
    this.explode(i);
    // Golazo: el último toque fue del que anotó y desde media cancha o más lejos
    const golazo = this.lastTouch?.team === i && this.lastTouch.distGoal >= W / 2 - GOLAZO_MARGIN;
    this.msg.setText(this.golden ? '¡GOL DE ORO!' : golazo ? '¡GOLAZO!' : '¡GOL!').setColor(TEAM_COLORS[i].css);
    this.scorerText.setText(`ANOTO ${this.names[i]}`).setColor(TEAM_COLORS[i].css).setScale(0);
    this.tweens.add({ targets: this.scorerText, scale: 1, duration: 300, ease: 'Back.Out' });
    this.time.delayedCall(2000, () => {
      if (this.golden) return this.end();
      this.kickoff();
      this.startCountdown();
    });
  }

  // La pelota explota con el color del que hizo el gol y los autos cercanos salen volando
  explode(i) {
    const { x, y } = this.ball;
    this.ball.setVisible(false).setStatic(true).setPosition(W / 2, -200); // la sacamos de la cancha hasta el saque
    this.netEvents.push({ k: 'boom', team: i, x, y });
    this.boomFx(i, x, y);
    for (const car of this.cars) {
      const dx = car.body.x - x, dy = car.body.y - y, d = Math.hypot(dx, dy);
      if (d > BLAST_RADIUS) continue;
      const power = BLAST_POWER * (1 - d / BLAST_RADIUS);
      const side = dx >= 0 ? 1 : -1;
      car.body.setVelocity(side * power * Math.max(0.5, Math.abs(dx) / (d || 1)), -power * 0.8); // siempre para arriba y hacia afuera
      car.spin = side * 18; // grados por cuadro
    }
  }

  // Solo el dibujo de la explosión (chispas, onda, destello y el público saltando)
  boomFx(i, x, y) {
    const color = TEAM_COLORS[i].hex;
    this.tweens.add({ targets: this.crowd, y: -4, duration: 120, yoyo: true, repeat: 5 });

    const sparks = this.add.particles(x, y, 'spark', {
      speed: { min: 150, max: 550 }, angle: { min: 0, max: 360 }, scale: { start: 3, end: 0 },
      lifespan: { min: 500, max: 1100 }, gravityY: 400, tint: [color, color, 0xffffff, 0xffd23f], blendMode: 'ADD', emitting: false,
    });
    sparks.explode(120);
    this.time.delayedCall(1300, () => sparks.destroy());

    const ring = this.add.circle(x, y, 12).setStrokeStyle(6, color);
    this.tweens.add({ targets: ring, scale: 14, alpha: 0, duration: 500, ease: 'Cubic.Out', onComplete: () => ring.destroy() });
    const c = Phaser.Display.Color.IntegerToColor(color);
    this.cameras.main.flash(250, c.red, c.green, c.blue).shake(350, 0.012);
  }

  end() {
    this.over = true;
    this.matter.pause();
    this.drawHud();
    const winner = this.score[0] > this.score[1] ? 0 : 1;
    if (mode.online === 'host') net.send({ t: 'end', winner, score: this.score });
    window.onMatchEnd(winner, this.score, this.names);
  }

  // ---------- Entrenamiento ----------
  updateTraining(delta) {
    const inLeft = this.ball.x < 34, inRight = this.ball.x > W - 34;
    if (this.training === 'libre') {
      if (inLeft || inRight) this.trainingGoal(inRight ? 0 : 1);
      return;
    }
    this.attemptTime += delta;
    if (this.training === 'tiros') {
      if (inRight) this.endAttempt(true);
      else if (inLeft || this.attemptTime > TRAINING_SHOT_TIME) this.endAttempt(false);
    } else { // arquero
      const cleared = this.ball.x > W * 0.55 && this.ball.body.velocity.x > 0; // la mandaste lejos
      if (inLeft) this.endAttempt(false);
      else if (cleared || inRight || this.attemptTime > TRAINING_SAVE_TIME) this.endAttempt(true);
    }
  }

  // Libre: cada gol se festeja y vuelve todo al lugar
  trainingGoal(team) {
    this.resetting = true;
    if (team === 0) this.hits++;
    this.explode(team);
    this.msg.setText('¡GOL!').setColor(TEAM_COLORS[team].css);
    this.time.delayedCall(1500, () => this.kickoff());
  }

  // Una jugada nueva de "Tiros" o "Arquero"
  nextAttempt() {
    const rnd = Phaser.Math.Between;
    this.kickoff();
    if (this.training === 'tiros') {
      // La pelota viene hacia vos: a veces por el piso y a veces por arriba
      this.ball.setPosition(rnd(W * 0.5, W * 0.72), rnd(220, 470)).setVelocity(-rnd(2, 6), -rnd(0, 7));
    } else {
      // Te patean al arco desde lejos: se calcula el tiro (con gravedad y freno del aire) para que llegue a la boca del arco
      // (desde no tan lejos: si no, la pelota tiene que salir más rápido que un auto y no se puede atajar)
      // (y rasantes, a la parte baja del arco: un globo muy alto pasa por arriba del salto y no se puede atajar)
      const x = rnd(W * 0.3, W * 0.45), y = rnd(390, 460), targetY = rnd(GOAL_BOTTOM - 35, GOAL_BOTTOM - 12);
      const T = rnd(36, 48), d = BALL_DRAG, g = 0.278 + BALL_GRAVITY; // cuadros hasta llegar, freno y gravedad por cuadro
      let S = 0, G = 0;
      for (let k = 0; k < T; k++) { S += (1 - d) ** k; G += g * (1 - (1 - d) ** k) / d; }
      this.ball.setPosition(x, y).setVelocity(-(x - 20) / S, (targetY - y - G) / S);
    }
    this.attemptTime = 0;
  }

  endAttempt(ok) {
    this.resetting = true;
    this.attempts++;
    if (ok) this.hits++;
    if (this.ball.x < 34 || this.ball.x > W - 34) this.explode(this.ball.x > W / 2 ? 0 : 1);
    this.msg.setText(ok ? '¡BIEN!' : this.training === 'tiros' ? 'ERRASTE' : '¡GOL EN CONTRA!').setColor(ok ? '#14f195' : '#ff5555');
    this.time.delayedCall(1500, () => (this.attempts >= TRAINING_ROUNDS ? this.endTraining() : this.nextAttempt()));
  }

  endTraining() {
    this.over = true;
    this.matter.pause();
    this.drawHud();
    window.onTrainingEnd(this.training, this.hits);
  }

  // Tecla R: volver a empezar la jugada (no cuenta como intento)
  resetPlay() {
    if (!this.training || this.countingDown || this.resetting || this.over) return;
    if (this.training === 'libre') this.kickoff(); else this.nextAttempt();
  }

  drawHud() {
    if (this.training) {
      const round = Math.min(this.attempts + 1, TRAINING_ROUNDS);
      this.scoreText.setText(this.training === 'libre' ? 'GOLES ' + this.hits
        : 'TIRO ' + round + '/' + TRAINING_ROUNDS + ' · ' + (this.training === 'tiros' ? 'GOLES ' : 'ATAJADAS ') + this.hits);
      this.hud.clear();
      this.hud.fillStyle(0xffd23f).fillRect(70, 20, 150, 12); // turbo infinito
      return;
    }
    const t = Math.ceil(this.timeLeft);
    const clock = this.golden ? 'ORO' : `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    this.scoreText.setText(`${this.score[0]}  ${clock}  ${this.score[1]}`);
    this.hud.clear();
    this.cars.forEach((c, i) => {
      const x = i === 0 ? 70 : W - 70 - 150;
      this.hud.fillStyle(c.boostEmpty ? 0x722d3b : 0x222222).fillRect(x, 20, 150, 12);
      this.hud.fillStyle(0xffd23f).fillRect(x, 20, 1.5 * c.boost, 12);
    });
  }
}

// Vista real de las canchas, con los mismos fondos y sprites que el partido.
class MenuPreview extends Phaser.Scene {
  constructor() { super('preview'); }
  preload() { Match.prototype.preload.call(this); }
  create(data) {
    const keys = Object.keys(STADIUMS), index = data.index ?? 0, key = keys[index], st = STADIUMS[key];
    Match.prototype.drawStadium.call(this, key);
    this.cameras.main.setScroll(0, 56); // la galería recorta la franja reservada al marcador
    st.cars.forEach((car, i) => this.add.image(i ? 940 : 340, FLOOR - 6, car).setOrigin(0.5, 1).setScale(2.1).setFlipX(!!i));
    $('previewName').textContent = st.name;
    $('menuPreview').setAttribute('aria-label', `Autos del juego en la cancha ${st.name}`);
    $('previewCount').textContent = `${index + 1} / ${keys.length}`;
    // El reloj del juego se ralentiza con FPS bajos; la galería usa segundos reales.
    const timer = setInterval(() => {
      if (!document.hidden && !$('menu').classList.contains('hidden')) this.scene.restart({ index: (index + 1) % keys.length });
    }, MENU_PREVIEW_MS);
    this.events.once('shutdown', () => clearInterval(timer));
    if (document.hidden || $('menu').classList.contains('hidden')) this.scene.pause();
  }
}

// ---------- Menú y apuestas ----------
const $ = id => document.getElementById(id);
const status = text => { $('status').textContent = text; };
let game, menuPreviewGame, betOn = false;
let mode = { training: null }; // qué se juega: partido (training: null) o un ejercicio de entrenamiento
const TRAINING_NAMES = { libre: 'LIBRE', tiros: 'TIROS', arquero: 'ARQUERO' };

// En entrenamiento hay un solo auto y se maneja con las teclas de cualquiera de los dos jugadores
function mergedControls() {
  const [a, b] = CONTROLS.local, out = {};
  for (const action in a) out[action] = [...a[action], ...b[action]];
  return out;
}

// ---------- Pantalla completa ----------
// Agranda todo el juego (canvas + menús) para llenar la ventana, sin deformarlo
function fitScreen() {
  const alto = innerHeight;
  const scale = Math.min(innerWidth / W, Math.max(1, alto) / H);
  $('wrap').style.setProperty('--game-top', `${alto / 2}px`);
  $('wrap').style.transform = `translate(-50%, -50%) scale(${scale})`;
  positionTouchButtons();
}
addEventListener('resize', fitScreen);

// ---------- Celular / pantalla táctil ----------
const coarsePointer = matchMedia('(any-pointer: coarse)');
let mobile = navigator.maxTouchPoints > 0 || coarsePointer.matches;
const touchButtons = [...document.querySelectorAll('.touch-button')];
let touchEditing = false, touchDraft = null, touchReturnFocus;
let touchLayout = { portrait: {}, landscape: {} };
try {
  const saved = JSON.parse(localStorage.getItem('touchLayout'));
  for (const orientation of ['portrait', 'landscape']) for (const b of touchButtons) {
    const p = saved?.[orientation]?.[b.dataset.action];
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1) touchLayout[orientation][b.dataset.action] = { x: p.x, y: p.y };
  }
} catch {}
function positionTouchButtons() {
  if ($('touchControls').classList.contains('hidden')) return;
  const area = $('touchControls').getBoundingClientRect(), orientation = innerWidth > innerHeight ? 'landscape' : 'portrait';
  const layout = (touchEditing ? touchDraft : touchLayout)[orientation];
  touchButtons.forEach((b, i) => {
    const w = b.offsetWidth, h = b.offsetHeight, p = layout[b.dataset.action];
    const defaults = [0, w + 8, area.width - 3 * w - 16, area.width - 2 * w - 8, area.width - w];
    b.style.left = `${Math.max(0, Math.min(area.width - w, p ? p.x * (area.width - w) : defaults[i]))}px`;
    b.style.top = `${Math.max(0, p ? p.y * (area.height - h) : area.height - h)}px`;
  });
}
function moveTouchButton(b, x, y) {
  const area = $('touchControls').getBoundingClientRect(), width = Math.max(1, area.width - b.offsetWidth), height = Math.max(1, area.height - b.offsetHeight);
  touchDraft[innerWidth > innerHeight ? 'landscape' : 'portrait'][b.dataset.action] = { x: Math.max(0, Math.min(1, x / width)), y: Math.max(0, Math.min(1, y / height)) };
  positionTouchButtons();
}
function openTouchEditor() {
  if (!mobile) return;
  clearTouches();
  touchReturnFocus = document.activeElement;
  touchDraft = JSON.parse(JSON.stringify(touchLayout));
  touchEditing = true;
  $('wrap').inert = true;
  $('touchEditor').classList.remove('hidden');
  $('touchEditorNote').textContent = 'Arrastrá cada botón. Con teclado, usá las flechas sobre el botón.';
  updateTouchControls();
  $('saveTouchLayout').focus();
}
function closeTouchEditor() {
  clearTouches();
  touchEditing = false;
  touchDraft = null;
  $('wrap').inert = false;
  $('touchEditor').classList.add('hidden');
  updateTouchControls();
  touchReturnFocus?.focus();
}
function clearTouches() {
  touchPointers.clear();
  touchDrags.clear();
  for (const b of touchButtons) { b.classList.remove('pressed'); b.setAttribute('aria-pressed', 'false'); }
}
function updateTouchControls() {
  const playing = !!game && !$('wrap').querySelector('.overlay:not(.hidden)');
  document.body.classList.toggle('mobile', mobile);
  document.body.classList.toggle('playing', playing);
  document.body.classList.toggle('touch-editing', touchEditing);
  $('touchControls').classList.toggle('hidden', !mobile || (!playing && !touchEditing));
  if (!mobile || (!playing && !touchEditing)) clearTouches();
  if (menuPreviewGame) {
    const visible = !document.hidden && !$('menu').classList.contains('hidden');
    if (!visible && menuPreviewGame.scene.isActive('preview')) menuPreviewGame.scene.pause('preview');
    else if (visible && menuPreviewGame.scene.isPaused('preview')) menuPreviewGame.scene.resume('preview');
  }
  $('touchPause').classList.toggle('hidden', !!mode.online);
  $('touchReset').classList.toggle('hidden', !mode.training);
  $('touchSwitch').classList.toggle('hidden', !!mode.online || !!mode.training);
  const player = mode.online === 'guest' ? 1 : mode.online || mode.training ? 0 : touchPlayer;
  $('touchCar').textContent = player ? 'AUTO AZUL' : 'AUTO ROJO';
  $('touchCar').className = player ? 'p2' : 'p1';
  fitScreen();
}
for (const b of touchButtons) {
  b.addEventListener('pointerdown', e => {
    if (e.button !== 0 || $('touchControls').classList.contains('hidden')) return;
    e.preventDefault();
    b.setPointerCapture(e.pointerId); // sigue recibiendo la suelta aunque el dedo salga del botón
    if (touchEditing) {
      const rect = b.getBoundingClientRect();
      touchDrags.set(e.pointerId, { b, dx: e.clientX - rect.left, dy: e.clientY - rect.top });
      return;
    }
    touchPointers.set(e.pointerId, b.dataset.action);
    b.classList.add('pressed');
    b.setAttribute('aria-pressed', 'true');
  });
  const release = e => {
    touchDrags.delete(e.pointerId);
    touchPointers.delete(e.pointerId);
    const active = [...touchPointers.values()].includes(b.dataset.action);
    b.classList.toggle('pressed', active);
    b.setAttribute('aria-pressed', String(active));
  };
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(event, release);
  b.addEventListener('pointermove', e => {
    const drag = touchDrags.get(e.pointerId);
    if (!touchEditing || !drag) return;
    const area = $('touchControls').getBoundingClientRect();
    moveTouchButton(b, e.clientX - area.left - drag.dx, e.clientY - area.top - drag.dy);
  });
  b.addEventListener('keydown', e => {
    if (!touchEditing || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) return;
    e.preventDefault(); e.stopPropagation();
    moveTouchButton(b, parseFloat(b.style.left) + (e.code === 'ArrowRight' ? 10 : e.code === 'ArrowLeft' ? -10 : 0), parseFloat(b.style.top) + (e.code === 'ArrowDown' ? 10 : e.code === 'ArrowUp' ? -10 : 0));
  });
  b.addEventListener('contextmenu', e => e.preventDefault());
}
addEventListener('blur', clearTouches);
document.addEventListener('visibilitychange', () => { if (document.hidden) { held.clear(); clearTouches(); } updateTouchControls(); });
addEventListener('pointerdown', e => {
  if (e.pointerType === 'touch' && !mobile) { mobile = true; updateTouchControls(); }
}, { capture: true });
coarsePointer.addEventListener('change', () => { mobile = navigator.maxTouchPoints > 0 || coarsePointer.matches; updateTouchControls(); });
// Los mismos overlays cubren pausa, resultado, desconexión y menú: un solo punto libera los dedos.
new MutationObserver(updateTouchControls).observe($('wrap'), { subtree: true, attributes: true, attributeFilter: ['class'] });
$('touchPause').onclick = pauseGame;
$('touchReset').onclick = () => { clearTouches(); game?.scene.getScene('match').resetPlay(); };
// ponytail: en local se maneja un auto a la vez; el rival usa teclado/joystick. Dos celulares usan online.
$('touchSwitch').onclick = () => { clearTouches(); touchPlayer = 1 - touchPlayer; updateTouchControls(); };
$('openTouchLayout').onclick = $('pauseTouchLayout').onclick = openTouchEditor;
$('cancelTouchLayout').onclick = closeTouchEditor;
$('resetTouchLayout').onclick = () => { touchDraft = { portrait: {}, landscape: {} }; positionTouchButtons(); };
$('saveTouchLayout').onclick = () => {
  try { localStorage.setItem('touchLayout', JSON.stringify(touchDraft)); }
  catch { $('touchEditorNote').textContent = 'No se pudo guardar en este navegador. Probá otra vez o cancelá.'; return; }
  touchLayout = touchDraft;
  closeTouchEditor();
};
updateTouchControls();

function enterFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {}); // si el navegador no deja, sigue en ventana
}
$('fullscreen').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : enterFullscreen());

function startMatch(withBet) {
  betOn = withBet;
  mode = { training: null };
  launch();
}

function startTraining(drill) {
  betOn = false;
  mode = { training: drill };
  launch();
}

function launch() {
  clearTouches();
  touchPlayer = 0;
  enterFullscreen(); // al empezar a jugar pasa a pantalla completa (ESC para salir)
  for (const id of ['menu', 'training', 'result', 'pause', 'online']) $(id).classList.add('hidden');
  document.activeElement?.blur(); // que Espacio/Enter no vuelvan a apretar el botón
  if (!game) {
    game = new Phaser.Game({
      type: Phaser.AUTO, width: W, height: H, parent: 'game', pixelArt: true, backgroundColor: '#1a1a2e',
      physics: { default: 'matter', matter: { gravity: { y: 1 } } },
      input: { gamepad: true },
      scene: Match,
    });
  } else {
    game.scene.start('match');
  }
}

window.onTrainingEnd = (drill, hits) => {
  $('winner').textContent = (drill === 'tiros' ? 'GOLES: ' : 'ATAJADAS: ') + hits + ' / ' + TRAINING_ROUNDS;
  $('winner').className = '';
  $('payout').textContent = hits >= 8 ? '¡Sos un crack!' : hits >= 5 ? '¡Bien! Seguí practicando' : 'A seguir entrenando';
  $('again').disabled = false;
  $('retry').classList.remove('hidden');
  $('result').classList.remove('hidden');
};

window.onMatchEnd = async (winner, score, names = playerNames()) => {
  $('retry').classList.add('hidden');
  $('winner').textContent = `¡GANA ${names[winner]}! ${score[0]} - ${score[1]}`;
  $('winner').className = winner ? 'p2' : 'p1';
  $('payout').textContent = '';
  $('again').disabled = betOn;
  $('result').classList.remove('hidden');
  if (!betOn) return;
  $('payout').textContent = 'Pagando el premio...';
  try {
    const sig = await payWinner(winner);
    $('payout').innerHTML = `Premio enviado: <a target="_blank" href="${explorer(sig)}">ver en Explorer</a>`;
  } catch (e) {
    $('payout').textContent = `Falló el pago: ${e.message}. Usá "Devolver apuestas".`;
  }
  $('again').disabled = false;
};

async function refreshMenu() {
  const any = bet.players.some(Boolean);
  if (any) $('amount').value = bet.lamports / LAMPORTS_PER_SOL;
  $('amount').disabled = any;
  $('dep1').disabled = !!bet.players[0];
  $('dep2').disabled = !!bet.players[1];
  $('play').disabled = !bet.players.every(Boolean);
  $('refund').disabled = !any;
  $('pot').textContent = pot.publicKey.toBase58();
  try { $('potBal').textContent = (await potBalance()).toFixed(3); } catch { $('potBal').textContent = '?'; }
}

async function onDeposit(i) {
  try {
    status(`J${i + 1}: esperando la firma en Phantom...`);
    await deposit(i, Number($('amount').value));
    status(`J${i + 1} apostó ✔`);
  } catch (e) {
    status(e.message);
  }
  refreshMenu();
}

// ---------- Configuración de controles ----------
const ACTIONS = { left: 'Izquierda', right: 'Derecha', jump: 'Saltar', down: 'Bajar', boost: 'Turbo' };
const KEY_NAMES = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'ESPACIO', ShiftLeft: 'SHIFT IZQ', ShiftRight: 'SHIFT DER', ControlLeft: 'CTRL IZQ', ControlRight: 'CTRL DER', Enter: 'ENTER', Slash: '- /', Numpad0: 'NUM 0' };
const keyName = code => KEY_NAMES[code] ?? code.replace(/^(Key|Digit|Numpad)/, '').toUpperCase();
let waiting = null; // { p, a } mientras se espera la tecla nueva

function bindKey(p, a, code) {
  const old = CONTROLS.local[p][a][0];
  for (const set of CONTROLS.local) for (const k in set) if (set[k][0] === code) set[k] = [old]; // si ya estaba usada, se intercambian
  CONTROLS.local[p][a] = [code];
  saveControls();
}

function renderControls() {
  $('controlsTable').innerHTML = '<tr><th></th><th class="p1">J1</th><th class="p2">J2</th></tr>' +
    Object.entries(ACTIONS).map(([a, label]) => `<tr><td>${label}</td>${[0, 1].map(p =>
      `<td><button data-p="${p}" data-a="${a}">${waiting?.p === p && waiting.a === a ? '...' : keyName(CONTROLS.local[p][a][0])}</button></td>`
    ).join('')}</tr>`).join('');
  $('help').innerHTML = CONTROLS.local.map((k, i) =>
    `J${i + 1}: ${keyName(k.left[0])}/${keyName(k.right[0])} mover · ${keyName(k.jump[0])} saltar · ${keyName(k.down[0])} bajar · ${keyName(k.boost[0])} turbo<br>`
  ).join('');
}

$('controlsTable').onclick = e => {
  const b = e.target.closest('button');
  if (!b) return;
  waiting = { p: Number(b.dataset.p), a: b.dataset.a };
  renderControls();
};
addEventListener('keydown', e => {
  if (!waiting) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  if (e.code !== 'Escape') bindKey(waiting.p, waiting.a, e.code);
  waiting = null;
  renderControls();
}, true);
let configFrom = 'menu'; // a dónde vuelve la pantalla de controles: al menú o a la pausa
$('openControls').onclick = () => { configFrom = 'menu'; $('menu').classList.add('hidden'); $('config').classList.remove('hidden'); };
$('closeControls').onclick = () => { waiting = null; renderControls(); $('config').classList.add('hidden'); $(configFrom).classList.remove('hidden'); };

// ---------- Pausa ----------
function pauseGame() {
  if (mode.online) return; // online no se puede pausar (el otro sigue jugando)
  if (!game?.scene.isActive('match') || game.scene.getScene('match').over) return; // solo si se está jugando
  game.scene.pause('match');
  $('pause').classList.remove('hidden');
}
function resumeGame() {
  $('pause').classList.add('hidden');
  held.clear(); // que no quede una tecla "apretada" de antes de la pausa
  game.scene.resume('match');
}
function backToMenu() {
  if (mode.online) { net.leaveRoom(); mode = { training: null }; }
  for (const id of ['pause', 'result', 'training', 'online']) $(id).classList.add('hidden');
  game?.scene.stop('match');
  $('menu').classList.remove('hidden');
  status('');
  refreshMenu();
}
addEventListener('keydown', e => {
  if (touchEditing) { if (e.code === 'Escape') { e.preventDefault(); closeTouchEditor(); } return; }
  if (e.target.tagName === 'INPUT' || !$('config').classList.contains('hidden')) return; // escribiendo o en controles
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (game?.scene.isPaused('match')) resumeGame(); else pauseGame();
  }
  if (e.code === 'KeyR' && game?.scene.isActive('match')) game.scene.getScene('match').resetPlay();
});
// En pantalla completa, ESC la cierra (eso lo hace el navegador): aprovechamos y pausamos
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) pauseGame(); });
$('resume').onclick = resumeGame;
$('restart').onclick = () => { $('pause').classList.add('hidden'); held.clear(); launch(); };
$('pauseControls').onclick = () => { configFrom = 'pause'; $('pause').classList.add('hidden'); $('config').classList.remove('hidden'); };
$('quit').onclick = backToMenu;

// ---------- Online ----------
const onlineStatus = text => { $('onlineStatus').textContent = text; };
function openOnline() {
  $('menu').classList.add('hidden');
  $('online').classList.remove('hidden');
  $('roomCode').textContent = '';
  onlineStatus('');
}
$('openOnline').onclick = openOnline;
$('closeOnline').onclick = () => { net.leaveRoom(); $('online').classList.add('hidden'); $('menu').classList.remove('hidden'); };
$('createRoom').onclick = async () => {
  try {
    onlineStatus('Conectando...');
    await net.connect();
    net.role = 'host';
    net.names = [account?.name ?? 'JUGADOR 1', ''];
    net.inviting = null;
    net.send({ t: 'create', name: net.names[0] });
  } catch (e) { onlineStatus(e.message); }
};
$('joinRoom').onclick = async () => {
  const code = $('joinCode').value.trim().toUpperCase();
  if (code.length !== 4) return onlineStatus('El código tiene 4 letras');
  try {
    onlineStatus('Conectando...');
    await net.connect();
    net.role = 'guest';
    net.send({ t: 'join', code, name: account?.name ?? 'JUGADOR 2' });
  } catch (e) { onlineStatus(e.message); }
};
$('joinCode').onkeydown = e => { if (e.key === 'Enter') $('joinRoom').click(); };

net.onMessage = msg => {
  const scene = game?.scene.getScene('match');
  if (msg.t === 's') {
    if (!scene || mode.online !== 'guest') return;
    // Si llegan varios estados juntos se dibuja el último, pero sin perder las explosiones y carteles de los anteriores
    msg.ev = [...(scene.netState?.ev ?? []), ...msg.ev];
    scene.netState = msg;
    return;
  }
  if (msg.t === 'in') { if (scene && mode.online === 'host') scene.remote = msg; return; }
  if (msg.t === 'created') {
    $('roomCode').textContent = msg.code;
    onlineStatus(net.inviting ? `Invitaste a ${net.inviting}. Esperando que acepte...` : 'Pasale el código a tu rival. Esperando que se una...');
  } else if (msg.t === 'guest') {
    // Llegó el rival: arranca el partido con la pelota original para los dos.
    net.names[1] = msg.name;
    net.send({ t: 'start', stadium: selectedStadium(), ballKey: BALL_KEY, names: net.names });
    betOn = false;
    mode = { training: null, online: 'host' };
    launch();
  } else if (msg.t === 'joined') {
    onlineStatus(`Entraste a la sala de ${msg.host}. Arrancando...`);
  } else if (msg.t === 'start') {
    $('stadium').value = msg.stadium; // se juega en la cancha del anfitrión
    net.names = msg.names;
    betOn = false;
    mode = { training: null, online: 'guest' };
    launch();
  } else if (msg.t === 'end') {
    if (scene) scene.over = true;
    window.onMatchEnd(msg.winner, msg.score, net.names.map(n => n.toUpperCase()));
  } else if (msg.t === 'error') {
    onlineStatus(msg.text);
    friendsStatus(msg.text);
    net.role = null;
  } else if (msg.t === 'left') {
    const playing = mode.online && $('result').classList.contains('hidden');
    net.role = null;
    if (playing) { backToMenu(); openOnline(); }
    onlineStatus('El otro jugador se desconectó.');
  } else if (msg.t === 'hello_err') {
    friendsStatus(msg.text);
  } else if (msg.t === 'status') {
    friendState = msg.status;
    renderFriends();
  } else if (msg.t === 'invite') {
    showInvite(msg.from, msg.code);
  } else if (msg.t === 'declined') {
    net.leaveRoom();
    onlineStatus(`${msg.name} no aceptó la invitación.`);
    $('roomCode').textContent = '';
  }
};

// ---------- Amigos ----------
// La lista se guarda en este navegador. El servidor dice quién está conectado y pasa las invitaciones.
let friends = [];
try { friends = JSON.parse(localStorage.getItem('friends')) ?? []; } catch {}
let friendState = {}; // nombre -> 'online' | 'playing' | 'offline'
const saveFriends = () => { try { localStorage.setItem('friends', JSON.stringify(friends)); } catch {} };
const friendsStatus = text => { $('friendsStatus').textContent = text; };
const FRIEND_LABEL = { online: '🟢 conectado', playing: '🟡 jugando', offline: '⚫ desconectado' };

function renderFriends() {
  $('friendsList').innerHTML = friends.length ? '' : '<small>Todavía no agregaste amigos.</small>';
  for (const name of friends) {
    const state = net.ready ? friendState[name] ?? 'offline' : 'offline';
    const row = document.createElement('div');
    row.className = 'friend';
    row.innerHTML = '<span class="fname"></span><span class="fstate"></span>';
    row.querySelector('.fname').textContent = name;
    row.querySelector('.fstate').textContent = FRIEND_LABEL[state];
    const invite = document.createElement('button');
    invite.textContent = 'INVITAR';
    invite.disabled = state !== 'online';
    invite.onclick = () => inviteFriend(name);
    const remove = document.createElement('button');
    remove.className = 'small';
    remove.textContent = '✖';
    remove.title = 'Sacar de la lista';
    remove.onclick = () => { friends = friends.filter(f => f !== name); saveFriends(); renderFriends(); };
    row.append(invite, remove);
    $('friendsList').append(row);
  }
}

function addFriend() {
  const name = $('friendName').value.trim();
  if (!USERNAME_RE.test(name)) return friendsStatus('Escribí un nombre de usuario (3 a 12 letras, números o _)');
  if (name.toLowerCase() === (account?.name ?? '').toLowerCase()) return friendsStatus('Ese sos vos 🙂');
  if (friends.some(f => f.toLowerCase() === name.toLowerCase())) return friendsStatus('Ya está en tu lista');
  friends.push(name);
  saveFriends();
  $('friendName').value = '';
  friendsStatus(`Agregaste a ${name}`);
  askFriendStatus();
  renderFriends();
}

const askFriendStatus = () => { if (net.ready && friends.length) net.send({ t: 'status', names: friends }); };
let friendsTimer = null;
function openFriends() {
  $('menu').classList.add('hidden');
  $('friends').classList.remove('hidden');
  friendsStatus(net.ready ? '' : 'Sin conexión al servidor: la lista se guarda igual, pero para ver quién está conectado e invitar hace falta el servidor (npm start).');
  renderFriends();
  askFriendStatus();
  friendsTimer = setInterval(askFriendStatus, 3000); // se actualiza sola mientras está abierta
}
function closeFriends() {
  clearInterval(friendsTimer);
  $('friends').classList.add('hidden');
  $('menu').classList.remove('hidden');
}
$('openFriends').onclick = openFriends;
$('closeFriends').onclick = closeFriends;
$('addFriend').onclick = addFriend;
$('friendName').onkeydown = e => { if (e.key === 'Enter') addFriend(); };

// Invitar: el servidor arma la sala y le avisa al amigo. Si acepta, arranca el partido como siempre.
function inviteFriend(name) {
  clearInterval(friendsTimer);
  $('friends').classList.add('hidden');
  openOnline();
  net.role = 'host';
  net.names = [account?.name ?? 'JUGADOR 1', ''];
  net.inviting = name;
  net.send({ t: 'invite', to: name });
  onlineStatus(`Invitaste a ${name}. Esperando que acepte...`);
}

// Cartel de invitación (aparece arriba de todo mientras estás en los menús)
let pendingInvite = null;
function showInvite(from, code) {
  const playing = game?.scene.isActive('match') || game?.scene.isPaused('match');
  if (playing || !$('register').classList.contains('hidden')) return net.send({ t: 'decline', code }); // ocupado
  pendingInvite = code;
  $('inviteText').textContent = `🎮 ${from} te invita a jugar`;
  $('invite').classList.remove('hidden');
}
$('acceptInvite').onclick = () => {
  $('invite').classList.add('hidden');
  for (const id of ['friends', 'training', 'config', 'result']) $(id).classList.add('hidden');
  clearInterval(friendsTimer);
  openOnline();
  net.role = 'guest';
  net.send({ t: 'join', code: pendingInvite, name: account?.name ?? 'JUGADOR 2' });
  onlineStatus('Uniéndote...');
};
$('declineInvite').onclick = () => {
  $('invite').classList.add('hidden');
  net.send({ t: 'decline', code: pendingInvite });
};

// Si se corta o vuelve la conexión, se actualiza la lista de amigos
net.onChange = () => { if ($('friends') && !$('friends').classList.contains('hidden')) { friendsStatus(net.ready ? '' : 'Se cortó la conexión. Reconectando...'); renderFriends(); askFriendStatus(); } };

// ---------- Menú de entrenamiento ----------
$('openTraining').onclick = () => { $('menu').classList.add('hidden'); $('training').classList.remove('hidden'); };
$('closeTraining').onclick = () => { $('training').classList.add('hidden'); $('menu').classList.remove('hidden'); };
for (const drill of Object.keys(TRAINING_NAMES)) $('train_' + drill).onclick = () => startTraining(drill);
$('retry').onclick = () => startTraining(mode.training);
$('resetControls').onclick = () => { CONTROLS.local = JSON.parse(DEFAULT_LOCAL); saveControls(); waiting = null; renderControls(); };
renderControls();

$('dep1').onclick = () => onDeposit(0);
$('dep2').onclick = () => onDeposit(1);
$('play').onclick = () => startMatch(true);
$('free').onclick = () => startMatch(false);
$('again').onclick = backToMenu;
$('refund').onclick = async () => {
  try {
    status('Devolviendo...');
    await refund();
    status('Apuestas devueltas ✔');
  } catch (e) {
    status(`Falló: ${e.message}`);
  }
  refreshMenu();
};
$('airdrop').onclick = async () => {
  try {
    status('Pidiendo SOL de prueba...');
    await airdropPot();
    status('Pozo cargado ✔');
  } catch {
    status('Airdrop limitado: cargá el pozo desde faucet.solana.com');
  }
  refreshMenu();
};

refreshMenu();

// ---------- Cuenta ----------
// ponytail: la cuenta se guarda solo en este navegador. Para el modo online hará falta un servidor
// que guarde las cuentas y verifique que el nombre no esté repetido.
const USERNAME_RE = /^[\p{L}\p{N}_]{3,12}$/u; // letras (con tilde y ñ), números y _
let account = null;
try { account = JSON.parse(localStorage.getItem('account')); } catch {}

function showRegister() {
  $('menu').classList.add('hidden');
  $('register').classList.remove('hidden');
  $('username').value = account?.name ?? '';
  $('regError').textContent = '';
  $('username').focus();
}

function register() {
  const name = $('username').value.trim();
  if (!USERNAME_RE.test(name)) {
    $('regError').textContent = 'Usá de 3 a 12 letras, números o _';
    return;
  }
  account = { name, createdAt: account?.createdAt ?? new Date().toISOString() };
  try { localStorage.setItem('account', JSON.stringify(account)); } catch {}
  $('accountName').textContent = name;
  net.hello(name); // los amigos te ven con el nombre nuevo
  $('register').classList.add('hidden');
  $('menu').classList.remove('hidden');
}

// Cancha elegida en el menú (se guarda para la próxima)
const FIRST_STADIUM = Object.keys(STADIUMS)[0];
function selectedStadium() {
  return STADIUMS[$('stadium').value] ? $('stadium').value : FIRST_STADIUM;
}
$('stadium').innerHTML = Object.entries(STADIUMS).map(([key, s]) => `<option value="${key}">${s.name}</option>`).join('');
try { $('stadium').value = localStorage.getItem('stadium') ?? FIRST_STADIUM; } catch {}
if (!$('stadium').value) $('stadium').value = FIRST_STADIUM; // si estaba guardada una cancha que ya no existe
$('stadium').onchange = () => { try { localStorage.setItem('stadium', $('stadium').value); } catch {} };

// Nombres de los dos jugadores: J1 (rojo) es el rival que se escribe en el menú, J2 (azul) es la cuenta
function playerNames() {
  const rival = $('p2name').value.trim();
  return [USERNAME_RE.test(rival) ? rival : 'JUGADOR 1', account?.name ?? 'JUGADOR 2'].map(n => n.toUpperCase());
}
try { $('p2name').value = localStorage.getItem('p2name') ?? ''; } catch {}
$('p2name').onchange = () => { try { localStorage.setItem('p2name', $('p2name').value.trim()); } catch {} };

$('registerBtn').onclick = register;
$('username').onkeydown = e => { if (e.key === 'Enter') register(); };
$('changeAccount').onclick = showRegister;
if (account) $('accountName').textContent = account.name;
else showRegister();

// Conectarse al servidor apenas abre la página (si hay servidor) para aparecer conectado a los amigos
if (account) net.me = account.name;
net.connect().catch(() => {}); // sin servidor (python) simplemente no hay online

// ponytail: vista sin física a 20 FPS, pausada fuera del menú; si crece, precalcular las seis imágenes.
menuPreviewGame = new Phaser.Game({ type: Phaser.AUTO, width: W, height: H - 56, parent: 'menuPreview', pixelArt: true,
  backgroundColor: '#020617', audio: { noAudio: true }, fps: { target: 20, limit: 20 }, scene: MenuPreview });
