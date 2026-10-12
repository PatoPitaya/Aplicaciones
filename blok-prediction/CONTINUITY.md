# Continuidad del proyecto — La Apuesta

## Estado actual

La aplicación funciona como una página estática y no necesita instalar dependencias.

- Los asistentes introducen su nombre y el escalador/a que creen que ganará.
- La organización abre el panel **Organización**, publica el ganador oficial y ve automáticamente los aciertos.
- Si `supabase-config.js` está vacío, los datos se guardan en `localStorage` del navegador actual. Con Supabase configurado se comparten entre todos los móviles.
- El diseño sigue la identidad de Klimzaal Blok (klimzaalblok.be): verde profundo `#244343`, blanco, amarillo cálido `#ffd362`, tipografía grotesca (Inter Tight, sustituta de Diatype) y mono (DM Mono, sustituta de Monument Grotesk Mono). Los colores están como variables al inicio de `styles.css`. `mobile.css` y `admin-auth.css` son restos del diseño anterior y ya no se cargan.

## Cómo ejecutarla

Abre `index.html` en el navegador, o abre esta carpeta en VS Code y usa la extensión Live Server.

## Archivos principales

| Archivo | Responsabilidad |
| --- | --- |
| `index.html` | Estructura, textos, formulario y panel de organización. |
| `styles.css` | Sistema visual, responsive y arte abstracto de la pared. |
| `app.js` | Predicciones, ganador oficial, resultados, modo local y conexión a Supabase. |
| `README.md` | Instrucciones para probar y personalizar. |
| `supabase-schema.sql` | Tablas y reglas de acceso para el evento compartido. |
| `supabase-config.js` | Lugar para la URL y la clave pública de Supabase. |

## Estado de la conexión compartida

La integración de Supabase ya está implementada. `supabase-schema.sql` incluye ahora la tabla `prediction_contacts` (correo/teléfono, solo legible por organización), que `app.js` ya usaba. Si ya habías ejecutado una versión anterior del esquema, ejecuta solo el bloque nuevo de `prediction_contacts`. Falta crear el proyecto de Supabase, ejecutar el esquema, crear la cuenta de organización y pegar las dos claves públicas en `supabase-config.js`. La guía completa está en `README.md`.

Para previsualizar en local: `py app.py` y abrir http://127.0.0.1:8000 (ver `RUN.md`).

## Buenas decisiones para una siguiente IA

- Mantener HTML/CSS/JavaScript sin framework hasta que sea necesario: el proyecto es fácil de modificar y desplegar.
- Conservar `normalize()` en `app.js`: compara nombres sin problemas de mayúsculas ni tildes.
- No usar `localStorage` para la versión pública: cada teléfono tendría datos distintos.
- Reemplazar el bloque `.hero-art` por fotos reales de Blok cuando estén disponibles, conservando los colores y la composición.
- Antes de publicar, cambiar el texto provisional de BLOK por la identidad y datos confirmados del evento.

## Petición breve para continuar con otra IA

> Continúa el proyecto en `D:\Aplicaciones\blok-prediction`. Lee primero `README.md` y `CONTINUITY.md`. La app es HTML, CSS y JavaScript sin dependencias de compilación. Supabase ya está preparado en `app.js`; falta configurar el proyecto real, probar el acceso de organización y conservar el diseño editorial existente.
