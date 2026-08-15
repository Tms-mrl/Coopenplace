-- El Muelle · 01 · la inmobiliaria, su marca, sucursales y el acceso del cliente.
--
--   npx wrangler d1 execute elmuelle-db --remote --file=../Clientes/ElMuelle/seed/01-agencia.sql
--
-- Idempotente: se puede re-correr (INSERT OR IGNORE + ids fijos).
-- Perfil: costa atlántica, enfocada en alquiler temporario de temporada.

-- Usuario dueño de la agencia. auth_sub 'access:elmuelle' = entra por LINK DE ACCESO
-- (no por Google): es el patrón B2B, el cliente no necesita cuenta de Google.
INSERT OR IGNORE INTO users (id, auth_sub, email, name) VALUES
  (1, 'access:elmuelle', 'contacto@elmuelle.com.ar', 'El Muelle Propiedades');

-- El `whatsapp` no es decorativo: alimenta el botón de consulta de cada aviso Y el CTA de
-- captación del landing ("¿Tenés una propiedad?"). Sin él, ese CTA **no se muestra**.
-- ⚠️ Número de DEMO — reemplazar por el real del cliente antes de entregar.
INSERT OR IGNORE INTO agencies (id, owner_user_id, name, legal_name, tax_id, whatsapp) VALUES
  (1, 1, 'El Muelle', 'El Muelle Propiedades S.R.L.', '30-71234567-8', '+54 2255 46-1200');

-- Marca del sitio (white-label, migración 0013): esto es lo que ve el visitante en el
-- header/footer/títulos. El admin de la agencia lo puede cambiar desde Configuración.
INSERT INTO site_settings (id, brand_name, updated_at) VALUES (1, 'El Muelle', datetime('now'))
  ON CONFLICT(id) DO UPDATE SET brand_name = 'El Muelle', updated_at = datetime('now');

INSERT OR IGNORE INTO branches (id, agency_id, name, address, phone) VALUES
  (1, 1, 'Casa central — Villa Gesell', 'Av. 3 esq. Paseo 104, Villa Gesell', '+54 2255 46-1200'),
  (2, 1, 'Sucursal Mar de las Pampas', 'Av. El Lucero 1450, Mar de las Pampas', '+54 2255 47-8830'),
  (3, 1, 'Sucursal Pinamar', 'Av. Bunge 1240, Pinamar', '+54 2254 49-2077');

-- 🔴 LA MEMBRESÍA ES LO QUE ENCIENDE EL PANEL DE INMOBILIARIA. `getUserAgency` resuelve
-- la agencia del usuario por `agency_members`, NO por `agencies.owner_user_id`: sin esta
-- fila el dueño entra y ve la home de usuario común (favoritos), no su panel.
-- Es lo que hace `createAgencyWithTrial()` cuando el alta va por el Admin de Coopen;
-- este seed lo replica a mano, así que hay que repetirlo.
INSERT OR IGNORE INTO agency_members (agency_id, user_id, role, branch_id) VALUES
  (1, 1, 'admin', 1);

-- Suscripción: arranca en trial de 30 días (el gate de acceso lo lee de acá).
INSERT INTO subscriptions (agency_id, status, trial_ends_at, notes, updated_at)
  VALUES (1, 'trial', datetime('now', '+30 days'), 'Cliente white-label. Alta 2026-08-02.', datetime('now'))
  ON CONFLICT(agency_id) DO UPDATE SET status='trial', trial_ends_at=datetime('now','+30 days');

-- Link de acceso del cliente: entra directo a su panel con /i/<token>, sin contraseña.
-- ⚠️ Este token es un PLACEHOLDER versionado, NO el real. En la base de producción ya se
-- reemplazó por uno aleatorio (2026-08-02) — el link real nunca vive en el repo.
-- Para rotarlo: regenerarlo desde el Admin de Coopen (/app/admin), o
--   UPDATE agency_access SET token='<48 hex aleatorios>' WHERE id=1;
INSERT OR IGNORE INTO agency_access (id, agency_id, user_id, token, label, active) VALUES
  (1, 1, 1, 'placeholder-se-regenera-al-provisionar', 'Acceso del cliente', 1);
