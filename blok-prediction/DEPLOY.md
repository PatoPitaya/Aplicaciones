# Publicar La Apuesta (checklist)

La app es estática: no hay compilación. Solo hay que configurar Supabase y subir la carpeta.

## 1. Supabase (≈10 min)

1. Crea un proyecto en https://supabase.com/.
2. **SQL Editor > New query**: pega todo `supabase-schema.sql` y pulsa **Run**.
3. **Authentication > Users > Add user**: crea el correo y la contraseña de organización (marca *Auto Confirm User*). Copia su UUID.
4. En el SQL Editor ejecuta:

       insert into public.admin_users (user_id) values ('UUID-COPIADO');

5. **Database > Replication**: activa *Realtime* para las tablas `predictions` y `event_settings` (para que los resultados se actualicen en vivo).
6. **Project Settings > API**: copia *Project URL* y la clave *anon public* en `supabase-config.js`.
   Nunca uses la clave `service_role`.

## 2. Publicación activa en Render

La aplicación está desplegada y activa en Render:
- **URL de Producción:** https://blok-prediction.onrender.com
- **Código QR oficial:** Apunta a `https://blok-prediction.onrender.com`
- **Archivos para diseñadores:** `qr_code_hires.png` (PNG 2000x2000) y `qr_code_transparent.png` (PNG transparente 2000x2000).
- Al hacer `git push` a la rama `main`, Render actualiza automáticamente el sitio web estático.

## 3. Prueba antes del evento

- [ ] Abre la URL desde un móvil y registra una predicción.
- [ ] Ábrela desde otro móvil: debe aparecer ya en el panel de organización.
- [ ] Entra en **ORG.** con la cuenta de organización: ves los contactos.
- [ ] Publica un ganador de prueba, comprueba **Resultados** y pulsa **BORRAR DATOS** antes del evento real.
- [ ] Sin sesión de organización, no se ven los contactos ni se puede publicar.

## Pendiente conocido

- Lista de escaladores: se mantiene la provisional (`index.html`, `datalist` y `.climber-list`) hasta tener la oficial.
- Sustituir textos provisionales de BLOK por los datos confirmados del evento.

