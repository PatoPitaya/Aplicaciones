# La Apuesta — primera versión

Una página para que los asistentes escriban su nombre y predigan quién ganará la final de escalada. Al terminar, la organización publica el nombre oficial y la página muestra automáticamente a quienes acertaron.

## Abrir en VS Code

1. Abre la carpeta `blok-prediction` en Visual Studio Code.
2. Abre `index.html` en un navegador. Para una vista previa cómoda puedes instalar la extensión **Live Server** y elegir “Open with Live Server”.

No necesita instalar paquetes ni ejecutar un servidor de aplicación.

## Cómo probarla

1. Añade una predicción con un nombre de participante y el nombre de un escalador.
2. Abre **Organización** en la esquina superior derecha.
3. Publica el nombre del ganador. Las predicciones coincidentes aparecen como aciertos, sin distinguir mayúsculas ni tildes.
4. **Borrar datos** reinicia la demostración en este navegador.

## Usarla con los móviles de los participantes

El proyecto ya tiene una conexión opcional preparada para Supabase. Es necesaria para que los móviles compartan predicciones.

1. Crea un proyecto en [Supabase](https://supabase.com/).
2. En el editor SQL de Supabase, abre y ejecuta `supabase-schema.sql`.
3. Crea una cuenta de correo y contraseña para organización en **Authentication > Users**. Copia su UUID y ejecuta la última instrucción comentada de `supabase-schema.sql` con ese UUID.
4. Copia la URL del proyecto y la clave pública `anon` desde **Project Settings > API** en `supabase-config.js`.
5. Publica esta carpeta en Netlify, Vercel o GitHub Pages. Cada asistente debe abrir esa misma URL.

Cuando las dos claves de `supabase-config.js` están vacías, la página funciona en modo local. Con Supabase configurado, el área **Organización** pide el correo y la contraseña autorizados antes de publicar el ganador.

Nunca añadas una clave `service_role` al archivo `supabase-config.js`.

## Personalizar

- Colores y tipografía: variables CSS al inicio de `styles.css`.
- Nombre del evento y textos: `index.html`.
- Ilustración, rutas y agarres: sección `.hero-art` en `index.html` y estilos de `.hero-art`, `.hold` y `.route` en `styles.css`.
- Cambia el arte abstracto por fotos del gimnasio cuando estén disponibles.

Los nombres, colores y detalles de BLOK son una dirección visual provisional; puedes sustituirlos por la identidad oficial del evento.
