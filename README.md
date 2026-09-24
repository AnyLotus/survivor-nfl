# 🏈 NFL Survivor Pool

App completa de Survivor de NFL con picks semanales, standings, chat y resultados automáticos.

---

## Stack

- **Frontend**: HTML/CSS/JS puro (sin framework)
- **Backend**: Netlify Functions (serverless)
- **Base de datos**: Supabase (PostgreSQL + Auth)
- **API de partidos**: ESPN API pública (gratis, sin key)

---

## Setup paso a paso

### 1. Crear cuenta en Supabase

1. Ve a [supabase.com](https://supabase.com) → crear proyecto gratis
2. En el **SQL Editor**, pega y ejecuta todo el contenido de `supabase-schema.sql`
3. Guarda estas dos claves desde **Settings → API**:
   - `URL` → tu SUPABASE_URL
   - `anon/public` → tu SUPABASE_ANON_KEY
   - `service_role` → tu SUPABASE_SERVICE_KEY (¡solo para functions!)

### 2. Configurar el frontend

Abre `public/js/config.js` y reemplaza:
```js
const SUPABASE_URL = 'https://TU_PROYECTO.supabase.co';
const SUPABASE_ANON_KEY = 'TU_ANON_KEY';
```

### 3. Crear repo y subir a GitHub

```bash
cd survivor-nfl
git init
git add .
git commit -m "first commit"
git remote add origin https://github.com/TU_USUARIO/survivor-nfl.git
git push -u origin main
```

### 4. Desplegar en Netlify

1. Ve a [netlify.com](https://netlify.com) → "Add new site" → "Import from Git"
2. Conecta tu repo de GitHub
3. Build settings:
   - **Build command**: (dejar vacío)
   - **Publish directory**: `public`
4. En **Site configuration → Environment variables**, agrega:
   ```
   SUPABASE_URL          = https://TU_PROYECTO.supabase.co
   SUPABASE_ANON_KEY     = tu_anon_key
   SUPABASE_SERVICE_KEY  = tu_service_role_key
   ```
5. Clic en **Deploy site** 🚀

### 5. Configurar semana activa (Admin)

Después del despliegue, activa la semana actual en Supabase:

```sql
-- Activar semana 1 (ajusta el número)
UPDATE weeks SET is_active = true WHERE week_number = 1;
```

Para bloquear picks (cuando comienzan los juegos):
```sql
UPDATE weeks SET is_locked = true WHERE is_active = true;
```

### 6. Sincronización automática de resultados

Configura un cron job en Netlify para llamar a la función `sync-scores` automáticamente:

En `netlify.toml`, agrega:
```toml
[functions."sync-scores"]
  schedule = "0 */2 * * *"  # cada 2 horas durante la temporada
```

O llámala manualmente en tu browser:
```
https://TU_SITIO.netlify.app/api/sync-scores
```

---

## Flujo del juego

```
1. Jugadores se registran en la app
2. Admin activa la semana → UPDATE weeks SET is_active = true
3. Jugadores eligen su equipo (sin repetir en toda la temporada)
4. Admin bloquea picks → UPDATE weeks SET is_locked = true
5. sync-scores actualiza resultados automáticamente
6. Jugadores con pick incorrecto → eliminados automáticamente
7. Repeat hasta que quede 1 ganador 🏆
```

---

## Estructura del proyecto

```
survivor-nfl/
├── netlify/
│   └── functions/
│       ├── sync-scores.js   ← Sincroniza ESPN API
│       ├── picks.js         ← CRUD de picks
│       ├── chat.js          ← Mensajes del chat
│       └── dashboard.js     ← Datos del dashboard
├── public/
│   ├── css/main.css
│   ├── js/config.js
│   ├── index.html           ← Login/Registro
│   ├── dashboard.html       ← Standings de la liga
│   ├── pick.html            ← Hacer pick semanal
│   ├── history.html         ← Historial de picks
│   └── chat.html            ← Chat de participantes
├── supabase-schema.sql      ← Schema completo de la DB
├── netlify.toml
├── package.json
└── README.md
```

---

## Hacer a alguien admin

```sql
UPDATE players SET is_admin = true WHERE display_name = 'TU_NOMBRE';
```

(Próxima versión: panel de admin con UI)

---

## Costos

Todo en plan **gratuito**:
- Netlify: 100GB/mes bandwidth, 125k invocaciones/mes
- Supabase: 500MB DB, 1GB storage, 50k requests/mes
- ESPN API: 100% gratuita y pública

Para una liga de ~20 personas, esto es más que suficiente para toda la temporada.
