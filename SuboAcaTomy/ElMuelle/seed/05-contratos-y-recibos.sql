-- El Muelle · 05 · contratos y recibos (los que le dan INGRESOS a Finanzas).
--
--   npx wrangler d1 execute elmuelle-db --remote --env elmuelle --file=../Clientes/ElMuelle/seed/05-contratos-y-recibos.sql
--
-- Por qué existe este seed: el P&L de Finanzas arma los ingresos con los recibos
-- **cobrados** (`receipts.paid_at IS NOT NULL`), no con el monto del contrato. Sin recibos,
-- la pestaña muestra solo gastos y el resultado da todo negativo.
--
-- Coherencia con el resto de los seeds (no son datos sueltos):
--   · cada contrato usa una propiedad cuyo ESTADO lo justifica (alquilada / vendida)
--   · el inquilino/comprador es un contacto real del CRM, con el perfil que declara
--     en sus `prefs` (Néstor buscaba 3 dormitorios en Pinamar; Carolina, inversión en USD)
--   · las monedas quedan separadas: los alquileres en ARS, la venta en USD
--
-- Referencia de fechas: "hoy" al cargarlo era 2026-08-02.
-- Idempotente por id fijo.

-- ── 1 · Alquiler anual: Casa 3 dorm Pinamar (prop 7, alquilada) ↔ Néstor Quiroga ──
-- Es el contrato "vivo": ya lleva 5 meses cobrados y el de agosto todavía pendiente,
-- así que Finanzas muestra a la vez ingreso acumulado y un pendiente.
INSERT OR IGNORE INTO contracts
 (id, owner_kind, agency_id, owner_user_id, property_id, client_id, operation, amount, currency,
  deposit, start_date, end_date, adjust_months, adjust_index, status, notes) VALUES
 (1,'agency',1,1,7,7,'alquiler',780000,'ARS',
  780000,'2026-03-01','2029-02-28',6,'ICL','activo','Garantía propietaria verificada. Ajusta por ICL cada 6 meses.');

INSERT OR IGNORE INTO receipts (id, contract_id, period, amount, currency, paid_at, method, notes) VALUES
 (1,1,'2026-03',780000,'ARS','2026-03-03','transferencia',NULL),
 (2,1,'2026-04',780000,'ARS','2026-04-02','transferencia',NULL),
 (3,1,'2026-05',780000,'ARS','2026-05-05','transferencia',NULL),
 (4,1,'2026-06',780000,'ARS','2026-06-03','transferencia',NULL),
 (5,1,'2026-07',780000,'ARS','2026-07-02','transferencia',NULL),
 (6,1,'2026-08',780000,'ARS',NULL,NULL,'Vence el 10 — todavía sin acreditar');

-- ── 2 · Alquiler de temporada: Monoambiente (prop 5, alquilada) ↔ Diego Lezama ──
-- Arranca en septiembre: por ahora solo entró el depósito. Sirve para ver un contrato
-- firmado que TODAVÍA no genera renta mensual.
INSERT OR IGNORE INTO contracts
 (id, owner_kind, agency_id, owner_user_id, property_id, client_id, operation, amount, currency,
  deposit, start_date, end_date, status, notes) VALUES
 (2,'agency',1,1,5,5,'alquiler',320000,'ARS',
  320000,'2026-09-01','2027-04-30','activo','Temporada completa. Depósito cobrado por adelantado.');

INSERT OR IGNORE INTO receipts (id, contract_id, period, amount, currency, paid_at, method, notes) VALUES
 (7,2,'depósito',320000,'ARS','2026-07-28','efectivo','Depósito de garantía');

-- ── 3 · Venta cerrada: PH del centro (prop 11, vendida) ↔ Carolina Ferrer ──
-- La operación que ya se cobró. Es el único ingreso en USD: el P&L tiene que mostrarlo
-- en su propia columna, nunca sumado a los pesos.
INSERT OR IGNORE INTO contracts
 (id, owner_kind, agency_id, owner_user_id, property_id, client_id, operation, amount, currency,
  deposit, start_date, status, notes) VALUES
 (3,'agency',1,1,11,6,'venta',72000,'USD',
  7200,'2026-07-21','finalizado','Escritura firmada el 21/07. Comisión cobrada aparte.');

INSERT OR IGNORE INTO receipts (id, contract_id, period, amount, currency, paid_at, method, notes) VALUES
 (8,3,'seña',7200,'USD','2026-06-30','transferencia','Seña 10%'),
 (9,3,'saldo',64800,'USD','2026-07-21','transferencia','Saldo al escriturar');
