# CoopenPlaces — Software de gestión inmobiliaria + marketplace

> 📌 Vive en `d:/Coopen/CoopenPlaces/` dentro del monorepo Coopen. Para reglas del
> ecosistema (cuentas CF/Google unificadas, contrato SSO, gotchas globales), leer
> **`d:/Coopen/CLAUDE.md` §2 y §3 PRIMERO**.

**Dominio:** `places.coopenstudio.com` (ecosistema `coopenstudio.com`, singular).

## Qué es

SaaS de **gestión inmobiliaria** + **marketplace público**, tres públicos con una
sola identidad Coopen:

1. **Inmobiliarias** (B2B) — propiedades, clientes y sucursales, equipo/agentes, operaciones.
2. **Propietarios** — gestión personal: alquilar o vender su casa sin inmobiliaria.
3. **Turistas/Inquilinos** — buscan y contactan en el marketplace público.

Monetización = renta del software (suscripción agencia; freemium propietario; gratis
para quien busca). **Una identidad, varios roles**: el rol vive en el perfil local
de Places (`places_profiles`), no en la identidad global de CoopenAuth — el mismo
user puede ser propietario e inquilino a la vez.

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
- **Auth**: SSO CoopenAuth **modelo C (delegación)** — reenvía `coopen_session` a
  `auth.coopenstudio.com/api/me`. Sin `JWT_SECRET`.
- **Dominio prod**: `https://places.coopenstudio.com` (custom domain). Fallback:
  `coopen-places.coopenstudio.workers.dev`.

### Decisiones clave

- **Auth: dos caminos.** (1) Google SSO para público/consumidor. (2) **Link de acceso
  de inmobiliaria** (`/i/<token>`, magic link): el super-admin crea la agencia y genera
  el link; sesión local propia (cookie `places_access`), sin contraseña, revocable —
  los clientes B2B no usan Google. `requireUser` acepta ambas.
- **Marketplace SSR e indexable (decidido)**: fichas y resultados de búsqueda se
  renderizan en el Worker como HTML puro (sin JS) para SEO. Los **dashboards de
  gestión** (agency/owner) son SPA React detrás de auth. Rutas públicas = SSR;
  rutas privadas = SPA.
- **Rol = perfil local, no identidad**: evita duplicar cuentas del ecosistema.

## Modelo de datos (resumen)

Multi-tenant, `sub` de CoopenAuth como TEXT. Tablas clave: `users`, `places_profiles`,
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
cd d:/Coopen/CoopenPlaces
pnpm install
pnpm dev                 # wrangler dev (worker + SPA)
pnpm dev:client           # vite HMR (proxy /api → worker; correr ambos)
pnpm build                # vite build → dist/client
pnpm run deploy            # build + wrangler deploy (NO `pnpm deploy`, gotcha pnpm 10+)
pnpm typecheck
pnpm db:migrate:local
pnpm db:migrate:remote    # ⚠️ confirmar con Charly antes
```

Dev local sin SSO: `cp .dev.vars.example .dev.vars` → `DEV_USER="email|nombre"`
(bypass SSO en localhost). **NUNCA en prod.**

## Auth / SSO (modelo C)

`GET /api/auth/coopen-config` · `GET /api/auth/google?return_to=` · `GET /api/auth/me`
(delega + upsert local) · `POST /api/auth/logout` (same-origin, revoca y borra cookie
acá — navegar a `auth/api/logout` cae en 403 del WAF). Todo `/api/*` salvo
`/api/auth/*` y rutas públicas del marketplace exige `requireUser`.

## Gotchas

- **Login solo anda en `*.coopenstudio.com`**: en `workers.dev` el `return_to` es
  rechazado y la cookie SSO no se comparte. Probar login en `places.coopenstudio.com`.
- **Custom domain nuevo tarda en el cert TLS** tras el primer deploy (se resuelve solo).
- **D1 local se re-keyea si cambia `database_id`**: correr `pnpm db:migrate:local`.
- **Argenprop tiene anti-bot**: las IPs de Cloudflare suelen estar flageadas → el
  import puede fallar en prod (502 `IMPORT_FAILED`). Fix: `SCRAPER_URL` (secret, proxy
  de scraping tipo ScraperAPI).
- Deps externas del front público: Google Fonts, Leaflet (unpkg), tiles OSM.

## Provisión

D1 `coopen-places-db`, R2 `coopen-places-media` y custom domain provisionados en prod.
**Pendiente**: `SUPER_ADMIN_SUBS` con el sub real de Charly (falta UI del Admin, hoy
solo API); sumar email+password cuando el IdP lo soporte.

## Roadmap

- Email+password en el IdP (CoopenAuth) — prerequisito, hoy solo Google.
- Temporario/turismo: calendario, tarifas, reservas + pago online.
- IA: sugerencia de precio + redacción de avisos (puente a *Novah* de Marketing).
- Publicación a portales externos; permisos finos por rol de agente.

## Estado (2026-07-27)

**v0.27 — en producción.** SSR público (landing/búsqueda/ficha, mobile-first) + SPA
de gestión (`/app`) + D1 + R2 + SSO modelo C + gate de trial + Admin de Coopen (API).
Workspace de agencia (KPIs, inventario tipo planilla, CRM, sucursales, equipo, mapa),
pipeline, contratos/recibos, gastos+P&L, favoritos/alertas (dormante sin
`INTERNAL_API_SECRET`), analítica de visitas, import Argenprop, compartir en redes,
reservas, geolocalización, hardening multi-tenant. Falta: mensajería completa,
permisos finos de agente, IA, UI del Admin de Coopen.
