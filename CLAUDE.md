# CoopenPlaces — Software de gestión inmobiliaria + marketplace

> 📌 **Proyecto standalone** (2026-08-02): salió del monorepo Coopen — cuenta de
> Cloudflare propia y OAuth de Google propio, sin dependencias del ecosistema
> `coopenstudio.com`. No hay `d:/Coopen/` que leer.

**Dominio:** sin dominio propio todavía — en producción sirve desde
`https://coopen-places.tomyredrebell.workers.dev` (ver `wrangler.toml`).

## Qué es

SaaS de **gestión inmobiliaria** + **marketplace público**, tres públicos con una
sola identidad:

1. **Inmobiliarias** (B2B) — propiedades, clientes y sucursales, equipo/agentes, operaciones.
2. **Propietarios** — gestión personal: alquilar o vender su casa sin inmobiliaria.
3. **Turistas/Inquilinos** — buscan y contactan en el marketplace público.

Monetización = renta del software (suscripción agencia; freemium propietario; gratis
para quien busca). **Una identidad, varios roles**: el rol vive en el perfil local
de Places (`places_profiles`), no en la cuenta de Google — el mismo user puede ser
propietario e inquilino a la vez.

## Módulos (alcance funcional)

- **A) Inmobiliarias**: organización, sucursales, equipo/agentes (roles + link de
  acceso), cartera de propiedades (fotos R2, estados), CRM + matching, mandatos,
  pipeline (kanban), contratos/recibos, publicación al marketplace, KPIs, trial 30d
  → bloqueo. (→) IA.
- **B) Propietarios**: mis propiedades (liviano de A), publicar aviso, consultas/
  WhatsApp, contratos/recibos, gastos y P&L, calendario. (→) delegar en inmobiliaria,
  temporario con pago online.
- **C) Turistas/Inquilinos**: búsqueda con filtros+mapa, ficha, favoritos/búsquedas
  guardadas con alertas, contacto/WhatsApp, perfil/historial. (→) reservas y pago
  online, solicitud de alquiler con documentación.
- **D) Admin de Coopen** (Charly, allowlist de `sub`): suscripciones (extender trial
  / marcar pago — **se cobra en persona**) y vista global de agencias/propiedades.

## Stack

- **Cloudflare Worker único** (`coopen-places`): Hono + SPA por assets binding.
- **Frontend**: React 19 + Vite 6, TS estricto, kebab-case, **mobile-first**.
- **Backend**: Hono 4 + D1 (`coopen-places-db`, binding `DB`), migraciones en
  `db/migrations/`.
- **Blobs**: R2 (`coopen-places-media`) — fotos/planos/docs; D1 solo guarda metadatos
  + key R2, nunca el binario.
- **Auth**: Google OAuth propio (authorization code flow, credenciales propias en
  Cloudflare) + sesión local en D1 (tabla `sessions`, cookie `places_session`). Sin
  proveedor de identidad externo, sin `JWT_SECRET`.
- **Dominio prod**: sin dominio propio todavía — sirve desde
  `https://coopen-places.tomyredrebell.workers.dev` (cuenta de Cloudflare propia,
  `account_id` en `wrangler.toml`). Cuando se defina un dominio: agregar
  `routes = [{ pattern = "...", custom_domain = true }]` en `wrangler.toml` +
  autorizar el nuevo `redirect_uri` en Google Cloud Console (ver Gotchas).

### Decisiones clave

- **Auth: dos caminos.** (1) Google OAuth propio (authorization code flow,
  `src/worker/routes/auth.ts`), sesión propia en D1 — para público/consumidor. (2)
  **Link de acceso de inmobiliaria** (`/i/<token>`, magic link): el super-admin crea
  la agencia y genera el link; sesión local propia (cookie `places_access`), sin
  contraseña, revocable — los clientes B2B no usan Google. `requireUser` acepta
  ambas (+ bypass `DEV_USER` en dev local).
- **Marketplace SSR e indexable (decidido)**: fichas y resultados de búsqueda se
  renderizan en el Worker como HTML puro (sin JS) para SEO. Los **dashboards de
  gestión** (agency/owner) son SPA React detrás de auth. Rutas públicas = SSR;
  rutas privadas = SPA.
- **Rol = perfil local, no identidad**: un mismo login de Google sirve para agencia/
  propietario/inquilino a la vez, sin duplicar cuentas por rol.

## Modelo de datos (resumen)

Multi-tenant, `auth_sub` (ej. `google:<id>`, o `dev:local` en dev) como TEXT. Tablas clave: `users`, `places_profiles`,
`agencies`, `branches`, `agency_members` (rol+sucursal), `properties` (owner_kind
agency|particular, `published`), `property_media`, `clients` (CRM), `mandates`,
`deals` (pipeline), `contracts`/`receipts`, `expenses`, `inquiries`, `bookings`,
`saved_searches`/`favorites`, `property_views` (analítica diaria), `subscriptions`
(`status` trial|active|blocked). Super-admin = allowlist de `sub`/email en var/secret,
no es tabla. Migraciones numeradas `0001_initial.sql` … en `db/migrations/`.

**Multi-tenant hardening**: todo `property_id`/`client_id` de un body debe validarse
contra el scope del tenant antes de persistir (`lib/ownership.ts`) y los `LEFT JOIN`
de display deben scopearse — un FK crafteado no debe filtrar datos ajenos.

## Monetización (decidido v1)

Trial manual de 30 días, sin pagos online. Al vencer, la gestión se **bloquea**
(402/redirect); Charly cobra en persona y extiende/marca pago desde el Admin de
Coopen. El **marketplace público y la búsqueda nunca se bloquean** (SEO/vidriera).
Turista/inquilino siempre gratis. Roadmap: pagos online (créditos/Stripe).

## Estructura

```
src/worker/    API Hono. lib/ (auth, http, r2) · routes/ (agencies, properties, clients,
                deals, contracts, expenses, tenant, …)
src/client/     SPA React+Vite. app.tsx (router por rol) · lib/ · components/
db/migrations/  0001_initial.sql … NNNN_*.sql
wrangler.toml   Worker + [assets] run_worker_first=["/api/*"] + D1 + R2
```

## Comandos

```bash
pnpm install
pnpm dev                 # wrangler dev (worker + SPA)
pnpm dev:client           # vite HMR (proxy /api → worker; correr ambos)
pnpm build                # vite build → dist/client
pnpm run deploy            # build + wrangler deploy (NO `pnpm deploy`, gotcha pnpm 10+)
pnpm typecheck
pnpm db:migrate:local
pnpm db:migrate:remote    # ⚠️ confirmar con Charly antes
```

Dev local sin login: `cp .dev.vars.example .dev.vars` → `DEV_USER="email|nombre"`
(bypass de Google OAuth en localhost). **NUNCA en prod.**

## Auth

Google OAuth propio (`src/worker/routes/auth.ts`), sin proveedor de identidad
externo: `GET /api/auth/config` (¿están seteados `GOOGLE_CLIENT_ID`/`_SECRET`?) ·
`GET /api/auth/google?return_to=` (redirect a Google, arranca el authorization code
flow, guarda `state`+`return_to` en cookie corta) · `GET /api/auth/callback/google`
(intercambia el code, hace upsert del user y abre sesión propia en D1 — cookie
`places_session`, 30 días) · `GET /api/auth/me` (user + roles) · `POST
/api/auth/logout` (borra la sesión en D1 y limpia cookies). Todo `/api/*` salvo
`/api/auth/*` y rutas públicas del marketplace exige `requireUser`.

## Gotchas

- **El `redirect_uri` de Google OAuth tiene que estar autorizado en Google Cloud
  Console** (`https://<dominio-actual>/api/auth/callback/google`) — si cambia el
  dominio (ej. se agrega un custom domain nuevo), hay que sumar esa URL ahí primero
  o el callback falla con `redirect_uri_mismatch`.
- **Custom domain nuevo tarda en el cert TLS** tras el primer deploy (se resuelve solo).
- **D1 local se re-keyea si cambia `database_id`**: correr `pnpm db:migrate:local`.
- **Argenprop tiene anti-bot**: las IPs de Cloudflare suelen estar flageadas → el
  import puede fallar en prod (502 `IMPORT_FAILED`). Fix: `SCRAPER_URL` (secret, proxy
  de scraping tipo ScraperAPI).
- Deps externas del front público: Google Fonts, Leaflet (unpkg), tiles OSM.

## Provisión

D1 `coopen-places-db` y R2 `coopen-places-media` provisionados en prod, en una cuenta
de Cloudflare propia (`account_id` en `wrangler.toml`, ya no la del monorepo Coopen).
Google OAuth propio configurado (`GOOGLE_CLIENT_ID`/`_SECRET` propios, no de
CoopenAuth). `SUPER_ADMIN_SUBS` ya apunta al email real del super-admin.
**Pendiente**: dominio propio (hoy solo `workers.dev`); UI del Admin de Coopen (hoy
solo API).

## Roadmap

- Email+password propio (hoy solo Google) — implica manejar el hash de contraseñas
  en la propia DB, no hay IdP externo del que depender.
- Temporario/turismo: calendario, tarifas, reservas + pago online.
- IA: sugerencia de precio + redacción de avisos (puente a *Novah* de Marketing).
- Publicación a portales externos; permisos finos por rol de agente.

## Estado (2026-08-02)

**v0.27 — en producción, ahora standalone** (salió del monorepo Coopen: cuenta de
Cloudflare y OAuth de Google propios). SSR público (landing/búsqueda/ficha,
mobile-first) + SPA de gestión (`/app`) + D1 + R2 + Google OAuth propio + sesión
local + gate de trial + Admin de Coopen (API).
Workspace de agencia (KPIs, inventario tipo planilla, CRM, sucursales, equipo, mapa),
pipeline, contratos/recibos, gastos+P&L, favoritos/alertas (dormante sin
`INTERNAL_API_SECRET`), analítica de visitas, import Argenprop, compartir en redes,
reservas, geolocalización, hardening multi-tenant. Falta: mensajería completa,
permisos finos de agente, IA, UI del Admin de Coopen.
