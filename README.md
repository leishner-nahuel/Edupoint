# EduPoint

EduPoint es una demostración web de misiones escolares, puntos y recompensas. Las misiones se completan enviando una foto desde un celular.

## Cómo funciona el QR

1. En la computadora, abrí EduPoint y elegí **Completar con foto** en una misión.
2. EduPoint crea una sesión única y muestra un QR.
3. Al escanearlo, el celular abre `mobile.html` directamente en esa misión; no muestra otro QR.
4. Tocá **Abrir cámara** y sacá la foto. El archivo se envía automáticamente al terminar la captura.
5. La computadora recibe la evidencia y acredita los puntos en el panel.

En un celular que ya tenga abierto EduPoint, al tocar **Completar con foto** se crea la sesión y se abre directamente la pantalla de cámara, sin mostrar QR. Por restricciones de seguridad de los navegadores, el sitio no puede forzar la apertura de la cámara sin una acción del usuario: hay que tocar **Abrir cámara**.

## Ejecutar localmente

Requiere Node.js 18 o superior. Desde esta carpeta: `npm start`. Luego abrí `http://localhost:4173` en la computadora. Para usar el QR en la red local, conectá computadora y celular a la misma Wi-Fi y permití el acceso de Node.js en el firewall. Dejá la ventana del servidor abierta mientras se usan las misiones.

También podés ejecutar `start-windows.bat` en Windows o `./start-linux.sh` en Linux.

## Publicar en internet

El enlace `https://github.com/leishner-nahuel/Edupoint.git` es el repositorio de código, no una página web ejecutable. GitHub Pages solo publica archivos estáticos y no ejecuta `server.js`, que es necesario para crear sesiones, recibir las fotos y avisarle a la computadora.

Este proyecto incluye `render.yaml` y `package.json` para desplegar el sitio completo como servicio Node en Render:

1. Subí estos archivos del proyecto al repositorio de GitHub.
2. En Render, creá un **Blueprint** y conectá el repositorio.
3. Render leerá `render.yaml`, instalará el proyecto y ejecutará `npm start`.
4. Abrí la URL HTTPS que Render asigne. Esa será la dirección pública de EduPoint; los QR se generarán automáticamente con esa misma dirección.

Las sesiones duran 30 minutos y se guardan en memoria del servidor. Las fotos se guardan en la carpeta `evidencias/`; en el plan gratuito de Render el sistema de archivos es efímero y los archivos se pierden al reiniciar, suspender o volver a desplegar el servicio. Para uso permanente hay que configurar almacenamiento persistente y una base de datos para las sesiones.

## Importante

La foto es una evidencia enviada, no una verificación automática de que la tarea esté realmente bien hecha. En esta versión, al recibirse una foto válida, la misión se marca como completada. El puntaje y el estado de demostración se guardan en el navegador mediante `localStorage`; no hay cuentas ni sincronización de perfiles entre dispositivos. En la versión de demostración, la PC que mantiene abierta la misión acredita sus puntos cuando recibe la foto; si la misión se inicia directamente desde un celular, los puntos se registran en ese mismo navegador.
