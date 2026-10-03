# Rocket Retro

"Rocket League" 2D retro (vista de costado, pixel art) para un hackathon de un día con un chico de 13 años. Es 1 vs 1 en el mismo teclado y tiene apuestas con SOL de prueba en Solana **devnet**.

## Cómo correrlo
No hay build: Phaser 3 y @solana/web3.js se cargan desde un CDN. El único paquete es `ws`, para el servidor online.
```bash
npm install
npm start
```
Abrir http://localhost:8080. Sin el servidor de Node (por ejemplo con `python -m http.server`) anda todo menos el online. Phantom no funciona si se abre el archivo directo (`file://`).
Para publicarlo en internet (rocket2d.com) ver `PUBLICAR.md`.

## Archivos
- `index.html`: la página, con el menú, la pantalla de controles y la de resultado (overlays en HTML).
- `game.js`: el juego.
  - Arriba: constantes para tunear (`SPEED`, `ACCEL`, `BRAKE`, `JUMP`, `CAR_GRAVITY`, `CAR_DENSITY`, `BOOST_*`, `FAST_FALL`) y `CONTROLS`.
  - Escena `Match`: física Matter, cancha (`drawStadium`), autos, pelota, goles, reloj y gol de oro.
  - Abajo: lógica del menú, las apuestas y la configuración de controles.
- `assets/cars/`: los autos en PNG, 100 px de ancho y mirando a la derecha. Cada uno tiene un segundo cuadro `<nombre>_b.png` con las ruedas giradas 45° (animación de ruedas).
- `assets/balls/`: sprites anteriores conservados como referencias. La pelota actual es siempre `ball_original`, blanca y negra, generada con Graphics en `game.js` (32×32).
- `tools/recortar_sprites.py`: el script (Pillow) que recorta autos y pelotas de las imágenes de referencia del usuario (el uso está arriba del archivo). Saca el fondo con un relleno desde los bordes, así no borra las cubiertas negras ni los vidrios oscuros (que tienen un color parecido al fondo). Las pelotas de la Autopista (a cuadros y neón) se dibujaron a mano con Pillow.
- `stadiums.js`: las canchas (`STADIUMS`: Barrio, Playa, Espacio, Autopista, Quebrada, Aurora). Cada una define sus dos autos (`cars: [J1 rojo, J2 azul]`), opcionalmente `carH` (cuerpo más bajo para autos deportivos: la Autopista usa 34), los colores del piso y paredes, una función `backdrop` que dibuja el fondo con Graphics y `floorDetail` para el piso. Todas usan la pelota original. Las animaciones del fondo (pájaros, autos en la autopista, luces que titilan) usan los helpers `drift` y `blink`. Se elige en el menú (`#stadium`, guardado en `localStorage.stadium`). Para agregar una cancha nueva: sumar una entrada a `STADIUMS` y sus PNG en `assets/`, o reutilizar los existentes como Quebrada y Aurora. El piso, las paredes y los arcos se dibujan delante de las animaciones del paisaje.
- `solana.js`: billetera "pozo", depósitos con Phantom, pago al ganador y devolución.
- `server.js`: servidor de Node. Muestra los archivos del juego (solo html/js/png/css/md, nunca `server.js`, `package*.json` ni `node_modules`) y en `/ws` arma salas online de 2 con un código de 4 letras; solo reenvía mensajes de un jugador al otro. También lleva quién está conectado (`hello` con el nombre; un nombre no puede estar conectado dos veces), responde el estado de los amigos (`status`: online / playing / offline) y pasa invitaciones (`invite` arma la sala y avisa al amigo, `decline` avisa que no aceptó, `leave` sale de la sala sin cortar la conexión).
- `net.js`: la conexión del navegador con el servidor. Se abre al cargar la página y se reconecta sola (`net.connect/send/hello/leaveRoom`, `net.ready`, `net.role`, `net.names`).
- **Amigos** (`#friends`): lista de nombres guardada en `localStorage.friends`; se pide el estado al servidor cada 3 s mientras la pantalla está abierta. Invitar abre la pantalla online del que invita y muestra un cartel (`#invite`) al amigo; si está jugando, la invitación se rechaza sola.
- **Online:** el anfitrión (crea la sala, auto rojo, elige cancha) corre la física normal y en cada cuadro manda el estado (`sendSnapshot`, evento `postupdate`). El invitado (auto azul) no calcula física (`matter.pause()`): dibuja el último estado (`updateGuest`) y manda sus teclas (`remoteInput` en el anfitrión; los saltos van con un contador `js` para no perder ninguno). Explosiones y carteles viajan como eventos (`netEvents`) que se acumulan si llegan varios estados juntos. El bloqueo del turbo agotado viaja en el bit 4 de los flags del auto. Online no se puede pausar y no hay apuestas. Si uno se desconecta, el otro vuelve a la pantalla online.

## Reglas del proyecto
- **Solo devnet.** La clave del pozo vive en el `localStorage` del navegador, así que nunca hay que apuntar a mainnet. Con plata real haría falta un programa (Anchor) que guarde el pozo.
- **Simple y editable por un chico:** JS plano, sin bundler ni frameworks, y pocos archivos. Los valores para tunear van como constantes arriba de todo.
- **Código y comentarios en español.**
- **La física y el dibujo van separados:** las paredes son cuerpos invisibles en `create()` y lo visual está en `drawStadium()`.
- **Persistencia en `localStorage`:** la clave del pozo (`potSecret`), la apuesta en curso (`bet`), los controles (`controls2`; el turbo ya no va en Shift porque en Windows dispara "Teclas especiales": J1 Espacio, J2 - / Enter / Num 0), los amigos (`friends`) y la cuenta del jugador (`account`: `{ name, createdAt }`).
- **Cuenta:** se pide el nombre de usuario al abrir el juego si no hay una guardada. Por ahora vive solo en el navegador; el modo online va a necesitar un servidor que valide que los nombres no se repitan.

## Estado
Ya está hecho:
- Modo 1v1 local con partido de 2 minutos y gol de oro.
- Turbo con fuego, doble salto y "bajar rápido". Si el turbo llega a 0 en el aire, `car.boostEmpty` bloquea la recarga hasta tocar suelo o rampa; con energía parcial sigue recargando en el aire. Un saque restablece la barra y entrenamiento mantiene turbo infinito.
- Voltereta: el doble salto con dirección da una vuelta completa (`FLIP_*`) y, si toca la pelota, le pega un pelotazo hacia ese lado.
- Explosión de color al hacer gol, con el nombre de quien anotó.
- Soporte de joystick.
- Pantalla para cambiar las teclas.
- 6 canchas (Barrio, Playa, Espacio, Autopista, Quebrada con cerros de colores y tren, Aurora con montañas nevadas y luces polares), con tramado, texturas y sombras de estilo 16 bits. Las nuevas reutilizan autos existentes y todas usan la pelota clásica. Los dos autos de una cancha tienen el mismo cuerpo físico (`CAR_W` × `car.h`), así ninguno tiene ventaja; el dibujo se apoya en el piso con `car.viewDy`.
- Arcos elevados estilo Sideswipe (`GOAL_TOP`/`GOAL_BOTTOM`), con rampas curvas en las esquinas (`RAMP_PTS`).
- "Apoyado" se detecta por colisiones (`car.grounded`), así que se puede saltar desde las rampas. Solo cuenta si la normal del choque es más vertical que horizontal: rozar una pared no es piso (si no, se salta infinito).
- Grupos de choque (`CAT`): en cada arco hay una barrera invisible (`CAR_ONLY`, 20 px adentro) que frena a los autos pero no a la pelota, para que un auto no se meta entero en el arco ni se trabe adentro. **Todo `collisionFilter` necesita `group: 0`**: sin eso Matter hace que esos cuerpos no choquen entre sí (pasó: la pelota atravesaba los autos).
- Cada auto tiene dos partes: `car.body` (cuerpo físico invisible, siempre derecho, con esquinas redondeadas) y `car.view` (el dibujo que lo sigue). La inclinación en la rampa (`rampSlope`), la voltereta y los giros de la explosión se aplican solo a `view`, con `car.angle`. Nunca hay que rotar `car.body`: se traba en las rampas.
- Apuestas en devnet.
- Pausa (P o ESC; salir de pantalla completa también pausa): `#pause` con continuar, reiniciar, controles y salir. Usa `game.scene.pause/resume('match')`.
- Entrenamiento (`mode.training`: `libre`, `tiros`, `arquero`): un solo auto que se maneja con las teclas de J1 y J2 (`mergedControls`), turbo infinito, sin reloj, R reinicia la jugada. Tiros y Arquero son de `TRAINING_ROUNDS` (10) jugadas y terminan en `#result` con "Repetir". En Arquero el auto arranca sobre la rampa de su arco y los tiros se calculan (gravedad + freno del aire) para que vayan rasantes a la parte baja del arco: probado que sin defender entran todos y saltando a tiempo se atajan.

Queda pendiente (es extra):
- Power-ups.
- Modo contra la computadora.
- Online: suavizar el movimiento del invitado (hoy dibuja el último estado sin interpolar) y cuentas de verdad con nombres únicos (necesita base de datos).
- Sonidos 8-bit.

## Verificación
- `node tools/check_game.cjs`: verifica recarga parcial, agotamiento, desbloqueo al aterrizar, entrenamiento, saque y envío del bloqueo online.
- `node tools/check_stadiums.cjs`: comprueba el dibujo, las animaciones y los sprites de las seis canchas. Complementar con revisión visual en el navegador.
- Jugar un partido completo: los goles suman, el reloj llega a 0 y el gol de oro funciona cuando empatan.
- Apuestas: probarlas con dos cuentas de Phantom en devnet y revisar las transacciones en Solana Explorer (`?cluster=devnet`).
- Ojo al probar en un navegador automatizado: si la pestaña está en segundo plano, el loop del juego se frena (requestAnimationFrame). Hay que pasarla al frente antes de probar.
