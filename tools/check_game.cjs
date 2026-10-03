// Correr: node tools/check_game.cjs. Usa drive/kickoff reales, sin navegador ni dependencias nuevas.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const mensajes = [];
const contexto = vm.createContext({
  Phaser: { Scene: class {} }, localStorage: { getItem: () => null }, addEventListener: () => {},
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
console.log('OK: recarga parcial, agotamiento, aterrizaje, entrenamiento, saque y estado online.');
