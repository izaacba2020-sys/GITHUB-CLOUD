# CRM B&C Abogados y Notarios · Seguros Bobadilla

CRM web con dos perfiles (**B&C** y **Seguros**): clientes, prospectos (Kanban), expedientes con checklist de requisitos,
pólizas con alertas de renovación, agenda, WhatsApp en un clic y bitácora de quién hizo qué.

Costo: **Q0**. Se usa Supabase (base de datos + usuarios, plan gratis) y Netlify o Vercel (hosting gratis).

## Probar ya (modo demo)
Abre `index.html` con un servidor local (`python3 -m http.server`) y entra con cualquier correo.
En este modo los datos se guardan solo en ese navegador.

## Poner en la nube (unos 15 minutos)
1. **Supabase**: crea una cuenta en https://supabase.com y un proyecto nuevo (región: us-east).
2. Ve a **SQL Editor → New query**, pega todo `supabase/schema.sql` y presiona **Run**.
3. Ve a **Authentication → Users → Add user** y crea los 2 usuarios (correo + contraseña, marca *Auto confirm*).
4. En **Authentication → Sign In / Providers**, desactiva *Allow new users to sign up* para que nadie más pueda registrarse.
5. En **Project Settings → API**, copia *Project URL* y la llave *anon public* y pégalas en `js/config.js`.
6. **Hosting**: en https://app.netlify.com usa *Add new site → Import from GitHub*, elige este repositorio (sin comando de build y con la raíz como carpeta de publicación). También sirve Vercel.

> El plan gratis de Supabase pausa el proyecto si pasa 1 semana sin uso; se reactiva con un clic en el panel.
> La llave *anon* puede ir en el código: los datos están protegidos por las políticas de `schema.sql` (solo usuarios con sesión).

## Personalizar
- Trámites, checklists, aseguradoras, ramos y etapas: `js/catalogos.js`
- Logos de aseguradoras: `assets/aseguradoras/` (ver `LEEME.txt`)
