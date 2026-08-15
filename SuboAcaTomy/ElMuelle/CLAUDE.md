# El Muelle — inmobiliaria (cliente de CoopenPlaces)

> 📌 Vive en `d:/Coopen/Coopen/3-Apps/Clientes/ElMuelle/`. Para reglas del ecosistema
> (cuentas CF/Google, contrato SSO, gotchas), leer **`d:/Coopen/CLAUDE.md` §2 y §3**.

**Qué es:** el primer cliente que compra **CoopenPlaces white-label** — su propia
inmobiliaria online en `elmuelle.coopenstudio.com`.

---

## ⚠️ Acá NO hay código

**El código vive en [`../../Places/`](../../Places/)** y es exactamente el mismo que
usa el deploy de Coopen. Esta carpeta tiene solo lo que es **de este cliente**: su
config de deploy, sus datos y esta doc.

**Por qué:** el white-label de Places es *1 deploy = 1 cliente* — cada uno con su
Worker, su D1, su R2 y su dominio, pero **compartiendo el código**. La marca no se
hornea en el build: vive en `site_settings.brand_name` de SU base (migración `0013`) y
el admin de la inmobiliaria la edita en vivo desde Configuración, sin redeploy.

Forkear el código por cliente sería el error clásico: un bug habría que arreglarlo N
veces. Si El Muelle necesita algo que Places no hace, **se agrega a Places** detrás de
un flag o de config, no en una copia.

| Dónde | Qué |
|---|---|
| [`../../Places/src/`](../../Places/src/) | El código (compartido) |
| [`../../Places/wrangler.toml`](../../Places/wrangler.toml) | El bloque **`[env.elmuelle]`**: Worker, D1, R2 y dominio de este cliente |
| `seed/` | Los datos de El Muelle (marca, propiedades, clientes, gastos) |
| `_git-bundles/` | Respaldo de la historia del repo del que vino el código (gitignoreado) |

## De dónde salió este código

Charly trajo el repo `github.com/Tms-mrl/Coopenplace` (v0.27), que era CoopenPlaces
sacado del monorepo a una cuenta de Cloudflare y un OAuth de Google propios. Traía
**4 migraciones más** que el Places del monorepo (`0011` login propio · `0012` método
de pago en gastos · `0013` white-label · `0014` el calendario gobierna el estado).

El 2026-08-02 ese código **volvió a ser el Places oficial** (`3-Apps/Places`) y se le
devolvió el SSO del ecosistema. Su `.git` se desconectó para que el código quedara
versionado de verdad en el monorepo (un repo anidado se agrega como *embedded
repository* y solo guarda un puntero roto); la historia quedó en `_git-bundles/`.

## Deploy

```bash
cd d:/Coopen/Coopen/3-Apps/Places        # el código está ACÁ, no en la carpeta del cliente
pnpm install
pnpm build
npx wrangler deploy --env elmuelle       # → coopen-places-elmuelle + elmuelle.coopenstudio.com
```

Migraciones de SU base (⚠️ gated, confirmar con Charly — regla §6 del root):

```bash
npx wrangler d1 execute elmuelle-db --remote --file=db/migrations/0001_init.sql   # … y siguientes
```

## Auth

Vive bajo `*.coopenstudio.com`, así que la cookie SSO le llega y **participa de la
cuenta única del ecosistema** (modelo C: reenvía la cookie a `auth.coopenstudio.com/api/me`).
Los tres caminos de sesión conviven:

1. **Link de acceso de inmobiliaria** (`/i/<token>`) — el que va a usar el cliente. El
   super-admin crea la agencia y le pasa el link; entra directo a su panel, sin
   contraseña, revocable.
2. **Login propio con Google** (opcional, requiere `GOOGLE_CLIENT_ID`/`_SECRET`).
3. **SSO de CoopenAuth** — activo porque `[env.elmuelle.vars]` setea `AUTH_URL`.

**Charly sigue siendo super-admin** (gestiona trial/suscripción desde el Admin de
Coopen). El cliente administra SU agencia, no la plataforma.

## Estado

**✅ EN PRODUCCIÓN** en `https://elmuelle.coopenstudio.com` (última: 2026-08-04, version
`c041158e` — calendario de reservas clickable + la reserva la hace un contacto del CRM,
migración `0015` aplicada; backup previo en `Recursos Compartidos/dumps/`).
Worker `coopen-places-elmuelle` · D1 `elmuelle-db`
(`6f508313-7657-4bfa-91fc-1d15d943b17c`) · R2 `elmuelle-media` · custom domain LIVE.

Hecho: las 14 migraciones aplicadas · los 4 seeds cargados (11 propiedades, 8 contactos,
5 operaciones, 12 gastos, 5 reservas, 22 fotos) · marca "El Muelle" en `site_settings` ·
fotos copiadas a su R2 · **link de acceso del cliente generado** (token aleatorio, no
está en el repo — pedírselo a Charly o regenerarlo desde `/app/admin`).

Smoke post-deploy OK: `/` y `/buscar` 200 con las propiedades y sus fotos ·
`/api/auth/coopen-config` → `{"authUrl":"https://auth.coopenstudio.com","enabled":true}` ·
`/api/properties` 401 sin cookie · imagen de R2 200.

> **Para liberar el slot de D1 se borró `wildprime-db`** (autorizado por Charly). Efecto
> colateral asumido: el form de waitlist de `wildprime.coopenstudio.com` rompe — ver
> `Coopen/7-Games/WildGenesis/CLAUDE.md`.

### Falta para entregárselo al cliente

1. **Reemplazar las fotos por las reales.** Son todas prestadas de Places:
   - las **4 de las propiedades** (`seed/casa*.jpg`) — casas genéricas, no de su cartera.
     Se reemplazan subiendo desde el panel (van solas a R2).
   - las **3 del landing** (`site/hero.jpg`, `site/interior.jpg`, `site/keys.jpg`) — no
     se suben desde la UI: se pisan con `wrangler r2 object put elmuelle-media/site/hero.jpg`.
     Para una inmobiliaria de la costa conviene una foto de costa, no la casa de bosque
     que está hoy.
2. **Cargar su cartera real** (o dejar la demo si es solo para mostrar). Los datos de
   `seed/` son inventados, aunque realistas: Gesell, Mar de las Pampas, Pinamar, Cariló.
3. **Datos de contacto reales** — el WhatsApp de las consultas y los teléfonos de las
   sucursales son de relleno.
4. Pasarle el **link de acceso** y, cuando cobres, marcar la suscripción como paga desde
   el Admin de Coopen (hoy está en **trial de 30 días**).

> ⚠️ **Cada cliente white-label nuevo consume un slot de D1** y la cuenta quedó otra vez
> en el tope de 10. Para el cliente #2 hay que liberar otra o subir el plan (Workers Paid
> da 50.000 D1). Es el cuello real del modelo de negocio.

## Gotchas

- 🔴 **Sin fila en `agency_members`, el panel de inmobiliaria NO aparece.**
  `getUserAgency` resuelve la agencia del usuario por **`agency_members`**, no por
  `agencies.owner_user_id`. Si falta, el dueño entra y ve la home de usuario común
  (favoritos) — parece que "se perdió el dashboard". El alta por el Admin de Coopen la
  crea sola (`createAgencyWithTrial`); un seed que arma la agencia a mano **tiene que
  insertarla explícitamente**. Pasó al provisionar este cliente.
- **Un cliente nuevo necesita las 3 imágenes del LANDING en su R2, no solo las de las
  propiedades.** `lib/landing.ts` referencia `site/hero.jpg`, `site/interior.jpg` y
  `site/keys.jpg` **hardcodeadas**; si faltan, el hero sale como un **rectángulo negro**
  (pasó acá). No están en ningún seed porque no son filas de la base, son parte del
  diseño del sitio. Copiarlas con `wrangler r2 object get/put` desde `coopen-places-media`.
- **El código NO se toca acá.** Ver arriba: se cambia en `../../Places/` y beneficia a
  todos los deploys.
- **`[env.X]` de wrangler no hereda** `vars`/`d1_databases`/`r2_buckets`/`routes` del
  top-level — hay que declararlos completos en el bloque del cliente.
- **El login solo anda en `*.coopenstudio.com`**: CoopenAuth rechaza `return_to` de otros
  hosts y la cookie está scopeada a `.coopenstudio.com`. Probar en el dominio real, no
  en la URL `workers.dev`.
- **Custom domain nuevo tarda en el cert TLS** tras el primer deploy (se resuelve solo).
