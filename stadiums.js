// Dibujo de las canchas. Cada una tiene:
//  - name: el nombre que se ve en el menú
//  - cars: los autos de esa cancha [J1 rojo, J2 azul]; los dibujos están en assets/cars/<nombre>.png
// La pelota clásica se dibuja en game.js y es la misma para todas las canchas.
//  - carH (opcional): alto del cuerpo de los autos, para autos más bajos (deportivos)
//  - floor: los dos colores de las franjas del piso; under: color debajo del piso; wall: paredes al lado de los arcos
//  - backdrop(scene, g, crowd): dibuja el fondo entre el techo (y=56) y el piso (FIELD_TOP).
//    `g` es para el paisaje y `crowd` para el público (salta cuando hay gol).
//  - floorDetail(scene, g): detalles sobre el piso (grietas, arena, placas...). Las líneas de la cancha van encima.
// Usa W, FIELD_TOP, FLOOR, H y FONT de game.js. El paisaje usa números "al azar" con semilla fija: siempre sale igual.
const STADIUMS = {
  barrio: {
    name: 'Barrio', cars: ['barrio1', 'barrio2'],
    floor: [0x454d5b, 0x4b5462], under: 0x28313f, wall: 0x394354,
    backdrop: (s, g, c) => { drawBarrio(s, g, c); barrioExtras(s, g, c); }, floorDetail: floorBarrio,
  },
  playa: {
    name: 'Playa', cars: ['playa1', 'playa2'],
    floor: [0xd9bb87, 0xe2c591], under: 0x9b754a, wall: 0x826044,
    backdrop: (s, g, c) => { drawPlaya(s, g, c); playaExtras(s, g, c); }, floorDetail: floorPlaya,
  },
  espacio: {
    name: 'Espacio', cars: ['espacio1', 'espacio2'],
    floor: [0x384653, 0x40505e], under: 0x172735, wall: 0x344958,
    backdrop: (s, g, c) => { drawEspacio(s, g, c); espacioExtras(s, g, c); }, floorDetail: floorEspacio,
  },
  autopista: {
    name: 'Autopista', cars: ['autopista1', 'autopista2'], carH: 34,
    floor: [0x2a2a33, 0x2f2f39], under: 0x17171f, wall: 0x2b2b3a,
    backdrop: drawAutopista, floorDetail: floorAutopista,
  },
  // ponytail: las canchas nuevas reutilizan sprites; se pueden cambiar por PNG propios en estas listas.
  quebrada: {
    name: 'Quebrada', cars: ['barrio1', 'barrio2'],
    floor: [0x9e7057, 0xa8795e], under: 0x644436, wall: 0x765145,
    backdrop: drawQuebrada, floorDetail: floorQuebrada,
  },
  aurora: {
    name: 'Aurora', cars: ['espacio1', 'espacio2'],
    floor: [0x3b6579, 0x426e83], under: 0x183746, wall: 0x2a4c60,
    backdrop: drawAurora, floorDetail: floorAurora,
  },
};

const SKINS = [0xf1c27d, 0xc68642, 0x8d5524, 0xffdbac];
const FAN_SHIRTS = [0xff5555, 0x55aaff, 0xffffff, 0xff5555, 0x55aaff];
const rngFor = key => new Phaser.Math.RandomDataGenerator([key]);

// Degradado vertical en franjas (queda retro)
function vGradient(g, y0, y1, top, bottom, steps = 40) {
  const a = Phaser.Display.Color.IntegerToColor(top), b = Phaser.Display.Color.IntegerToColor(bottom);
  const h = (y1 - y0) / steps;
  for (let i = 0; i < steps; i++) {
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(a, b, steps - 1, i);
    const y = Math.round(y0 + i * h), end = Math.round(y0 + (i + 1) * h);
    g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b)).fillRect(0, y, W, end - y);
    // Tramado de píxeles en la unión de colores, como los fondos de 16 bits.
    if (i) for (let x = (i % 2) * 4; x < W; x += 8) g.fillRect(x, y - 1, 2, 1);
  }
}

// Cerros / montañas: una línea quebrada que se rellena hasta abajo
function hills(g, rng, color, baseY, amp, step = 40) {
  const pts = [];
  for (let x = 0; x <= W + step; x += step) pts.push({ x, y: baseY - rng.between(0, amp) });
  g.fillStyle(color).fillPoints([...pts, { x: W, y: FIELD_TOP }, { x: 0, y: FIELD_TOP }], true);
  g.lineStyle(1, 0xffffff, 0.12).strokePoints(pts);
}

// Una persona de 20 px de alto con los pies en `feet`
function person(g, x, feet, shirt, skin) {
  const y = feet - 20;
  g.fillStyle(skin).fillRect(x + 1, y, 6, 6);
  g.fillStyle(shirt).fillRect(x, y + 6, 8, 9);
  g.fillStyle(0x392d38).fillRect(x + 1, y, 6, 2); // pelo
  g.fillStyle(0xffffff, 0.25).fillRect(x + 1, y + 7, 2, 5);
  g.fillStyle(0x000000, 0.2).fillRect(x + 6, y + 8, 2, 6);
  g.fillStyle(skin).fillRect(x - 2, y + 8, 2, 5).fillRect(x + 8, y + 8, 2, 5);
  g.fillStyle(0x2a2a3a).fillRect(x + 1, y + 15, 2, 5).fillRect(x + 5, y + 15, 2, 5);
}

// Grupitos de 2 o 3 hinchas
function fans(g, rng, xs, feet) {
  for (const x of xs) {
    const n = rng.between(2, 3);
    for (let i = 0; i < n; i++) person(g, x + i * 11, feet, rng.pick(FAN_SHIRTS), rng.pick(SKINS));
  }
}

// Pocos píxeles de ventanas encendidas dentro de un rectángulo
function windows(g, rng, x, y, w, h, lit = 0xffd27a, dark = 0x2a2438, size = 6, gap = 12) {
  for (let wy = y + 8; wy < y + h - 8; wy += gap) {
    for (let wx = x + 6; wx < x + w - 8; wx += gap) {
      g.fillStyle(rng.frac() < 0.55 ? lit : dark).fillRect(wx, wy, size, size + 2);
      g.fillStyle(0xffffff, 0.15).fillRect(wx, wy, size, 1);
      g.fillStyle(0x000000, 0.3).fillRect(wx + Math.floor(size / 2), wy + 1, 1, size + 1);
    }
  }
}

// ---------- ESPACIO ----------
function astronaut(g, x, feet, team) {
  const y = feet - 24;
  g.fillStyle(0xf2f2f2).fillCircle(x + 6, y + 6, 6).fillRect(x, y + 10, 12, 10);
  g.fillStyle(0x15152a).fillRect(x + 2, y + 3, 8, 5);              // visor
  g.fillStyle(team).fillRect(x + 3, y + 13, 6, 4);                  // escudo del equipo
  g.fillStyle(0xcfd3da).fillRect(x + 1, y + 20, 4, 4).fillRect(x + 7, y + 20, 4, 4);
}

function drawEspacio(scene, g, crowd) {
  const rng = rngFor('luna');
  vGradient(g, 56, FIELD_TOP, 0x05061a, 0x161c44);
  // Vía láctea
  for (let i = 0; i < 90; i++) {
    const t = i / 90;
    g.fillStyle(rng.pick([0x3b2a8f, 0x2a4bd1, 0x5a2fa8, 0x1f3aa8]), 0.35)
      .fillRect(W * 0.02 + t * W * 0.42 + rng.between(-30, 30), 70 + t * 200 + rng.between(-25, 25), rng.between(10, 28), rng.between(6, 14));
  }
  // Estrellas
  for (let i = 0; i < 160; i++) {
    const s = rng.pick([2, 2, 3]);
    g.fillStyle(0xffffff, rng.realInRange(0.4, 1)).fillRect(rng.between(0, W), rng.between(60, 300), s, s);
  }
  // La Tierra
  const ex = W * 0.6, ey = 190, er = 106;
  g.fillStyle(0x4aa3ff, 0.25).fillCircle(ex, ey, er + 10);
  g.fillStyle(0x1f5fd1).fillCircle(ex, ey, er);
  g.fillStyle(0x3f8f3a).fillEllipse(ex - 45, ey - 35, 80, 110).fillEllipse(ex + 35, ey + 55, 60, 80).fillEllipse(ex + 55, ey - 60, 40, 30);
  g.fillStyle(0xb08a5a).fillEllipse(ex - 55, ey - 60, 36, 30);
  g.fillStyle(0xffffff, 0.75).fillEllipse(ex + 40, ey - 80, 90, 16).fillEllipse(ex - 10, ey + 15, 120, 14).fillEllipse(ex + 75, ey + 5, 50, 12);
  // Textura de las nubes y reflejos de la atmósfera.
  for (let i = 0; i < 35; i++) {
    const x = rng.between(-65, 65), y = rng.between(-65, 65);
    if (x * x + y * y < 80 * 80) g.fillStyle(0xa9dfff, 0.25).fillRect(ex + x, ey + y, rng.between(3, 7), 2);
  }
  g.lineStyle(2, 0x8ddfff, 0.6).strokeCircle(ex, ey, er + 5);
  // Órbita y estación con luces: quedan lejos del área de juego.
  g.lineStyle(1, 0x8ddfff, 0.2).strokeEllipse(ex, ey, 390, 90);
  for (let i = 0; i < 8; i++) {
    const x = rng.between(90, W - 90), y = rng.between(65, 155);
    blink(scene, scene.add.rectangle(x, y, 3, 3, 0xbceaff), 1000 + i * 160, i * 240);
  }
  // Saturno y lunitas
  const sx = W * 0.85, sy = 135;
  g.fillStyle(0xc9a46a).fillCircle(sx, sy, 30);
  g.fillStyle(0xa8865a).fillRect(sx - 28, sy - 4, 56, 6);
  g.lineStyle(5, 0xd8d0c0, 0.9).strokeEllipse(sx, sy, 140, 34);
  g.fillStyle(0x9a9aa8).fillCircle(W * 0.93, 205, 10).fillCircle(W * 0.8, 230, 7);
  // Cerros grises
  hills(g, rng, 0x4a4e5a, 270, 50);
  hills(g, rng, 0x6b6f7a, 300, 30, 30);
  // Base lunar: domos y edificios con ventanas
  for (const [x, r] of [[W * 0.78, 45], [W * 0.88, 32]]) {
    g.fillStyle(0x8a8f9c).fillCircle(x, 330, r);
    g.fillStyle(0xffc85a).fillRect(x - r * 0.5, 330 - r * 0.45, 8, 6).fillRect(x, 330 - r * 0.5, 8, 6).fillRect(x + r * 0.4, 330 - r * 0.3, 8, 6);
  }
  for (let x = W * 0.66; x < W * 0.98; x += rng.between(40, 70)) {
    const h = rng.between(30, 70), w = rng.between(30, 50);
    g.fillStyle(0x3d4150).fillRect(x, 330 - h, w, h);
    windows(g, rng, x, 330 - h, w, h, 0xffb84a, 0x2a2d38, 5, 10);
  }
  // Antenas con luz roja
  for (const x of [W * 0.06, W * 0.32, W * 0.7, W * 0.96]) {
    const top = rng.between(150, 220);
    g.fillStyle(0x777b88).fillRect(x, top, 4, 330 - top);
    g.fillStyle(0xff3030).fillRect(x - 3, top - 6, 10, 8);
  }
  // Antena parabólica y paneles solares
  g.fillStyle(0x777b88).fillRect(W * 0.15 - 3, 245, 6, 85);
  g.fillStyle(0xd8dce4).fillEllipse(W * 0.15, 230, 100, 60);
  g.fillStyle(0xaab0bc).fillEllipse(W * 0.15 + 6, 232, 70, 38);
  for (const x of [W * 0.24, W * 0.28, W * 0.45]) {
    g.fillStyle(0x2346a8).fillRect(x, 300, 42, 24);
    g.lineStyle(1, 0x7fa0ff, 0.8).strokeRect(x, 300, 42, 24).lineBetween(x + 21, 300, x + 21, 324).lineBetween(x, 312, x + 42, 312);
  }
  // Conductos y pequeñas luces de la base.
  g.lineStyle(3, 0x323d52).lineBetween(370, 335, 870, 335);
  g.lineStyle(1, 0x8a99ac).lineBetween(370, 332, 870, 332);
  for (let x = 385; x < 865; x += 30) g.fillStyle(0x719bb3).fillRect(x, 330, 3, 9);
  // Baranda y pared con luces
  g.fillStyle(0x2c3040).fillRect(50, 345, W - 100, 35);
  g.fillStyle(0x6a6f7c).fillRect(50, 326, W - 100, 4);
  for (let x = 60; x < W - 60; x += 70) g.fillStyle(0x6a6f7c).fillRect(x, 326, 5, 20);
  for (let x = 90, i = 0; x < W - 80; x += 110, i++) g.fillStyle(i % 2 ? 0x2ee6ff : 0xffa53a).fillRect(x, 358, 24, 6);
  // Astronautas mirando el partido
  for (const [x, team] of [[W * 0.22, 0xff5555], [W * 0.25, 0xff5555], [W * 0.4, 0xff5555], [W * 0.43, 0x55aaff], [W * 0.68, 0x55aaff], [W * 0.71, 0x55aaff], [W * 0.74, 0xffffff]]) {
    astronaut(crowd, x, 345, team);
  }
}

// ---------- PLAYA ----------
function cloud(g, x, y, s) {
  g.fillStyle(0xffffff, 0.95).fillEllipse(x, y, 60 * s, 22 * s).fillEllipse(x - 22 * s, y + 4, 40 * s, 16 * s).fillEllipse(x + 26 * s, y + 3, 44 * s, 16 * s).fillEllipse(x + 4 * s, y - 8 * s, 36 * s, 18 * s);
}

function palm(g, x, base, lean) {
  for (let i = 0; i < 12; i++) g.fillStyle(i % 2 ? 0x8b5a2b : 0x7a4a22).fillRect(x + lean * i * i * 0.15, base - i * 14, 12, 15); // tronco curvo
  const tx = x + lean * 144 * 0.15 + 6, ty = base - 168;
  for (const [dx, dy] of [[-60, 10], [-40, 30], [60, 10], [40, 30], [0, -25], [-30, -15], [30, -15]]) {
    g.fillStyle(0x2f8f3a).fillTriangle(tx, ty, tx + dx, ty + dy, tx + dx * 0.6, ty + dy + 14);
    g.fillStyle(0x3fae48).fillTriangle(tx, ty, tx + dx * 0.9, ty + dy - 4, tx + dx * 0.5, ty + dy + 6);
  }
  g.fillStyle(0x6b4423).fillCircle(tx - 5, ty + 8, 5).fillCircle(tx + 6, ty + 9, 5);
}

function umbrella(g, x, y, a, b) {
  g.fillStyle(0xdddddd).fillRect(x - 1, y, 3, 40);
  g.fillStyle(a).slice(x, y, 34, Math.PI, 0, false).fillPath();
  g.fillStyle(b).slice(x, y, 34, Math.PI * 1.33, Math.PI * 1.66, false).fillPath();
}

function drawPlaya(scene, g, crowd) {
  const rng = rngFor('playa');
  vGradient(g, 56, 240, 0x287fc1, 0xc4eee9);
  // Sol
  const sunX = W * 0.72;
  g.fillStyle(0xfff6c0, 0.35).fillCircle(sunX, 110, 52);
  g.fillStyle(0xfff4a0).fillCircle(sunX, 110, 38);
  // Nubes
  for (const [x, y, s] of [[W * 0.25, 120, 1.3], [W * 0.38, 160, 0.9], [W * 0.55, 95, 1.1], [W * 0.62, 175, 0.8], [W * 0.88, 135, 1.2], [W * 0.1, 175, 0.8]]) cloud(g, x, y, s);
  // Islas y montañas en el horizonte
  g.fillStyle(0x6f8fa8).fillTriangle(W * 0.62, 240, W * 0.74, 175, W * 0.86, 240).fillTriangle(W * 0.78, 240, W * 0.9, 160, W * 1.02, 240);
  g.fillStyle(0x4f7a5a).fillTriangle(W * 0.84, 240, W * 0.93, 190, W * 1.0, 240).fillTriangle(W * 0.3, 240, W * 0.34, 222, W * 0.38, 240);
  // Mar con olas
  vGradient(g, 240, 305, 0x177dba, 0x42c7c0, 12);
  // Muelle de madera con pilotes y farol, detrás de los veleros.
  g.fillStyle(0x775344).fillRect(55, 277, 180, 7);
  for (let x = 65; x < 235; x += 35) g.fillStyle(0x5c4039).fillRect(x, 284, 5, 19);
  g.fillStyle(0x354e60).fillRect(215, 252, 3, 25);
  g.fillStyle(0xffe0a0).fillRect(211, 248, 11, 7);
  for (let y = 246; y < 300; y += 8) {
    for (let i = 0; i < 26; i++) g.fillStyle(0xbfe8ff, 0.5).fillRect(rng.between(0, W), y, rng.between(10, 30), 2);
  }
  for (let x = 0; x < W; x += 26) g.fillStyle(0xffffff, 0.9).fillEllipse(x + rng.between(0, 10), 302, 34, 8); // espuma
  // Veleros
  for (const [x, s] of [[W * 0.32, 1], [W * 0.43, 0.6], [W * 0.68, 0.75]]) {
    g.fillStyle(0xffffff).fillRect(x - 22 * s, 268, 44 * s, 6 * s);
    g.fillStyle(0x6b4423).fillRect(x - 1, 268 - 50 * s, 2, 50 * s);
    g.fillStyle(0xffffff).fillTriangle(x + 2, 268 - 48 * s, x + 2, 266, x + 26 * s, 266);
    g.fillStyle(0xf5f5f5).fillTriangle(x - 2, 268 - 40 * s, x - 2, 266, x - 20 * s, 266);
  }
  // Arena
  g.fillStyle(0xf0d9a0).fillRect(0, 305, W, 45);
  for (let i = 0; i < 160; i++) g.fillStyle(rng.pick([0xe2c78a, 0xf7e6b8]), 1).fillRect(rng.between(0, W), rng.between(306, 345), 2, 2);
  // Piedritas, madera y sombras cortas sobre la arena.
  for (let i = 0; i < 28; i++) {
    const x = rng.between(60, W - 60), y = rng.between(310, 340);
    g.fillStyle(0xa18e6c, 0.45).fillRect(x + 1, y + 2, 5, 1);
    g.fillStyle(0xe9cc97).fillRect(x, y, 4, 2);
    g.fillStyle(0xffedc4).fillRect(x, y, 2, 1);
  }
  // Chiringuito y torre del guardavidas
  g.fillStyle(0x8b5a2b).fillRect(70, 285, 90, 45);
  g.fillStyle(0xd8b46a).fillTriangle(55, 290, 115, 245, 175, 290);
  g.fillStyle(0x5a3a1a).fillRect(95, 300, 30, 30);
  const tx = W - 150;
  g.fillStyle(0x8b5a2b).fillRect(tx, 270, 6, 60).fillRect(tx + 54, 270, 6, 60).fillRect(tx - 4, 255, 68, 20);
  g.fillStyle(0xd8b46a).fillTriangle(tx - 10, 258, tx + 30, 230, tx + 70, 258);
  g.fillStyle(0xff3b3b).fillCircle(tx + 30, 266, 8);
  g.fillStyle(0xffffff).fillCircle(tx + 30, 266, 4);
  // Tablas de surf
  for (const [x, c] of [[W - 205, 0x3d8fe0], [W - 190, 0xff5555], [W - 222, 0xffd23f]]) g.fillStyle(c).fillEllipse(x, 305, 12, 60);
  // Palmeras
  palm(g, 20, 345, 0.6);
  palm(g, 190, 345, 0.35);
  palm(g, W - 60, 345, -0.55);
  // Sombrillas
  umbrella(g, W * 0.3, 312, 0xff4040, 0xffffff);
  umbrella(g, W * 0.48, 316, 0x3d6fe0, 0xffffff);
  umbrella(g, W * 0.65, 312, 0xff4040, 0xffffff);
  umbrella(g, W * 0.8, 316, 0xffb020, 0xffffff);
  // Cerco de madera y murito de piedra
  g.fillStyle(0xc9b68f).fillRect(50, 348, W - 100, 32);
  g.lineStyle(1, 0xa8956e, 0.8);
  for (let y = 356; y < 380; y += 8) g.lineBetween(50, y, W - 50, y);
  for (let x = 50, r = 0; x < W - 50; x += 24, r++) g.lineBetween(x, 348 + (r % 3) * 8, x, 356 + (r % 3) * 8);
  g.fillStyle(0x7a4a22).fillRect(50, 330, W - 100, 5).fillRect(50, 340, W - 100, 5);
  for (let x = 60; x < W - 60; x += 64) g.fillStyle(0x6a3e1a).fillRect(x, 322, 8, 28);
  // Gente en la playa
  fans(crowd, rng, [W * 0.24, W * 0.42, W * 0.7], 348);
}

// ---------- BARRIO ----------
function waterTower(g, x, y) {
  g.fillStyle(0x2a2a2a).fillRect(x + 4, y + 30, 4, 22).fillRect(x + 32, y + 30, 4, 22);
  g.fillStyle(0x3d3d3d).fillRect(x, y + 8, 40, 26);
  g.fillStyle(0x2a2a2a).fillTriangle(x - 2, y + 10, x + 20, y - 6, x + 42, y + 10);
}

function brickBuilding(g, rng, x, top, w) {
  g.fillStyle(0x8a3b2c).fillRect(x, top, w, 330 - top);
  g.fillStyle(0x6e2f24);
  for (let y = top + 4, i = 0; y < 330; y += 8, i++) {
    g.fillRect(x, y, w, 1);
    for (let bx = x + (i % 2 ? 8 : 20); bx < x + w; bx += 24) g.fillRect(bx, y - 7, 1, 7);
  }
  g.fillStyle(0xce7c59, 0.25).fillRect(x + 2, top, 3, 330 - top);
  windows(g, rng, x, top, w, 330 - top, 0xffcf6a, 0x2a2438, 12, 34);
  g.fillStyle(0x5a2a20).fillRect(x - 4, top - 6, w + 8, 8); // cornisa
}

function drawBarrio(scene, g, crowd) {
  const rng = rngFor('calle');
  vGradient(g, 56, 330, 0x302e61, 0xf5aa77);
  // Sol del atardecer
  g.fillStyle(0xffe08a, 0.4).fillCircle(W * 0.68, 230, 58);
  g.fillStyle(0xffd56b).fillCircle(W * 0.68, 230, 42);
  // Dos planos de cerros dan profundidad a la ciudad.
  hills(g, rng, 0x78617f, 295, 95, 110);
  hills(g, rng, 0x675470, 320, 65, 85);
  // Edificios del fondo (siluetas con ventanas)
  for (let x = 0; x < W; x += rng.between(30, 60)) {
    const h = rng.between(80, 200), w = rng.between(28, 50);
    g.fillStyle(0x6a4a78).fillRect(x, 330 - h, w, h);
    for (let i = 0; i < 6; i++) g.fillStyle(0xffd27a, 0.8).fillRect(x + rng.between(4, w - 8), 330 - rng.between(10, h - 10), 4, 5);
  }
  // Edificios más cerca
  for (let x = 250; x < W - 280; x += rng.between(90, 140)) {
    const h = rng.between(60, 110), w = rng.between(70, 110);
    g.fillStyle(0x5a4a5e).fillRect(x, 330 - h, w, h);
    windows(g, rng, x, 330 - h, w, h, 0xffcf6a, 0x2f2838, 10, 22);
  }
  // Edificios de ladrillo a los costados, con escaleras de incendio y tanques de agua
  brickBuilding(g, rng, 0, 130, 230);
  brickBuilding(g, rng, W - 250, 150, 250);
  waterTower(g, 80, 72); waterTower(g, W - 140, 92);
  g.lineStyle(2, 0x1a1a1a);
  for (let y = 190; y < 320; y += 40) { g.strokeRect(160, y, 50, 4); g.lineBetween(165, y + 4, 205, y + 40); }
  // Árboles
  for (let x = 240; x < W - 260; x += rng.between(50, 90)) g.fillStyle(rng.pick([0x2f6b3a, 0x3a7d44])).fillEllipse(x, 315, rng.between(50, 80), 40);
  // Postes de luz con cables
  const poles = [W * 0.26, W * 0.42, W * 0.58, W * 0.74];
  for (const x of poles) {
    g.fillStyle(0x2a2420).fillRect(x, 190, 6, 140).fillRect(x - 16, 198, 38, 4);
  }
  g.lineStyle(1, 0x1a1a1a, 0.9);
  for (let i = 1; i < poles.length; i++) {
    const a = poles[i - 1] + 3, b = poles[i] + 3, pts = [];
    for (let t = 0; t <= 10; t++) pts.push({ x: a + (b - a) * t / 10, y: 200 + Math.sin(Math.PI * t / 10) * 14 });
    g.strokePoints(pts);
  }
  // Faroles prendidos
  for (const x of [W * 0.2, W * 0.5, W * 0.8]) {
    g.fillStyle(0x2a2a2a).fillRect(x, 250, 5, 80);
    g.fillStyle(0xffd56b, 0.35).fillCircle(x + 2, 250, 16);
    g.fillStyle(0xffe9a0).fillRect(x - 4, 244, 13, 8);
  }
  // Alambrado
  g.lineStyle(1, 0x9aa0a8, 0.35);
  for (let x = 40; x < W - 40; x += 10) { g.lineBetween(x, 300, x + 46, 346); g.lineBetween(x + 46, 300, x, 346); }
  g.fillStyle(0x3a3a3a).fillRect(50, 298, W - 100, 4);
  for (let x = 60; x < W - 60; x += 120) g.fillStyle(0x3a3a3a).fillRect(x, 298, 5, 50);
  // Pared con grafitis
  g.fillStyle(0x77777f).fillRect(50, 346, W - 100, 34);
  g.lineStyle(1, 0x5f5f66, 0.8);
  for (let y = 354; y < 380; y += 8) g.lineBetween(50, y, W - 50, y);
  const tags = [['RETRO', '#2ad4ff', 0x6a3aa8], ['GOL!', '#ff9a2a', 0x2a2a8a], ['SOL', '#3fd45a', 0x8a2a5a], ['CRACK', '#ff4fd8', 0x1a6a6a]];
  tags.forEach(([text, color, blob], i) => {
    const x = W * (0.2 + i * 0.2);
    g.fillStyle(blob, 0.7).fillEllipse(x, 363, 130, 30);
    scene.add.text(x, 363, text, { ...FONT, fontSize: '16px', color }).setOrigin(0.5).setStroke('#111111', 5).setAngle(rng.between(-4, 4));
  });
  // Tachos
  for (const [x, c] of [[64, 0x2f7d3a], [88, 0xb02a2a], [W - 100, 0xb02a2a]]) g.fillStyle(c).fillRect(x, 352, 20, 28);
  // Gente mirando detrás del alambrado y en las terrazas
  fans(crowd, rng, [W * 0.24, W * 0.42, W * 0.7], 346);
  fans(crowd, rng, [60], 130);
  fans(crowd, rng, [W - 120], 150);
}

// =====================================================================
// Detalles extra (cosas chicas y animaciones) y pisos de cada cancha
// =====================================================================

// Pájaro chiquito: una "v"
function bird(g, x, y, color = 0x1a1a1a) {
  g.fillStyle(color).fillRect(x, y, 3, 2).fillRect(x + 3, y + 2, 2, 2).fillRect(x + 5, y, 3, 2);
}

// Algo que cruza el cielo una y otra vez (pájaros, nubes, satélites, autos...)
function drift(scene, obj, fromX, toX, duration, delay = 0) {
  obj.x = fromX;
  scene.tweens.add({ targets: obj, x: toX, duration, delay, repeat: -1 });
}

// Lucecita que titila
function blink(scene, obj, duration = 600, delay = 0) {
  scene.tweens.add({ targets: obj, alpha: 0.15, duration, delay, yoyo: true, repeat: -1 });
}

// ---------- BARRIO: extras ----------
function barrioExtras(scene, g, crowd) {
  const rng = rngFor('barrio-extra');
  // Aires acondicionados en los edificios de ladrillo
  for (const [x, y] of [[20, 190], [120, 250], [W - 230, 210], [W - 120, 270]]) {
    g.fillStyle(0xb8bcc4).fillRect(x, y, 26, 16);
    g.lineStyle(1, 0x7a7e86).lineBetween(x + 3, y + 5, x + 23, y + 5).lineBetween(x + 3, y + 10, x + 23, y + 10);
  }
  // Ropa colgada
  const rope = [];
  for (let t = 0; t <= 10; t++) rope.push({ x: 230 + t * 12, y: 175 + Math.sin(Math.PI * t / 10) * 12 });
  g.lineStyle(1, 0xdddddd, 0.8).strokePoints(rope);
  for (let i = 1; i < 10; i += 2) g.fillStyle(rng.pick([0xff5555, 0x55aaff, 0xffd23f, 0xffffff])).fillRect(rope[i].x - 4, rope[i].y, 9, 12);
  // Pájaros parados en los cables
  for (const x of [W * 0.3, W * 0.32, W * 0.47, W * 0.66]) bird(g, x, 205);
  // Gato en la pared
  const cx = W * 0.55;
  g.fillStyle(0x222222).fillRect(cx, 336, 14, 9).fillRect(cx + 11, 332, 6, 6).fillRect(cx - 4, 334, 3, 8);
  g.fillStyle(0xffd23f).fillRect(cx + 14, 334, 1, 1);
  // Animación: pájaros que cruzan el cielo
  for (let i = 0; i < 3; i++) {
    const b = scene.add.graphics();
    bird(b, 0, 0, 0x2a1a3a); bird(b, 14, 5, 0x2a1a3a);
    b.y = 90 + i * 25;
    drift(scene, b, -60, W + 60, 16000 + i * 4000, i * 3000);
  }
  // Animación: una ventana que se prende y se apaga
  blink(scene, scene.add.rectangle(48, 252, 12, 14, 0xffe08a), 1400);
  // Banderines del club iluminados por los faroles.
  g.lineStyle(1, 0xbbb8ca, 0.7).lineBetween(380, 242, 850, 242);
  for (let x = 390, i = 0; x < 850; x += 34, i++) {
    g.fillStyle(i % 2 ? 0x6ec8f2 : 0xee7183).fillTriangle(x, 243, x + 18, 243, x + 9, 256);
  }
}

function floorBarrio(scene, g) {
  const rng = rngFor('barrio-piso');
  // Grietas
  g.lineStyle(1, 0x2f3136, 0.9);
  for (let i = 0; i < 16; i++) {
    let x = rng.between(220, W - 220), y = rng.between(FIELD_TOP + 8, FLOOR - 6);
    const pts = [{ x, y }];
    for (let k = 0; k < 4; k++) { x += rng.between(-14, 14); y += rng.between(-5, 5); pts.push({ x, y }); }
    g.strokePoints(pts);
  }
  // Manchas de aceite
  for (let i = 0; i < 7; i++) g.fillStyle(0x2a2c30, 0.55).fillEllipse(rng.between(200, W - 200), rng.between(FIELD_TOP + 15, FLOOR - 10), rng.between(30, 60), rng.between(6, 10));
  // Afiches del club junto al piso.
  for (const [x, color] of [[150, 0xe6c588], [590, 0x83b2d0], [1060, 0xd48f94]]) {
    g.fillStyle(0x343442, 0.5).fillRect(x + 2, FIELD_TOP + 6, 30, 10);
    g.fillStyle(color).fillRect(x, FIELD_TOP + 4, 28, 10);
    g.fillStyle(0x333647).fillRect(x + 5, FIELD_TOP + 7, 18, 2);
  }
  // Tapas de alcantarilla
  for (const x of [W * 0.3, W * 0.7]) {
    g.fillStyle(0x3a3c40).fillEllipse(x, FLOOR - 22, 46, 12);
    g.lineStyle(1, 0x26282c).strokeEllipse(x, FLOOR - 22, 46, 12).lineBetween(x - 18, FLOOR - 22, x + 18, FLOOR - 22);
  }
  // Cordón pintado abajo
  for (let x = 0; x < W; x += 40) g.fillStyle((x / 40) % 2 ? 0xe0b020 : 0x222222).fillRect(x, FLOOR + 6, 40, 6);
}

// ---------- PLAYA: extras ----------
function playaExtras(scene, g, crowd) {
  // Red de vóley sobre la arena
  const nx = W * 0.56;
  g.fillStyle(0x6b4423).fillRect(nx - 70, 300, 4, 42).fillRect(nx + 66, 300, 4, 42);
  g.lineStyle(1, 0xffffff, 0.8);
  for (let y = 302; y <= 318; y += 4) g.lineBetween(nx - 66, y, nx + 66, y);
  for (let x = nx - 66; x <= nx + 66; x += 6) g.lineBetween(x, 302, x, 318);
  // Toallas y un cangrejo
  for (const [x, c] of [[W * 0.38, 0xff5c8a], [W * 0.74, 0x3dc1ff]]) {
    g.fillStyle(c).fillRect(x, 334, 46, 10);
    g.fillStyle(0xffffff).fillRect(x, 337, 46, 2);
  }
  g.fillStyle(0xe8442a).fillEllipse(W * 0.5, 340, 14, 8).fillRect(W * 0.5 - 10, 336, 3, 3).fillRect(W * 0.5 + 7, 336, 3, 3);
  // Barrilete con cola
  const kx = W * 0.2, ky = 100;
  g.fillStyle(0xff4040).fillTriangle(kx, ky - 16, kx - 12, ky, kx, ky + 18);
  g.fillStyle(0xffd23f).fillTriangle(kx, ky - 16, kx + 12, ky, kx, ky + 18);
  g.lineStyle(1, 0xffffff, 0.7).lineBetween(kx, ky + 18, kx + 60, 300);
  for (let i = 1; i <= 4; i++) g.fillStyle(i % 2 ? 0x3d8fe0 : 0xff4040).fillRect(kx - 3 + i * 2, ky + 18 + i * 9, 5, 4);
  // Gaviotas paradas en el cerco
  for (const x of [W * 0.15, W * 0.62]) bird(g, x, 318, 0xffffff);
  // Animación: gaviotas volando y una nube que pasa despacio
  for (let i = 0; i < 2; i++) {
    const b = scene.add.graphics();
    bird(b, 0, 0, 0xffffff); bird(b, 16, 6, 0xffffff);
    b.y = 150 + i * 40;
    drift(scene, b, W + 40, -60, 14000 + i * 5000, i * 2500);
  }
  const c = scene.add.graphics();
  cloud(c, 0, 0, 1);
  c.y = 205;
  drift(scene, c, -80, W + 80, 60000);
  // Animación: brillo del sol en el agua
  for (let i = 0; i < 6; i++) blink(scene, scene.add.rectangle(W * 0.72 + (i - 3) * 22, 252 + (i % 3) * 12, 14, 2, 0xffffff), 500 + i * 120, i * 150);
  // Espuma que avanza suavemente sobre la orilla.
  const foam = scene.add.graphics();
  for (let x = -50; x < W; x += 64) foam.fillStyle(0xeafff8, 0.55).fillRect(x, 300, 30, 2).fillRect(x + 8, 304, 15, 2);
  scene.tweens.add({ targets: foam, x: 24, alpha: 0.3, duration: 2400, yoyo: true, repeat: -1 });
}

function floorPlaya(scene, g) {
  const rng = rngFor('playa-piso');
  // Granitos de arena
  for (let i = 0; i < 260; i++) g.fillStyle(rng.pick([0xc9a66a, 0xe9d09a, 0xbf9a5e]), 0.9).fillRect(rng.between(60, W - 60), rng.between(FIELD_TOP + 4, H - 2), 2, 2);
  // Caracoles y estrellas de mar
  for (let i = 0; i < 8; i++) {
    const x = rng.between(220, W - 220), y = rng.between(FIELD_TOP + 14, FLOOR - 8);
    if (i % 2) {
      g.fillStyle(0xf2b5a0).slice(x, y, 5, Math.PI, 0, false).fillPath();
    } else {
      g.fillStyle(0xff8a3d);
      for (let a = 0; a < 5; a++) {
        const t = a * Math.PI * 2 / 5 - Math.PI / 2;
        g.fillTriangle(x, y, x + Math.cos(t - 0.5) * 3, y + Math.sin(t - 0.5) * 3, x + Math.cos(t) * 8, y + Math.sin(t) * 8);
        g.fillTriangle(x, y, x + Math.cos(t + 0.5) * 3, y + Math.sin(t + 0.5) * 3, x + Math.cos(t) * 8, y + Math.sin(t) * 8);
      }
    }
  }
  // Huellas que cruzan la cancha
  for (let i = 0; i < 12; i++) g.fillStyle(0xbf9a5e, 0.7).fillEllipse(260 + i * 22, FLOOR - 30 + (i % 2) * 8 - i * 3, 5, 3);
  // Orilla mojada abajo
  g.fillStyle(0x8fd3e8, 0.35).fillRect(0, FLOOR + 14, W, 6);
}

// ---------- ESPACIO: extras ----------
function espacioExtras(scene, g, crowd) {
  const rng = rngFor('espacio-extra');
  // Cráteres en los cerros
  for (let i = 0; i < 10; i++) g.fillStyle(0x5a5e6a).fillEllipse(rng.between(0, W), rng.between(300, 322), rng.between(16, 36), 5);
  // Bandera
  g.fillStyle(0xcccccc).fillRect(W * 0.53, 268, 2, 40);
  g.fillStyle(0xff5555).fillRect(W * 0.53 + 2, 268, 18, 6);
  g.fillStyle(0x55aaff).fillRect(W * 0.53 + 2, 274, 18, 6);
  // Robot explorador (rover)
  const rx = W * 0.36;
  g.fillStyle(0xd8dce4).fillRect(rx, 300, 34, 12);
  g.fillStyle(0x2346a8).fillRect(rx + 4, 294, 26, 5);
  g.fillStyle(0x333333).fillCircle(rx + 6, 314, 5).fillCircle(rx + 17, 314, 5).fillCircle(rx + 28, 314, 5);
  g.fillStyle(0xaab0bc).fillRect(rx + 26, 286, 2, 14);
  g.fillStyle(0xffd23f).fillRect(rx + 24, 283, 6, 4);
  // Animación: satélite que cruza el cielo
  const sat = scene.add.graphics();
  sat.fillStyle(0x2346a8).fillRect(-14, -3, 10, 6).fillRect(6, -3, 10, 6);
  sat.fillStyle(0xd8dce4).fillRect(-4, -4, 10, 8);
  sat.y = 95;
  drift(scene, sat, -40, W + 40, 30000);
  // Animación: estrella fugaz de vez en cuando
  const star = scene.add.rectangle(0, 0, 40, 2, 0xffffff).setAngle(20).setAlpha(0);
  const shoot = () => {
    star.setPosition(rng.between(100, W * 0.5), rng.between(70, 140)).setAlpha(1);
    scene.tweens.add({ targets: star, x: star.x + 220, y: star.y + 80, alpha: 0, duration: 700, onComplete: () => scene.time.delayedCall(rng.between(3000, 7000), shoot) });
  };
  scene.time.delayedCall(2000, shoot);
}

function floorEspacio(scene, g) {
  // Juntas entre placas y remaches
  g.lineStyle(2, 0x464b58, 1);
  for (let x = 110; x < W - 50; x += 60) g.lineBetween(x, FIELD_TOP, x, FLOOR);
  g.lineBetween(50, (FIELD_TOP + FLOOR) / 2, W - 50, (FIELD_TOP + FLOOR) / 2);
  for (let x = 56; x < W - 50; x += 60) {
    for (const y of [FIELD_TOP + 6, FLOOR - 8]) g.fillStyle(0x8a90a0).fillRect(x, y, 3, 3);
  }
  // Rejillas de ventilación y cantos metálicos de las placas.
  for (const x of [270, 940]) {
    g.fillStyle(0x24313f).fillRect(x, FIELD_TOP + 65, 58, 14);
    for (let dx = 5; dx < 54; dx += 6) g.fillStyle(0x5f7589).fillRect(x + dx, FIELD_TOP + 67, 2, 10);
    g.fillStyle(0x8297a7, 0.4).fillRect(x, FIELD_TOP + 64, 58, 1);
  }
  // Tira de luz celeste y franjas de peligro abajo
  g.fillStyle(0x2ee6ff, 0.5).fillRect(50, FLOOR - 4, W - 100, 2);
  for (let x = -24; x < W; x += 24) {
    g.fillStyle(0xffc21a).fillTriangle(x, H, x + 12, FLOOR + 4, x + 24, FLOOR + 4);
    g.fillStyle(0x15151a).fillTriangle(x, H, x + 12, H, x + 12, FLOOR + 4);
  }
}

// ---------- AUTOPISTA (carreras de noche) ----------
function neonSign(scene, g, x, y, w, h, text, color, css) {
  g.fillStyle(0x0d0a1a).fillRect(x, y, w, h);
  g.lineStyle(8, color, 0.18).strokeRect(x - 2, y - 2, w + 4, h + 4); // brillo
  g.lineStyle(3, color, 1).strokeRect(x, y, w, h);
  return scene.add.text(x + w / 2, y + h / 2, text, { ...FONT, fontSize: '12px', color: css }).setOrigin(0.5).setShadow(0, 0, css, 8, true, true);
}

function drawAutopista(scene, g, crowd) {
  const rng = rngFor('autopista');
  vGradient(g, 56, 330, 0x07041a, 0x3a1450);
  // Estrellas y luna
  for (let i = 0; i < 70; i++) g.fillStyle(0xffffff, rng.realInRange(0.3, 0.9)).fillRect(rng.between(0, W), rng.between(60, 180), 2, 2);
  g.fillStyle(0xfff2c8, 0.25).fillCircle(W * 0.86, 100, 34);
  g.fillStyle(0xfff2c8).fillCircle(W * 0.86, 100, 24);
  g.fillStyle(0x0b0620).fillCircle(W * 0.86 + 10, 94, 20);
  // Sol de neón a franjas y una segunda silueta de edificios.
  g.fillStyle(0xde507f, 0.5).fillCircle(W * 0.35, 192, 65);
  for (let y = 194; y < 258; y += 10) g.fillStyle(0x261034).fillRect(W * 0.35 - 66, y, 132, 4);
  for (let x = 0; x < W; x += 75) {
    const h = rng.between(40, 110);
    g.fillStyle(0x332044).fillRect(x, 290 - h, 60, h);
  }
  // Ciudad de fondo con ventanas de neón
  for (let x = 0; x < W; x += rng.between(28, 56)) {
    const h = rng.between(90, 220), w = rng.between(26, 52);
    g.fillStyle(0x1a1030).fillRect(x, 330 - h, w, h);
    for (let i = 0; i < 8; i++) g.fillStyle(rng.pick([0x2ee6ff, 0xff4fd8, 0xffd23f]), 0.8).fillRect(x + rng.between(3, w - 7), 330 - rng.between(12, h - 8), 4, 4);
    if (rng.frac() < 0.3) g.fillStyle(0xff3030).fillRect(x + w / 2 - 2, 330 - h - 4, 4, 4); // luz roja en la terraza
    g.fillStyle(0x766098, 0.25).fillRect(x + 2, 330 - h, 2, h);
    for (let y = 330 - h + 10; y < 328; y += 16) g.fillStyle(0x090817, 0.5).fillRect(x + 4, y, w - 8, 2);
  }
  // Carteles de neón (el de NITRO parpadea)
  neonSign(scene, g, W * 0.08, 120, 170, 40, 'RETRO RACING', 0xff4fd8, '#ff4fd8');
  blink(scene, neonSign(scene, g, W * 0.44, 96, 130, 36, 'NITRO', 0x2ee6ff, '#2ee6ff'), 900);
  neonSign(scene, g, W * 0.7, 132, 110, 34, '24 HS', 0xffd23f, '#ffd23f');
  // Autopista elevada con pilares y faroles
  g.fillStyle(0x2a2440).fillRect(0, 222, W, 20);
  g.fillStyle(0x3d3658).fillRect(0, 218, W, 5);
  g.fillStyle(0x1c1830).fillRect(0, 242, W, 4);
  for (let x = 60; x < W; x += 180) g.fillStyle(0x221d36).fillRect(x, 246, 22, 84);
  for (let x = 30; x < W; x += 120) {
    g.fillStyle(0x555066).fillRect(x, 196, 3, 22).fillRect(x, 196, 14, 3);
    g.fillStyle(0xffb347, 0.3).fillCircle(x + 13, 200, 10);
    g.fillStyle(0xffd38a).fillRect(x + 10, 198, 7, 4);
  }
  // Animación: autos pasando por la autopista (faros blancos adelante, luces rojas atrás)
  for (let i = 0; i < 4; i++) {
    const right = i % 2 === 0, car = scene.add.graphics();
    car.fillStyle(rng.pick([0x8a2be2, 0x2e86ff, 0xe0e0e0, 0xff7a1a])).fillRect(-16, -8, 32, 8).fillRect(-9, -13, 18, 6);
    car.fillStyle(0xffffaa).fillRect(right ? 14 : -18, -6, 4, 3);
    car.fillStyle(0xff2020).fillRect(right ? -18 : 14, -6, 4, 3);
    car.y = 218;
    drift(scene, car, right ? -60 : W + 60, right ? W + 60 : -60, 7000 + i * 1800, i * 1500);
  }
  // Taller con persiana
  const tx = W * 0.58;
  g.fillStyle(0x2c2a3a).fillRect(tx, 268, 150, 62);
  g.fillStyle(0x4a4858);
  for (let y = 284; y < 330; y += 5) g.fillRect(tx + 14, y, 122, 3);
  g.fillStyle(0x858394, 0.35).fillRect(tx + 14, 283, 122, 1);
  g.fillStyle(0x191924).fillRect(tx + 60, 318, 28, 3);
  g.fillStyle(0x525465).fillRect(tx - 16, 309, 11, 21);
  g.fillStyle(0x86e4ee).fillRect(tx - 13, 313, 5, 3);
  scene.add.text(tx + 75, 276, 'TALLER', { ...FONT, fontSize: '10px', color: '#2ee6ff' }).setOrigin(0.5).setShadow(0, 0, '#2ee6ff', 6, true, true);
  // Barrera de cemento con franjas rojas y blancas
  g.fillStyle(0x8a8a94).fillRect(50, 342, W - 100, 38);
  for (let x = 50; x < W - 50; x += 40) g.fillStyle(((x - 50) / 40) % 2 ? 0xffffff : 0xd62828).fillRect(x, 342, 40, 8);
  g.lineStyle(1, 0x6e6e78);
  for (let x = 50; x < W - 50; x += 80) g.lineBetween(x, 350, x, 380);
  // Pilas de cubiertas y conos
  for (const x of [70, W - 130]) {
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3 - r; k++) {
      const cx = x + k * 22 + r * 11, cy = 334 - r * 12;
      g.fillStyle(0x15151a).fillEllipse(cx, cy, 22, 13);
      g.fillStyle(0x2c2c34).fillEllipse(cx, cy, 10, 5);
    }
  }
  for (const x of [W * 0.25, W * 0.48, W * 0.8]) {
    g.fillStyle(0xff7a1a).fillTriangle(x, 322, x - 8, 342, x + 8, 342);
    g.fillStyle(0xffffff).fillRect(x - 4, 330, 8, 3);
  }
  // Público con los celulares prendidos
  const xs = [W * 0.18, W * 0.33, W * 0.42, W * 0.52, W * 0.88];
  fans(crowd, rng, xs, 342);
  for (const x of xs) blink(scene, scene.add.rectangle(x + 4, 316, 3, 4, 0xffffff), 300 + rng.between(0, 900), rng.between(0, 900));
  // Lluvia ligera detrás de los autos, sin tapar el piso ni los arcos.
  for (let i = 0; i < 12; i++) {
    const rain = scene.add.rectangle(rng.between(70, W - 70), 70, 1, 10, 0xa8c7e8, 0.22).setAngle(16);
    scene.tweens.add({ targets: rain, y: 325, x: rain.x - 55, duration: 1200 + i * 70, delay: i * 160, repeat: -1 });
  }
}

function floorAutopista(scene, g) {
  const rng = rngFor('autopista-piso');
  // Reflejos de neón en el asfalto mojado
  for (const [x, c] of [[W * 0.14, 0xff4fd8], [W * 0.49, 0x2ee6ff], [W * 0.74, 0xffd23f]]) {
    for (let i = 0; i < 6; i++) g.fillStyle(c, 0.12 - i * 0.015).fillRect(x - 30 + i * 3, FIELD_TOP + 6 + i * 16, 60 - i * 6, 10);
  }
  // Líneas de carril
  for (let x = 70; x < W - 70; x += 50) g.fillStyle(0xffffff, 0.25).fillRect(x, FIELD_TOP + 40, 26, 3);
  // Marcas de derrape
  for (const [x, y] of [[330, 410], [880, 448]]) {
    g.fillStyle(0x13172c, 0.6).fillEllipse(x, y, 130, 15);
    g.fillStyle(0x55c9e8, 0.2).fillRect(x - 48, y - 1, 78, 2);
    for (let dx = -40; dx < 45; dx += 13) g.fillStyle(0xd0e6ef, 0.22).fillRect(x + dx, y + (dx % 3), 7, 1);
  }
  g.lineStyle(3, 0x15151b, 0.7);
  for (let i = 0; i < 5; i++) {
    const x = rng.between(250, W - 300), y = rng.between(FIELD_TOP + 20, FLOOR - 15), pts = [];
    for (let t = 0; t <= 8; t++) pts.push({ x: x + t * 14, y: y + Math.sin(t / 2) * 6 });
    g.strokePoints(pts);
    g.strokePoints(pts.map(p => ({ x: p.x, y: p.y + 7 })));
  }
  // Largada a cuadros abajo del medio de la cancha
  for (let y = FLOOR + 4; y < H; y += 6) for (let x = W / 2 - 24; x < W / 2 + 24; x += 6) {
    g.fillStyle(((x - (W / 2 - 24)) / 6 + (y - FLOOR - 4) / 6) % 2 ? 0xffffff : 0x111111).fillRect(x, y, 6, 6);
  }
  // Cordón rojo y blanco abajo
  for (let x = 0; x < W; x += 40) if (Math.abs(x + 20 - W / 2) > 40) g.fillStyle((x / 40) % 2 ? 0xffffff : 0xd62828).fillRect(x, FLOOR + 8, 40, 6);
}

// ---------- QUEBRADA (cerros de colores y pueblo del norte) ----------
function drawQuebrada(scene, g, crowd) {
  const rng = rngFor('quebrada');
  vGradient(g, 56, FIELD_TOP, 0x526f9a, 0xf8cf9d);
  g.fillStyle(0xffedbf, 0.18).fillCircle(1010, 115, 60);
  g.fillStyle(0xffedbf).fillCircle(1010, 115, 32);
  hills(g, rng, 0xa69ca8, 265, 140, 130);
  // Un mismo perfil escalonado mantiene continuas las siete vetas.
  const ridge = [{ x: 0, y: 195 }, { x: 125, y: 145 }, { x: 230, y: 182 }, { x: 345, y: 100 },
    { x: 455, y: 161 }, { x: 570, y: 125 }, { x: 710, y: 209 }, { x: 845, y: 168 },
    { x: 955, y: 191 }, { x: 1090, y: 128 }, { x: W, y: 205 }];
  [0xb98781, 0xd7ac89, 0x9f777f, 0xd2936c, 0xc5b79b, 0x8c7c80, 0xb4785e].forEach((color, i) => {
    g.fillStyle(color).fillPoints([...ridge.map(p => ({ x: p.x, y: Math.min(323, p.y + i * 22) })), { x: W, y: 340 }, { x: 0, y: 340 }], true);
  });
  // Sedimentos siguen el perfil del cerro, sin píxeles sueltos en el cielo.
  for (let j = 1; j < ridge.length; j++) {
    const a = ridge[j - 1], b = ridge[j];
    for (let t = 0.15; t < 1; t += 0.18) {
      const x = Math.round(a.x + (b.x - a.x) * t), top = a.y + (b.y - a.y) * t;
      for (let band = 1; band < 7; band++) {
        const y = Math.round(Math.min(320, top + band * 22 + 9));
        g.fillStyle(band % 2 ? 0xffddab : 0x59464e, 0.22).fillRect(x, y, 9, 1).fillRect(x + 5, y + 3, 3, 1);
      }
    }
  }
  // Cortes de roca y una quebrada oscura entre los cerros.
  g.fillStyle(0x85666b, 0.5).fillTriangle(345, 100, 410, 320, 490, 340);
  g.lineStyle(2, 0xf0c59a, 0.5).lineBetween(345, 100, 304, 215).lineBetween(1090, 128, 1030, 260);
  // Viaducto y tren turístico animado.
  g.fillStyle(0x8a6b59).fillRect(0, 285, W, 7);
  for (let x = 25; x < W; x += 96) g.fillStyle(0x8a6b59).fillRect(x, 292, 14, 35);
  const train = scene.add.graphics();
  for (let i = 0; i < 3; i++) {
    const x = i * 42;
    train.fillStyle(i ? 0xe5b866 : 0xbf564d).fillRect(x, -19, 39, 15);
    train.fillStyle(0x466a7a).fillRect(x + 5, -16, 8, 6).fillRect(x + 18, -16, 8, 6);
    train.fillStyle(0x3e3c46).fillRect(x + 5, -4, 6, 4).fillRect(x + 28, -4, 6, 4);
  }
  train.y = 285;
  drift(scene, train, -150, W + 150, 26000);
  // Casas de adobe, iglesia y balcones: cada bloque tiene su color.
  for (let x = 70; x < W - 90; x += 110) {
    const top = rng.between(300, 312), color = rng.pick([0xe7bb8d, 0xca9374, 0xf0cba1]);
    g.fillStyle(color).fillRect(x, top, 80, 40);
    g.fillStyle(0x8c514a).fillRect(x - 4, top - 5, 88, 7);
    g.fillStyle(0x605460).fillRect(x + 12, top + 12, 12, 12).fillRect(x + 49, top + 10, 13, 30);
    g.fillStyle(0xefdcbb).fillRect(x + 9, top + 24, 18, 3);
    g.fillStyle(0x6a4e44, 0.2).fillRect(x + 77, top, 3, 40);
    for (let y = top + 6; y < top + 40; y += 8) g.fillStyle(0x6a4e44, 0.18).fillRect(x + 2, y, 75, 1);
    g.fillStyle(0xf5d5a5).fillRect(x + 49, top + 10, 13, 2);
  }
  g.fillStyle(0xf1d8aa).fillRect(920, 274, 23, 66).fillRect(886, 310, 72, 30);
  g.fillStyle(0xa96555).fillTriangle(916, 274, 931, 253, 946, 274);
  g.fillStyle(0x625263).fillRect(927, 283, 9, 13).fillRect(912, 320, 14, 20);
  g.fillStyle(0x765c48).fillRect(930, 244, 3, 11).fillRect(926, 248, 11, 3);
  // Cardones en los extremos y banderines sobre la tribuna.
  for (const x of [110, 1170]) {
    g.fillStyle(0x586c4c).fillRect(x, 285, 10, 56).fillRect(x - 12, 302, 12, 7).fillRect(x - 12, 288, 6, 20).fillRect(x + 10, 310, 16, 7).fillRect(x + 20, 294, 6, 22);
    g.fillStyle(0x839366).fillRect(x + 3, 287, 2, 50);
  }
  g.lineStyle(1, 0x7d635a).lineBetween(225, 304, 820, 304);
  for (let x = 240, i = 0; x < 815; x += 30, i++) g.fillStyle([0xe66e65, 0xe7bf59, 0x76b8bd][i % 3]).fillTriangle(x, 305, x + 16, 305, x + 8, 316);
  g.fillStyle(0x886655).fillRect(50, 345, W - 100, 35);
  g.fillStyle(0xd6ad83).fillRect(50, 344, W - 100, 5);
  for (let x = 60; x < W - 60; x += 38) g.lineStyle(1, 0x694e47, 0.45).strokeRect(x, 355, 29, 14);
  fans(crowd, rng, [220, 410, 680, 1020], 344);
  const condor = scene.add.graphics();
  condor.fillStyle(0x384556).fillTriangle(-20, 0, 0, 4, 20, 0).fillRect(-2, 2, 5, 5);
  condor.y = 90;
  drift(scene, condor, -40, W + 40, 38000);
}

function floorQuebrada(scene, g) {
  const rng = rngFor('quebrada-piso');
  for (let i = 0; i < 100; i++) {
    const x = rng.between(65, W - 65), y = rng.between(FIELD_TOP + 8, FLOOR - 6);
    g.fillStyle(rng.pick([0x775a4e, 0xc59c78]), 0.5).fillRect(x, y, rng.between(3, 7), 2);
  }
  g.lineStyle(2, 0x795642, 0.5);
  for (const y of [FLOOR - 17, FLOOR - 10]) g.lineBetween(230, y, W - 230, y);
  // Guarda andina bajo el piso, fuera de la trayectoria de la pelota.
  g.fillStyle(0x4b3b45).fillRect(0, FLOOR + 8, W, 22);
  for (let x = 0, i = 0; x < W; x += 32, i++) {
    g.fillStyle(i % 2 ? 0xdac08b : 0xc56d56).fillTriangle(x, FLOOR + 9, x + 16, FLOOR + 28, x + 32, FLOOR + 9);
    g.fillStyle(0x4b3b45).fillTriangle(x + 8, FLOOR + 9, x + 16, FLOOR + 19, x + 24, FLOOR + 9);
  }
}

// ---------- AURORA (arena de hielo bajo las luces polares) ----------
function drawAurora(scene, g, crowd) {
  const rng = rngFor('aurora');
  vGradient(g, 56, FIELD_TOP, 0x081b32, 0x416b82);
  for (let i = 0; i < 75; i++) g.fillStyle(0xc4e7f0, rng.realInRange(0.3, 0.8)).fillRect(rng.between(55, W - 55), rng.between(65, 230), 2, 2);
  // Cortinas de luz: tres gráficos que respiran, sin partículas en el área de juego.
  for (const [color, base, offset] of [[0x55ddb1, 93, 0], [0x72bdea, 121, 65], [0xa890df, 151, 120]]) {
    const curtain = scene.add.graphics();
    for (let x = 100; x < W - 100; x += 8) {
      const y = base + Math.sin((x + offset) / 145) * 30;
      curtain.fillStyle(color, 0.08).fillRect(x, y, 8, 80);
      curtain.fillStyle(color, 0.28).fillRect(x, y, 8, 7);
      curtain.fillStyle(color, 0.09).fillRect(x, y + 7, 8, 26);
    }
    scene.tweens.add({ targets: curtain, y: 9, alpha: 0.6, duration: 4000 + offset * 12, yoyo: true, repeat: -1 });
  }
  // Las montañas tapan las cortinas de luz; los hinchas quedan delante del paisaje.
  g = scene.add.graphics();
  scene.children.moveAbove(crowd, g);
  g.fillStyle(0xaddae6, 0.12).fillCircle(1040, 100, 44);
  g.fillStyle(0xd3edf2).fillCircle(1040, 100, 23);
  // Picos de nieve y laderas en sombra.
  for (const [x, y, w] of [[10, 152, 390], [270, 114, 430], [620, 185, 380], [900, 141, 440]]) {
    g.fillStyle(0x4c7188).fillTriangle(x, 323, x + w / 2, y, x + w, 323);
    g.fillStyle(0x2e506b).fillTriangle(x + w / 2, y, x + w * 0.64, 323, x + w, 323);
    g.fillStyle(0xb6d2dc).fillPoints([{ x: x + w / 2, y }, { x: x + w * 0.35, y: y + 60 },
      { x: x + w * 0.46, y: y + 47 }, { x: x + w * 0.52, y: y + 66 }, { x: x + w * 0.59, y: y + 45 }, { x: x + w * 0.68, y: y + 73 }], true);
    // Estrías de hielo y roca en las laderas.
    g.lineStyle(2, 0xd8e9ee, 0.25).lineBetween(x + w / 2, y + 9, x + w * 0.45, y + 45);
    for (let i = 0; i < 20; i++) {
      const py = rng.between(y + 80, 312), half = (py - y) / (323 - y) * w / 2;
      g.fillStyle(i % 2 ? 0xb7d4df : 0x173748, 0.17).fillRect(Math.round(x + w / 2 + rng.realInRange(-half * 0.7, half * 0.7)), py, rng.between(3, 8), 2);
    }
  }
  g.fillStyle(0x2b566a).fillRect(0, 319, W, 29);
  for (let i = 0; i < 30; i++) g.fillStyle(0x85c7c5, 0.25).fillRect(rng.between(80, W - 80), rng.between(324, 344), rng.between(15, 55), 2);
  // Abetos: ramas triangulares y nieve sobre la copa.
  for (const x of [70, 135, 220, 340, 860, 1000, 1100, 1170]) {
    const h = rng.between(52, 94), top = 345 - h;
    g.fillStyle(0x24424f).fillRect(x - 3, top + 15, 6, h - 15);
    for (let i = 0; i < 3; i++) {
      const y = top + i * 17, half = 16 + i * 8;
      g.fillStyle(i % 2 ? 0x284f5b : 0x316170).fillTriangle(x, y, x - half, y + 33, x + half, y + 33);
      g.fillStyle(0xaacbd5).fillTriangle(x, y, x - half * 0.4, y + 13, x + half * 0.4, y + 13);
    }
  }
  // Refugio de madera, luces cálidas y humo lento.
  g.fillStyle(0x79554d).fillRect(535, 303, 125, 43);
  g.fillStyle(0x1c3648).fillTriangle(518, 305, 598, 269, 675, 305);
  g.lineStyle(5, 0xc7dce1).lineBetween(518, 305, 598, 269).lineBetween(598, 269, 675, 305);
  g.fillStyle(0x536071).fillRect(628, 269, 12, 25);
  g.fillStyle(0xffd593).fillRect(550, 315, 20, 16).fillRect(621, 315, 20, 16);
  g.fillStyle(0x473e43).fillRect(586, 316, 22, 30);
  for (let y = 308; y < 345; y += 6) g.fillStyle(0x392f39, 0.4).fillRect(537, y, 121, 1);
  g.fillStyle(0xcaa083, 0.3).fillRect(537, 305, 3, 40);
  g.fillStyle(0x332e3d).fillRect(559, 315, 2, 16).fillRect(630, 315, 2, 16);
  g.fillStyle(0xffedc8).fillRect(600, 331, 2, 2);
  for (let i = 0; i < 3; i++) {
    const smoke = scene.add.rectangle(634, 264, 8, 6, 0xc2d8dd, 0.18);
    scene.tweens.add({ targets: smoke, x: 652, y: 226, alpha: 0, scale: 2, duration: 3500, delay: i * 1100, repeat: -1 });
  }
  g.fillStyle(0x244352).fillRect(50, 351, W - 100, 29);
  g.fillStyle(0xbad8e0).fillRect(50, 347, W - 100, 5);
  for (let x = 70; x < W - 70; x += 65) {
    g.fillStyle(0xa5d4de).fillTriangle(x, 352, x + 7, 365, x + 14, 352);
    g.fillStyle(0x567885).fillRect(x + 26, 358, 16, 3);
  }
  fans(crowd, rng, [280, 430, 770, 950], 347);
  for (const x of [385, 815]) {
    g.fillStyle(0x2a4150).fillRect(x, 316, 4, 31);
    g.fillStyle(0xffd495, 0.15).fillCircle(x + 2, 314, 18);
    blink(scene, scene.add.rectangle(x + 2, 314, 9, 8, 0xffd495), 2200, x);
  }
}

function floorAurora(scene, g) {
  const rng = rngFor('aurora-piso');
  for (let i = 0; i < 26; i++) {
    const x = rng.between(75, W - 75), y = rng.between(FIELD_TOP + 10, FLOOR - 10);
    g.fillStyle(0x92d4de, 0.12).fillRect(x, y, rng.between(24, 90), 3);
  }
  g.lineStyle(1, 0xa6dce9, 0.25);
  for (const [x, y] of [[250, 407], [820, 446]]) g.strokePoints([{ x, y }, { x: x + 32, y: y + 9 }, { x: x + 46, y: y - 3 }, { x: x + 79, y: y + 4 }]);
  g.fillStyle(0xc5e1e9).fillRect(0, FLOOR + 4, W, 5);
  for (let x = 90; x < W - 90; x += 120) g.fillStyle(0xd7eff2, 0.3).fillRect(x, FIELD_TOP + 18, 3, 1).fillRect(x + 1, FIELD_TOP + 17, 1, 3);
  for (let x = 0; x < W; x += 45) g.fillStyle(0x71afc4, 0.6).fillTriangle(x, FLOOR + 9, x + 8, FLOOR + 25, x + 16, FLOOR + 9);
}
