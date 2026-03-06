# Hutech Time Tracking

Esto es una app de control horario para una sola empresa.

Sirve para 4 cosas principales:
- fichar entrada y salida
- añadir horas manualmente
- pedir días libres
- revisar horas y exportarlas desde admin

No hace falta leer el código para entenderla. Este README explica qué hace el producto, qué reglas tiene y dónde está cada parte.

## Qué ve cada usuario

### Empleado
Puede:
- entrar con Google
- ir directo a `Timesheet` después del login
- usar un solo botón para `Clock in` y `Clock out`
- ver el contador en vivo mientras está fichado
- añadir horas manuales
- ver sesiones por día
- elegir su zona horaria desde el perfil
- pedir días libres desde `Time off`

### Admin
Puede:
- ver todas las personas
- ver horas por empleado en un rango
- ver días libres solicitados por empleado
- descargar CSV mensual por persona o de toda la empresa
- usar la sección `Admin` separada del resto de navegación

## Cómo funciona cada pantalla

### 1. Dashboard
El dashboard ahora está simplificado.

Muestra solo el resumen de la semana actual:
- horas trabajadas
- horas esperadas
- diferencia
- días libres del año
- gráfico diario de horas, también en móvil
- días libres planeados para esta semana
- festivos públicos de esta semana

No tiene filtro manual.
Siempre enseña la semana actual.

### 2. Timesheet
Es la pantalla principal.

Tiene:
- botón único `Clock in / Clock out`
- contador vivo mientras la sesión está abierta
- vista por días
- sesiones del día
- añadir horas manuales
- refresco en tiempo real cuando cambian las sesiones

Comportamiento importante:
- al guardar horas manuales se abren automáticamente las sesiones del día
- si una nueva sesión pisa otra anterior, se puede sobreescribir
- al confirmar el override, se borran las sesiones solapadas antiguas y queda la nueva

### 3. Time off
Sirve para marcar días completos libres.

Tipos permitidos:
- Vacation
- Unpaid leave
- Not working

No permite:
- días pasados
- fines de semana
- festivos públicos de California

En móvil ya no usa un calendario comprimido de 7 columnas.
Ahora usa una lista vertical por día, mucho más clara.
En desktop sigue usando el calendario clásico.

Además:
- los festivos públicos se generan automáticamente en código
- no se guardan en base de datos
- se muestran en el calendario como `Public holiday`
- por ejemplo: `Cesar Chavez Day` el 31 de marzo

### 4. Admin
La navegación `Admin` está separada visualmente del resto y usa otro color.

La pantalla tiene estas secciones:
- `Monthly Employee hours report`
- `People`
- `Monthly Hours export`
- `Time off`

#### Monthly Employee hours report
- usa su propio filtro visual
- ese filtro solo afecta a este bloque
- enseña horas por empleado y por día

#### People
- lista de personas
- rol
- descarga de CSV mensual por persona

#### Monthly Hours export
- descarga CSV mensual de toda la empresa

#### Time off
- va al final del panel
- muestra días solicitados por empleado
- tiene su propio filtro separado del filtro de horas
- por defecto usa el año actual
- permite abrir modal con el detalle exacto de fechas

## Reglas importantes del producto

### Fichaje
- solo puede haber una sesión activa por usuario
- `Clock in` abre la sesión
- `Clock out` la cierra
- el tiempo se actualiza en vivo

### Añadir horas manuales
- no se puede añadir en fechas futuras
- no se puede añadir en fechas con más de 7 días de antigüedad
- si hay solape, se puede sobreescribir
- al sobreescribir, se elimina el registro anterior que se solapa

### Estado del día
- `Complete` si hay 8 horas o más
- `Partial` si hay más de 0 y menos de 8 horas

### Días libres
- solo son días completos
- no hay medias jornadas
- no hay aprobación manual en esta versión
- se consideran auto-aprobados
- no se puede pedir:
  - un día pasado
  - un fin de semana
  - un festivo público

## Zonas horarias

Cada usuario puede elegir su zona horaria desde el perfil.
Se abre haciendo click en el nombre o avatar en la barra superior.

Opciones disponibles:
- Madrid (CET/CEST)
- New York (ET)
- Los Angeles (PT)
- Manila (PHT)

Importante:
- la organización por defecto usa `America/Los_Angeles`
- las sesiones con hora sí usan timezone
- los días libres no usan hora; son fechas puras (`date-only`)
- por eso un día libre no debe moverse de 11 a 10 por timezone

## Autenticación

La app no usa NextAuth.
Usa auth propia con Google OAuth y sesiones en base de datos.

Flujo:
1. el usuario pulsa login con Google
2. Google devuelve el callback
3. la app crea o reutiliza el usuario
4. se crea una sesión propia en cookie `tt_session`

## Festivos públicos

Los festivos públicos de California:
- no están guardados en la base de datos
- se generan por código en runtime
- están definidos en:
  - [src/lib/california-holidays.ts](/Users/axi/Documents/time-tracking/src/lib/california-holidays.ts)

Ejemplos incluidos:
- New Year's Day
- Martin Luther King Jr. Day
- Presidents' Day
- Cesar Chavez Day
- Memorial Day
- Independence Day
- Labor Day
- Veterans Day
- Thanksgiving Day
- Day after Thanksgiving
- Christmas Day

## Base de datos

### Tablas que importan ahora
- `Organization`
- `User`
- `OrganizationUser`
- `TimeSession`
- `WeekLock`
- `AuditLog`
- `AppSession`
- `UserPreference`
- `TimeOffEntry`

### Qué guarda cada una
- `User`: persona real
- `OrganizationUser`: relación persona-empresa + rol + objetivo semanal
- `TimeSession`: sesiones de trabajo
- `AppSession`: login persistente propio de la app
- `UserPreference`: zona horaria del usuario
- `TimeOffEntry`: días libres guardados por usuario

## API importante

### Auth
- `GET /api/auth/google/start`
- `GET /api/auth/google/callback`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `GET /api/auth/diagnostics`

### Perfil
- `GET /api/me/profile`
- `PATCH /api/me/profile`

### Horas usuario
- `GET /api/me/range-summary?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/me/week-summary?week_start=YYYY-MM-DD`
- `GET /api/me/month-summary?month=YYYY-MM`

### Sesiones
- `GET /api/time-sessions/active`
- `POST /api/time-sessions/start`
- `POST /api/time-sessions/{id}/stop`
- `POST /api/time-sessions`
- `PATCH /api/time-sessions/{id}`

### Time off
- `GET /api/time-off?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `POST /api/time-off`
- `DELETE /api/time-off/{id}`
- `GET /api/admin/time-off?from=YYYY-MM-DD&to=YYYY-MM-DD`

### Admin
- `GET /api/admin/range-overview?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `PATCH /api/admin/users/{membershipId}/status`
- `PATCH /api/admin/users/{membershipId}/weekly-target`
- `POST /api/weeks/{weekStart}/lock`
- `POST /api/weeks/{weekStart}/unlock`

### Export
- `GET /api/exports/payroll.csv?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/exports/payroll.csv?from=YYYY-MM-DD&to=YYYY-MM-DD&membership_id=<id>`

## Tecnología

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Kysely
- PostgreSQL
- Prisma para schema/migrations
- Google OAuth custom
- SSE para refresco en tiempo real

## Tiempo real

La app usa un stream tipo SSE para refrescar cambios de sesiones sin recargar.

Endpoint:
- `GET /api/realtime/stream`

Se usa sobre todo en `Timesheet`.

## Variables de entorno

### Obligatorias
- `DATABASE_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `AUTH_SECRET`

### Recomendadas
- `APP_BASE_URL`
- `AUTH_TRUST_HOST=true`
- `EMAIL_API_KEY`
- `EMAIL_FROM_ADDRESS`
- `CRON_SECRET`

## Levantar en local

```bash
npm install
cp .env.example .env.local
npm run prisma:deploy
npm run dev
```

Abrir:
- [http://localhost:3000](http://localhost:3000)

## Comandos útiles

```bash
npm run dev
npm run build
npm run typecheck
npm run prisma:deploy
npm run prisma:seed
```

## Deploy en Railway

Build:

```bash
npm ci --include=dev && npx prisma migrate deploy && npm run build
```

Start:

```bash
npm run start
```

## Si algo falla

### Login Google falla
Revisar:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `AUTH_SECRET`
- `APP_BASE_URL`
- callback exacta:
  - `<APP_BASE_URL>/api/auth/google/callback`

### La base de datos no conecta
Revisar:
- `DATABASE_URL`
- SSL
- que Railway esté accesible desde el runtime

### El frontend va raro o sale un error de webpack
Haz esto:

```bash
rm -rf .next
npm run dev
```

## Mapa de carpetas

- [src/app](/Users/axi/Documents/time-tracking/src/app): páginas y rutas API
- [src/components](/Users/axi/Documents/time-tracking/src/components): componentes UI
- [src/lib](/Users/axi/Documents/time-tracking/src/lib): auth, db, reglas de negocio, utilidades
- [prisma/schema.prisma](/Users/axi/Documents/time-tracking/prisma/schema.prisma): schema de referencia
- [prisma/seed.mjs](/Users/axi/Documents/time-tracking/prisma/seed.mjs): seed local

## Dónde tocar cada cosa

### Si quieres cambiar login o sesiones
Mira:
- [src/lib/auth](/Users/axi/Documents/time-tracking/src/lib/auth)
- [src/app/api/auth](/Users/axi/Documents/time-tracking/src/app/api/auth)

### Si quieres cambiar Timesheet
Mira:
- [src/components/timesheet-board.tsx](/Users/axi/Documents/time-tracking/src/components/timesheet-board.tsx)
- [src/app/api/time-sessions](/Users/axi/Documents/time-tracking/src/app/api/time-sessions)

### Si quieres cambiar Time off
Mira:
- [src/components/time-off-board.tsx](/Users/axi/Documents/time-tracking/src/components/time-off-board.tsx)
- [src/lib/time-off.ts](/Users/axi/Documents/time-tracking/src/lib/time-off.ts)
- [src/lib/california-holidays.ts](/Users/axi/Documents/time-tracking/src/lib/california-holidays.ts)
- [src/app/api/time-off](/Users/axi/Documents/time-tracking/src/app/api/time-off)

### Si quieres cambiar Admin
Mira:
- [src/app/admin/page.tsx](/Users/axi/Documents/time-tracking/src/app/admin/page.tsx)
- [src/components/admin-time-off-summary.tsx](/Users/axi/Documents/time-tracking/src/components/admin-time-off-summary.tsx)

## Resumen corto

Si no quieres leer todo:
- `Timesheet` es la pantalla principal
- `Dashboard` enseña la semana actual
- `Time off` sirve para pedir días completos
- `Admin` sirve para revisar horas, personas y exportes
- los festivos públicos vienen de código, no de base de datos
- los días libres no usan timezone
- las sesiones con hora sí usan timezone
