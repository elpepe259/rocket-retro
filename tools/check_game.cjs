// Correr: node tools/check_game.cjs. Usa drive/kickoff reales, sin navegador ni dependencias nuevas.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const mensajes = [];
const eventos = new Map();
const contexto = vm.createContext({
  Phaser: { Scene: class {} }, localStorage: { getItem: () => null },
  addEventListener: (nombre, fn) => { if (!eventos.has(nombre)) eventos.set(nombre, []); eventos.get(nombre).push(fn); },
  net: { send: msg => mensajes.push(msg) },
});
const fuente = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
vm.runInContext(fuente.slice(0, fuente.indexOf('// ---------- Menú y apuestas ----------')) + '\nthis.Match = Match;', contexto);
function objeto() {
  const obj = { x: 640, y: 250, angle: 0, scaleX: 1, scaleY: 1, scale: 1, visible: true,
    body: { velocity: { x: 0, y: 0 } }, texture: { key: 'barrio1' } };
  for (const metodo of ['setAngle', 'setFlipX', 'setScale', 'setStatic', 'setVisible', 'setAngularVelocity', 'setColor', 'setText']) obj[metodo] = () => obj;
  obj.setPosition = (x, y) => { obj.x = x; obj.y = y; return obj; };
  obj.setVelocity = (x, y) => { obj.body.velocity.x = x; obj.body.velocity.y = y; return obj; };
  obj.setVelocityX = x => { obj.body.velocity.x = x; return obj; };
  obj.setVelocityY = y => { obj.body.velocity.y = y; return obj; };
  return obj;
}
function auto() {
  return { body: objeto(), view: objeto(), boost: 100, boostEmpty: false, grounded: false,
    facing: 1, angle: 0, pitch: 0, sx: 1, sy: 1, viewDy: 0, jumps: 2, airFrames: 20,
    startX: 320, y0: 476, startFacing: 1 };
}
const escena = new contexto.Match();
let teclas = { boost: false };
escena.readInput = () => teclas;
escena.animateCar = () => ({ shake: 0 });
escena.shootFlame = () => {};
escena.training = null;
const car = auto();
car.boost = 40;
escena.drive(car);
assert.ok(car.boost > 40, 'La recarga parcial sigue funcionando en el aire.');
car.boost = 0.5;
teclas.boost = true;
escena.drive(car);
assert.equal(car.boost, 0, 'El último resto se consume sin quedar negativo.');
assert.equal(car.boostEmpty, true);
for (let i = 0; i < 120; i++) escena.drive(car);
assert.equal(car.boost, 0, 'Mantener turbo no permite recargar sin tocar suelo.');
teclas.boost = false;
for (let i = 0; i < 120; i++) escena.drive(car);
assert.equal(car.boost, 0, 'Soltar turbo tampoco desbloquea la recarga en el aire.');
car.grounded = true;
escena.drive(car);
assert.equal(car.boostEmpty, false);
assert.ok(car.boost > 0, 'El primer contacto con el suelo habilita la recarga.');
const recargado = car.boost;
escena.drive(car);
assert.ok(car.boost > recargado, 'Tras tocar suelo, puede seguir recargando en el aire.');
car.boost = 0.2;
car.grounded = true;
teclas.boost = true;
escena.drive(car);
assert.equal(car.boostEmpty, false, 'Agotarlo estando apoyado no exige un segundo aterrizaje.');
teclas.boost = false;
escena.drive(car);
assert.ok(car.boost > 0);
for (const training of ['libre', 'tiros', 'arquero']) {
  escena.training = training;
  const aprendiz = auto();
  teclas.boost = true;
  for (let i = 0; i < 150; i++) escena.drive(aprendiz);
  assert.equal(aprendiz.boost, 100);
  assert.equal(aprendiz.boostEmpty, false);
}
escena.training = null;
escena.cars = [car];
escena.ball = objeto();
escena.msg = objeto();
escena.scorerText = objeto();
car.boostEmpty = true;
escena.kickoff();
assert.equal(car.boost, 100);
assert.equal(car.boostEmpty, false, 'Un saque nuevo restablece la stamina.');
car.boostEmpty = true;
escena.netEvents = [];
escena.msg.style = escena.scorerText.style = { color: '#fff' };
escena.sendSnapshot();
assert.ok(mensajes.at(-1).c[0][9] & 4, 'El invitado recibe el bloqueo para dibujar la barra agotada.');

// El lector real debe juntar dedos, teclas y joystick sin controlar al rival online.
vm.runInContext('let mode = { training: null };\n' +
  fuente.slice(fuente.indexOf('function mergedControls()'), fuente.indexOf('// ---------- Pantalla completa ----------')) +
  '\nthis.touchPointers = touchPointers; this.held = held; this.setMode = valor => mode = valor; this.setTouchPlayer = valor => touchPlayer = valor;', contexto);
const entrada = new contexto.Match();
entrada.input = {};
entrada.drawHud = () => {};
const rojo = { player: 0 }, azul = { player: 1 };
contexto.touchPointers.set(1, 'right');
contexto.touchPointers.set(2, 'boost');
contexto.touchPointers.set(3, 'jump');
let estado = entrada.readInput(rojo);
assert.ok(estado.right && estado.boost && estado.jumpPressed, 'Mover, turbo y salto funcionan juntos.');
assert.equal(entrada.readInput(rojo).jumpPressed, false, 'Mantener salto no dispara saltos nuevos.');
assert.equal(entrada.readInput(azul).right, false, 'En local solo se toca el auto elegido.');
contexto.setTouchPlayer(1);
assert.equal(entrada.readInput(azul).right, true);
contexto.held.add('KeyA');
assert.equal(entrada.readInput(rojo).left, true, 'El táctil no reemplaza el teclado.');
contexto.held.clear();
contexto.setMode({ online: 'host' });
assert.equal(entrada.readInput(rojo).right, true, 'El anfitrión siempre controla su auto.');
assert.equal(entrada.readInput(azul).right, false, 'Los dedos del host no controlan al invitado.');
contexto.setMode({ online: 'guest' });
entrada.updateGuest();
assert.ok(mensajes.at(-1).r && mensajes.at(-1).b && mensajes.at(-1).js === 1, 'El invitado manda los botones y el salto por el protocolo existente.');
entrada.updateGuest();
assert.equal(mensajes.at(-1).js, 1);
contexto.touchPointers.delete(3);
entrada.updateGuest();
contexto.touchPointers.set(4, 'jump');
entrada.updateGuest();
assert.equal(mensajes.at(-1).js, 2, 'Soltar y tocar otra vez permite el doble salto online.');
contexto.setMode({ training: 'libre' });
entrada.training = 'libre';
assert.equal(entrada.readInput(rojo).right, true, 'Entrenamiento usa el único auto aunque antes se eligiera azul.');

// Ejecuta los listeners reales con dedos independientes y los cambios de pantalla.
function elemento(clases = []) {
  const lista = new Set(clases);
  return { dataset: {}, handlers: {}, atributos: {}, style: { setProperty: (k, v) => { nodos.wrap.style[k] = v; } },
    classList: { contains: k => lista.has(k), add: k => lista.add(k), remove: k => lista.delete(k),
      toggle: (k, valor) => { if (valor) lista.add(k); else lista.delete(k); } },
    addEventListener(nombre, fn) { this.handlers[nombre] = fn; },
    setAttribute(k, v) { this.atributos[k] = v; }, setPointerCapture(id) { this.capturado = id; } };
}
const nodos = Object.fromEntries(['wrap', 'touchControls', 'touchPause', 'touchReset', 'touchSwitch', 'touchCar'].map(k => [k, elemento()]));
const botones = ['left', 'right', 'down', 'jump', 'boost'].map(action => Object.assign(elemento(), { dataset: { action } }));
let overlay = true;
nodos.wrap.querySelector = () => overlay ? {} : null;
Object.defineProperty(nodos.touchControls, 'offsetHeight', { get: () => nodos.touchControls.classList.contains('hidden') ? 0 : 120 });
const coarse = { matches: false, addEventListener: () => {} };
let observer;
contexto.document = { body: elemento(), hidden: false, handlers: {}, getElementById: k => nodos[k],
  querySelectorAll: () => botones, addEventListener(nombre, fn) { this.handlers[nombre] = fn; } };
contexto.navigator = { maxTouchPoints: 0 };
contexto.matchMedia = () => coarse;
contexto.innerWidth = 390;
contexto.innerHeight = 844;
contexto.MutationObserver = class { constructor(fn) { observer = fn; } observe() {} };
contexto.pauseGame = () => {};
vm.runInContext('const $ = id => document.getElementById(id); let game = {};\n' +
  fuente.slice(fuente.indexOf('// ---------- Pantalla completa ----------'), fuente.indexOf('function enterFullscreen()')), contexto);
assert.equal(contexto.document.body.classList.contains('mobile'), false, 'Desktop no muestra el mando táctil.');
assert.ok(nodos.touchControls.classList.contains('hidden'));
overlay = false;
for (const fn of eventos.get('pointerdown')) fn({ pointerType: 'touch' });
assert.ok(contexto.document.body.classList.contains('mobile'), 'Un toque real también activa el modo móvil.');
assert.equal(nodos.touchControls.classList.contains('hidden'), false);
assert.equal(nodos.wrap.style['--game-top'], '362px', 'Se reserva espacio para los botones en vertical.');
contexto.innerWidth = 844;
contexto.innerHeight = 390;
contexto.fitScreen();
assert.equal(nodos.wrap.style['--game-top'], '135px', 'También se reserva espacio en horizontal.');
const tocar = (indice, pointerId) => botones[indice].handlers.pointerdown({ pointerId, button: 0, preventDefault() {} });
tocar(1, 10);
tocar(4, 11);
assert.ok(contexto.touchPointers.has(10) && contexto.touchPointers.has(11));
assert.equal(botones[1].capturado, 10);
botones[1].handlers.pointercancel({ pointerId: 10 });
assert.equal(contexto.touchPointers.has(10), false);
assert.equal(contexto.touchPointers.has(11), true, 'Cancelar un dedo no suelta el turbo del otro.');
tocar(4, 12);
botones[4].handlers.pointerup({ pointerId: 11 });
assert.ok(botones[4].classList.contains('pressed'), 'Dos dedos en el mismo botón se sueltan por separado.');
botones[4].handlers.lostpointercapture({ pointerId: 12 });
assert.equal(contexto.touchPointers.size, 0);
tocar(3, 13);
for (const fn of eventos.get('blur')) fn();
assert.equal(contexto.touchPointers.size, 0);
assert.equal(botones[3].atributos['aria-pressed'], 'false');
tocar(0, 14);
contexto.document.hidden = true;
contexto.document.handlers.visibilitychange();
assert.equal(contexto.touchPointers.size, 0, 'Al cambiar de pestaña se liberan las acciones.');
tocar(0, 15);
overlay = true;
observer();
assert.ok(nodos.touchControls.classList.contains('hidden'));
assert.equal(contexto.touchPointers.size, 0, 'Pausa, menú y resultado liberan los dedos.');
tocar(4, 16);
assert.equal(contexto.touchPointers.size, 0, 'Los botones ocultos no generan entradas.');
console.log('OK: stamina, saque, multitáctil, captura/cancelación, pantallas y controles online.');
