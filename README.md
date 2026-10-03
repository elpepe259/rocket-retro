# Rocket Retro

Fútbol con autos en 2D: jugá con un amigo en el mismo teclado o desde dos computadoras. También incluye entrenamiento y seis canchas.

## Instalar y arrancar

Necesitás **Node.js 18 o superior** y conexión a internet para cargar las librerías del juego.

Descargá este repositorio desde **Code → Download ZIP** y descomprimilo, o clonalo con Git:

```bash
git clone https://github.com/elpepe259/rocket-retro.git
cd rocket-retro
```

Abrí una terminal en la carpeta del proyecto y ejecutá:

```bash
npm install
npm start
```

Abrí **http://localhost:8080** en el navegador. Dejá la terminal abierta mientras jugás; **Ctrl + C** detiene el servidor.

En Windows, si PowerShell bloquea `npm`, usá `npm.cmd install` y `npm.cmd start`.

## Jugar en la misma computadora

Elegí un nombre de usuario, seleccioná una cancha y tocá **JUGAR**.

| Acción | J1 (rojo) | J2 (azul) |
| --- | --- | --- |
| Mover | A / D | ← / → |
| Saltar | W | ↑ |
| Bajar rápido | S | ↓ |
| Turbo | Espacio | Enter, Num 0 o la tecla junto al Shift derecho (- /) |

- Podés cambiar las teclas desde **CONTROLES** y usar joysticks.
- **P** o **Esc** pausa el partido local.
- Si el turbo se agota en el aire, tocá el piso o una rampa para volver a recargarlo.
- En **ENTRENAMIENTO** podés practicar libremente, tiros o atajadas; **R** reinicia la jugada.

En celular o tablet aparecen automáticamente botones para mover, saltar, bajar y usar turbo. Podés mantener varios a la vez; conviene jugar con la pantalla horizontal. En online controlan tu auto y en entrenamiento el único auto. En local, **CAMBIAR AUTO** elige rojo o azul; el rival usa teclado o joystick. También hay botones para pausar en local y reiniciar la jugada de entrenamiento.

## Jugar desde dos computadoras

Los dos deben abrir el **mismo servidor**, con nombres distintos. Solo la computadora que lo aloja necesita instalar el proyecto.

1. En la misma red, tu amigo abre `http://IP-DE-TU-COMPUTADORA:8080`. Permití a Node.js el acceso a la red privada si Windows lo solicita.
2. Uno entra a **ONLINE → CREAR SALA** y comparte el código de cuatro letras.
3. El otro entra a **ONLINE → UNIRSE** e ingresa ese código. El partido arranca al unirse.

Desde internet, con ngrok instalado, ejecutá en otra terminal:

```bash
ngrok http 8080
```

Los dos abren la dirección HTTPS que muestra ngrok y siguen los pasos de la sala. Mantené abiertos el servidor y ngrok. Cada jugador puede usar WASD o las flechas, y Espacio para el turbo. Online no se puede pausar.

Si tu ngrok ya apunta al puerto **8090**, arrancá el servidor en ese puerto desde PowerShell:

```powershell
$env:PORT = '8090'
npm.cmd start
```

**El online necesita el servidor de Node (`npm start`):** no funciona abriendo `index.html` directamente ni con un servidor de Python. GitHub guarda el código; no aloja este servidor online.

Las apuestas son opcionales, requieren Phantom y usan únicamente **SOL de prueba en Solana devnet**, sin valor real. Para jugar con **JUGAR**, **ONLINE** o **ENTRENAMIENTO** no necesitás billetera.

Para alojar el juego en internet de forma permanente, consultá [PUBLICAR.md](PUBLICAR.md).
