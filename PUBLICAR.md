# Publicar Rocket Retro en rocket2d.com

El juego ya está listo para estar en internet: `server.js` muestra la página y conecta a los jugadores online.
Faltan dos cosas que necesitan una cuenta y un pago, así que las tiene que hacer una persona: **el hosting** y **el dominio**.

## 1. Probarlo en tu compu
```bash
npm install
npm start
```
Abrí http://localhost:8080 en dos pestañas (o dos compus de la misma red usando la IP de la compu en vez de `localhost`).
En una: **🌐 ONLINE → CREAR SALA**. En la otra: **UNIRSE** con el código de 4 letras.

## 2. Subirlo a un hosting (ejemplo con Render, tiene plan gratis)
1. Subí esta carpeta a un repositorio de GitHub (la carpeta `node_modules` no hace falta, ya está en `.gitignore`).
2. En https://render.com creá un **Web Service** conectado a ese repositorio.
3. Configuración:
   - Build command: `npm install`
   - Start command: `npm start`
   - Render pone solo la variable `PORT`; el servidor ya la usa.
4. Te da una dirección tipo `https://rocket2d.onrender.com`. Probá el online ahí.

> En el plan gratis el servidor "se duerme" si nadie juega un rato: la primera vez que entrás tarda ~1 minuto en cargar.

## 3. Comprar el dominio rocket2d.com
- Al 3/10/2026 el registro de dominios .com respondía que **rocket2d.com no está registrado** (parece libre). Puede cambiar: confirmalo al comprarlo.
- Se compra en un registrador (por ejemplo Cloudflare, Namecheap o Porkbun). Cuesta alrededor de 10 USD por año.

## 4. Conectar el dominio con el hosting
1. En Render: **Settings → Custom Domains → Add** `rocket2d.com` (y `www.rocket2d.com`).
2. Render te muestra los registros DNS que hay que poner (un `CNAME` para `www` y un `A`/`ALIAS` para `rocket2d.com`).
3. Cargá esos registros en el panel del registrador donde compraste el dominio.
4. En un rato (a veces horas) https://rocket2d.com abre el juego, con el candado (HTTPS) que pone Render solo.

## Ojo
- **Las apuestas son solo de prueba (devnet).** La clave del pozo vive en el navegador de cada uno; no sirve para plata real.
- **Las cuentas son por navegador.** Todavía no hay una base de datos de usuarios: dos personas pueden usar el mismo nombre.
