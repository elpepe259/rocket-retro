// Correr desde cualquier carpeta: node tools/check_stadiums.cjs
// Comprueba las seis canchas y sus sprites; el aspecto y los tweens se revisan en el navegador.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const metodos = ['fillStyle', 'lineStyle', 'fillRect', 'strokeRect', 'fillCircle', 'strokeCircle',
  'fillEllipse', 'strokeEllipse', 'fillTriangle', 'fillPoints', 'strokePoints', 'lineBetween',
  'slice', 'fillPath', 'setOrigin', 'setShadow', 'setStroke', 'setAngle', 'setAlpha', 'setPosition'];
function dibujo(x = 0, y = 0) {
  const obj = { x, y, alpha: 1 };
  for (const metodo of metodos) obj[metodo] = (...args) => {
    for (const valor of args.flat()) {
      if (typeof valor === 'number') assert.ok(Number.isFinite(valor), `${metodo}: número inválido`);
      if (valor && typeof valor === 'object') assert.ok(Number.isFinite(valor.x) && Number.isFinite(valor.y));
    }
    if (metodo === 'fillStyle' || metodo === 'lineStyle') {
      const color = args[metodo === 'fillStyle' ? 0 : 1];
      assert.ok(Number.isInteger(color) && color >= 0 && color <= 0xffffff);
    }
    return obj;
  };
  return obj;
}
const contexto = vm.createContext({ W: 1280, H: 540, FIELD_TOP: 380, FLOOR: 500, FONT: {}, Phaser: {
  Math: { RandomDataGenerator: class {
    between(a, b) { return Math.floor((a + b) / 2); }
    realInRange(a, b) { return (a + b) / 2; }
    frac() { return 0.5; }
    pick(valores) { return valores[0]; }
  } },
  Display: { Color: {
    IntegerToColor: color => ({ r: color >> 16, g: (color >> 8) & 255, b: color & 255 }),
    GetColor: (r, g, b) => (r << 16) | (g << 8) | b,
    Interpolate: { ColorWithColor: (a, b, pasos, i) => Object.fromEntries(['r', 'g', 'b'].map(k => [k, Math.round(a[k] + (b[k] - a[k]) * i / pasos)])) },
  } },
} });
vm.runInContext(fs.readFileSync(path.join(root, 'stadiums.js'), 'utf8') + '\nthis.canchas = STADIUMS;', contexto);
assert.deepEqual(Object.keys(contexto.canchas), ['barrio', 'playa', 'espacio', 'autopista', 'quebrada', 'aurora']);
for (const [key, cancha] of Object.entries(contexto.canchas)) {
  assert.equal(cancha.cars.length, 2);
  for (const auto of cancha.cars) for (const sufijo of ['', '_b']) assert.ok(fs.existsSync(path.join(root, 'assets', 'cars', auto + sufijo + '.png')));
  const pendientes = [];
  const escena = {
    add: { graphics: () => dibujo(), rectangle: (x, y) => dibujo(x, y), text: (x, y) => dibujo(x, y) },
    children: { moveAbove: (obj, otro) => { assert.ok(obj && otro && obj !== otro); } },
    tweens: { add: opciones => {
      assert.ok(opciones.targets);
      assert.ok(opciones.duration > 0);
      for (const propiedad of ['x', 'y', 'alpha', 'scale']) if (propiedad in opciones) assert.ok(Number.isFinite(opciones[propiedad]));
    } },
    time: { delayedCall: (tiempo, fn) => { assert.ok(tiempo >= 0); pendientes.push(fn); } },
  };
  cancha.backdrop(escena, dibujo(), dibujo());
  cancha.floorDetail(escena, dibujo());
  for (const fn of pendientes.splice(0)) fn();
  console.log(`OK: ${cancha.name} (${key}), dibujo, animaciones y sprites.`);
}
