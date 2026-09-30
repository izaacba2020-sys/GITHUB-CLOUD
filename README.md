# CRM B&C Abogados y Notarios · Seguros Bobadilla

CRM web con dos perfiles (**B&C** y **Seguros**): clientes, prospectos (Kanban), expedientes con checklist de requisitos,
pólizas con alertas de renovación, agenda, WhatsApp en un clic y bitácora de quién hizo qué.

Costo: **Q0**. Se usa Supabase (base de datos + usuarios, plan gratis) y Netlify o Vercel (hosting gratis).

## En línea
Publicado en Netlify desde la rama `claude/bold-hamilton-kets6r`: https://luminous-faun-f70381.netlify.app
Cada cambio subido a esa rama se publica automáticamente.

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

## Actualizaciones de la base de datos
Si tu base de datos se creó antes de una actualización, corre en **SQL Editor** el archivo correspondiente (se puede correr más de una vez sin problema):
- `supabase/actualizacion-1.sql`: cumpleaños, prima neta, pagos y plantillas de WhatsApp.
- `supabase/actualizacion-2.sql`: fotos mensuales de la cartera para la evolución año con año (Estadísticas) y modalidad de pago de las pólizas.

## Funciones
- **Importar Excel** (Clientes → ⬆ Importar Excel): relaciona tus columnas, revisa y confirma. No duplica clientes (mismo nombre, DPI o NIT) ni pólizas (mismo número y aseguradora).
- **Descargar todo en Excel** (menú lateral): respaldo completo de ambos perfiles, una hoja por tabla.
- **Pagos y cobros**: registra pagos parciales o completos por póliza o expediente; la sección *Cobros* muestra saldos pendientes.
- **Estadísticas**: vencimientos por mes, primas por aseguradora y ramo, primas por cobrar en los próximos 12 meses, pagos recibidos y evolución de la cartera con comparativo año con año.
- **WhatsApp**: plantillas editables con variables como `{nombre}`, `{vence}` o `{monto}`, y cumpleaños próximos en *Inicio*.

## Personalizar
- Trámites, checklists, aseguradoras, ramos y etapas: `js/catalogos.js`
- Logos de aseguradoras: `assets/aseguradoras/` (ver `LEEME.txt`)
