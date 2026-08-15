-- El Muelle · 03 · CRM (propietarios en consignación + interesados), gastos y pipeline.
--
--   npx wrangler d1 execute elmuelle-db --remote --file=../Clientes/ElMuelle/seed/03-crm-y-finanzas.sql
--
-- Los interesados llevan `prefs` en JSON con el mismo shape que usa el matching
-- (/api/clients/:id/matches), así el cruce interesado→propiedad devuelve resultados
-- de verdad en la demo y no una lista vacía.

-- ── Propietarios que dejaron la propiedad en consignación ─────────────────────
INSERT OR IGNORE INTO clients (id, agency_id, kind, name, email, phone, notes, prefs) VALUES
  (1,1,'propietario','Marta Sosa','marta.sosa@gmail.com','+54 2255 40-1187',
   'Dueña de la casa del Paseo 102. Quiere reservarse las fiestas para la familia.',NULL),
  (2,1,'propietario','Hugo Peralta','hperalta@outlook.com','+54 11 5512-4409',
   'Vive en CABA. Dejó la cabaña de Mar de las Pampas en exclusiva por 1 año.',NULL),
  (3,1,'propietario','Estudio Lombardi','admin@estudiolombardi.com.ar','+54 2254 45-9012',
   'Administra el depto de Bunge 890 y dos unidades más. Facturan a nombre del estudio.',NULL),

-- ── Interesados (con preferencias reales para que el matching cruce) ──────────
  (4,1,'interesado','Familia Aguirre','aguirre.flia@gmail.com','+54 11 4471-2288',
   'Buscan quincena de enero para 4. Ya alquilaron en 2026, buenos inquilinos.',
   '{"operation":"temporario","capacity":4,"maxPrice":160000,"currency":"ARS","city":"Mar de las Pampas"}'),
  (5,1,'interesado','Diego Lezama','dlezama@gmail.com','+54 2255 41-7723',
   'Grupo de amigos, enero. Preguntó por casas grandes con parrilla.',
   '{"operation":"temporario","capacity":6,"maxPrice":200000,"currency":"ARS","city":"Villa Gesell"}'),
  (6,1,'interesado','Carolina Ferrer','caro.ferrer@hotmail.com','+54 223 615-9034',
   'Busca inversión para renta de temporada. Presupuesto hasta USD 150.000.',
   '{"operation":"venta","maxPrice":150000,"currency":"USD"}'),
  (7,1,'interesado','Néstor Quiroga','nquiroga@yahoo.com.ar','+54 2254 40-5561',
   'Se muda a Pinamar por trabajo. Necesita alquiler anual, 3 dormitorios, con garantía propietaria.',
   '{"operation":"alquiler","rooms":3,"maxPrice":800000,"currency":"ARS","city":"Pinamar"}'),
  (8,1,'interesado','Silvia Roldán','silvia.roldan@gmail.com','+54 11 6602-1145',
   'Quincena de enero para 8 personas, sin restricción de precio si tiene pileta.',
   '{"operation":"temporario","capacity":8,"currency":"ARS","city":"Cariló"}');

-- ── Encargos: qué propiedad dejó cada propietario en consignación ────────────
-- `mandates` es lo que conecta un contacto con SUS propiedades. Sin estas filas, la
-- ficha del propietario sale vacía (no hay propiedades, ni ingresos, ni gastos que
-- mostrar) — el vínculo NO se deduce de las notas. En la UI se carga eligiendo el
-- "Propietario" al editar cada propiedad.
INSERT OR IGNORE INTO mandates (agency_id, property_id, client_id, exclusive, commission_pct) VALUES
  (1, 1, 1, 0, 4.0),   -- Marta Sosa: casa del Paseo 102
  (1, 5, 1, 0, 4.0),   --             y el monoambiente
  (1, 2, 2, 1, 5.0),   -- Hugo Peralta: cabaña de Mar de las Pampas (en exclusiva)
  (1, 3, 3, 0, 3.5),   -- Estudio Lombardi: depto de Bunge 890
  (1, 6, 3, 0, 3.5),   --                   dos ambientes anual
  (1, 7, 3, 1, 4.5);   --                   casa de Pinamar (en exclusiva)

-- ── Pipeline de operaciones ───────────────────────────────────────────────────
INSERT OR IGNORE INTO deals (id, agency_id, property_id, client_id, stage, notes) VALUES
  (1,1,10,6,'oferta','Ofreció USD 175.000. Se le contraofertó 182.000, espera respuesta del dueño.'),
  (2,1, 7,7,'firma','Contrato listo, firma el viernes. Garantía verificada.'),
  (3,1, 4,8,'reserva','Señó la quincena del 5 al 19 de enero. Falta el saldo.'),
  (4,1, 8,6,'visita','Visita hecha el sábado. Le gustó pero quiere ver el lote de Mar Azul también.'),
  (5,1, 1,5,'visita','Coordinada para el próximo fin de semana largo.');

-- ── Gastos (alimentan el P&L de la pestaña Finanzas) ──────────────────────────
-- Mezcla de pagados y pendientes, y de ARS/USD: el P&L NUNCA mezcla monedas, así que
-- la demo muestra las dos columnas separadas como corresponde.
INSERT OR IGNORE INTO expenses
 (id, owner_kind, agency_id, property_id, category, description, amount, currency, incurred_on, paid, vendor) VALUES
  (1,'agency',1, 1,'mantenimiento','Pintura de la galería y el frente',       285000,'ARS','2026-07-08',1,'Pinturería del Muelle'),
  (2,'agency',1, 1,'servicios','Luz y gas — bimestre junio/julio',             94500,'ARS','2026-07-20',1,'EDEA / Camuzzi'),
  (3,'agency',1, 2,'reparacion','Cambio del termotanque',                     412000,'ARS','2026-06-28',1,'Gasista matriculado Ruiz'),
  (4,'agency',1, 2,'limpieza','Limpieza profunda pre-temporada',               78000,'ARS','2026-07-30',1,'Servicios Costa'),
  (5,'agency',1, 3,'expensas','Expensas julio — Bunge 890',                   156000,'ARS','2026-07-10',1,'Consorcio Bunge 890'),
  (6,'agency',1, 4,'mantenimiento','Mantenimiento de pileta (mensual)',       210000,'ARS','2026-07-05',1,'Piletas Cariló'),
  (7,'agency',1, 4,'impuestos','Tasa municipal — cuota 4',                    138000,'ARS','2026-07-15',0,'Municipio de Pinamar'),
  (8,'agency',1, 7,'reparacion','Arreglo de filtración en el techo',          320000,'ARS','2026-07-22',0,'Techista Almada'),
  (9,'agency',1,NULL,'comision','Comisión del agente — operación Pinamar',    450000,'ARS','2026-07-25',1,'Interno'),
 (10,'agency',1,NULL,'seguro','Seguro de responsabilidad civil (anual)',        1800,'USD','2026-07-01',1,'La Segunda'),
 (11,'agency',1, 8,'impuestos','Impuesto inmobiliario — anticipo',               950,'USD','2026-07-18',1,'ARBA'),
 (12,'agency',1,NULL,'otro','Publicidad en portales de temporada',            265000,'ARS','2026-07-28',1,'Argenprop / Zonaprop');
