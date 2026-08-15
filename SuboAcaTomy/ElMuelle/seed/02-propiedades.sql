-- El Muelle · 02 · cartera de propiedades (costa atlántica, foco temporario).
--
--   npx wrangler d1 execute elmuelle-db --remote --file=../Clientes/ElMuelle/seed/02-propiedades.sql
--
-- Idempotente por id fijo. Las fotos van aparte (04-fotos.sql, tras subirlas a R2).
--
-- Mezcla pensada para que la demo luzca lo que el producto sabe hacer:
--   · temporario con `capacity` + ventana de disponibilidad → filtro fecha+personas
--   · `price_period` por noche/mes/total → el precio se muestra como "$X /noche"
--   · estados variados y una vendida archivada → la planilla no se ve plana
--   · lat/lng reales de la zona → los markers del mapa caen donde corresponde

INSERT OR IGNORE INTO properties
 (id, owner_kind, agency_id, branch_id, owner_user_id, operation, kind, title, description,
  price, currency, price_period, area_m2, rooms, bathrooms, capacity, amenities,
  address, city, province, lat, lng, status, published, available_from, available_until) VALUES

-- ── Temporario (el corazón del negocio) ────────────────────────────────────────
 (1,'agency',1,1,1,'temporario','casa',
  'Casa a 2 cuadras del muelle — 6 personas',
  'Casa de madera y ladrillo a 200 m del muelle de pesca. Tres dormitorios, parrilla techada y galería con reposeras. Ideal familias; a metros de la parada del centro.',
  185000,'ARS','noche',140,3,2,6,'["wifi","gas","parrilla","cochera","patio","tv"]',
  'Paseo 102 e/ 2 y 3','Villa Gesell','Buenos Aires',-37.2639,-56.9736,'disponible',1,'2026-09-01','2027-04-30'),

 (2,'agency',1,2,1,'temporario','cabaña',
  'Cabaña en el bosque — Mar de las Pampas',
  'Cabaña de troncos entre pinos, a 400 m del mar. Estufa a leña, deck con parrilla y total privacidad. El clásico de Mar de las Pampas.',
  142000,'ARS','noche',75,2,1,4,'["wifi","gas","parrilla","patio","aire"]',
  'Calle Roble e/ Juan de Garay y El Lucero','Mar de las Pampas','Buenos Aires',-37.3244,-57.0064,'reservada',1,'2026-09-01','2027-04-30'),

 (3,'agency',1,3,1,'temporario','departamento',
  'Depto frente al mar — Pinamar centro',
  'Dos ambientes con balcón al mar sobre Av. Bunge. Totalmente equipado, cochera cubierta y amenities del edificio. A pasos de los restaurantes.',
  168000,'ARS','noche',52,1,1,3,'["wifi","tv","aire","cochera","pileta","seguridad","amoblado"]',
  'Av. Bunge 890, piso 7','Pinamar','Buenos Aires',-37.1073,-56.8608,'disponible',1,'2026-09-01','2027-04-30'),

 (4,'agency',1,2,1,'temporario','casa',
  'Casa con pileta en Cariló — 8 personas',
  'Casa de categoría en pleno bosque de Cariló, con pileta climatizada y quincho. Cuatro dormitorios en suite. Alquiler por quincena en temporada alta.',
  340000,'ARS','noche',260,4,3,8,'["wifi","gas","pileta","parrilla","cochera","aire","seguridad","patio"]',
  'Carpintero e/ Avutarda y Benteveo','Cariló','Buenos Aires',-37.1667,-56.8833,'disponible',1,'2026-09-01','2027-04-30'),

 (5,'agency',1,1,1,'temporario','departamento',
  'Monoambiente para 2 — a una cuadra de la playa',
  'Monoambiente cómodo y luminoso, ideal pareja. A una cuadra de la bajada 104. Ropa blanca incluida.',
  96000,'ARS','noche',34,1,1,2,'["wifi","tv","aire","amoblado"]',
  'Av. 1 e/ Paseo 103 y 104','Villa Gesell','Buenos Aires',-37.2610,-56.9790,'alquilada',1,'2026-09-01','2027-04-30'),

-- ── Alquiler permanente ────────────────────────────────────────────────────────
 (6,'agency',1,1,1,'alquiler','departamento',
  'Dos ambientes al frente — alquiler anual',
  'Departamento de dos ambientes a estrenar, sobre avenida, con balcón. Apto crédito de garantía. Expensas bajas.',
  420000,'ARS','mes',48,1,1,3,'["wifi","gas","aire","cochera"]',
  'Av. 3 1180, piso 2 "B"','Villa Gesell','Buenos Aires',-37.2655,-56.9750,'disponible',1,NULL,NULL),

 (7,'agency',1,3,1,'alquiler','casa',
  'Casa 3 dormitorios — alquiler anual Pinamar',
  'Casa en zona residencial tranquila, tres dormitorios, jardín con parrilla y cochera para dos autos. Contrato a 3 años con ajuste por ICL.',
  780000,'ARS','mes',165,3,2,6,'["gas","parrilla","cochera","patio"]',
  'Del Cangrejo 340','Pinamar','Buenos Aires',-37.1120,-56.8690,'alquilada',1,NULL,NULL),

-- ── Venta ──────────────────────────────────────────────────────────────────────
 (8,'agency',1,1,1,'venta','casa',
  'Casa de 4 ambientes con lote propio',
  'Casa sólida de material sobre lote de 400 m², a seis cuadras del centro. Tres dormitorios, living con hogar y galería. Excelente para renta de temporada.',
  135000,'USD','total',180,3,2,7,'["gas","parrilla","cochera","patio"]',
  'Paseo 128 e/ 4 y 5','Villa Gesell','Buenos Aires',-37.2720,-56.9700,'disponible',1,NULL,NULL),

 (9,'agency',1,2,1,'venta','terreno',
  'Lote de 600 m² en el bosque',
  'Terreno en Mar Azul, 600 m² con pinos añosos, a 500 m del mar. Todos los servicios en la puerta. Ideal para construir cabañas de renta.',
  48000,'USD','total',600,NULL,NULL,NULL,'[]',
  'Calle 36 e/ Mar del Plata y Miramar','Mar Azul','Buenos Aires',-37.3400,-57.0200,'disponible',1,NULL,NULL),

 (10,'agency',1,3,1,'venta','departamento',
  'Departamento a estrenar frente al golf',
  'Tres ambientes a estrenar con vista al campo de golf. Amenities completos: pileta, gimnasio y seguridad 24 h. Entrega inmediata.',
  189000,'USD','total',94,2,2,5,'["wifi","pileta","cochera","aire","seguridad"]',
  'Av. Arq. Jorge Bunge 2100','Pinamar','Buenos Aires',-37.1040,-56.8560,'reservada',1,NULL,NULL);

-- Una operación cerrada: sale de la lista activa pero queda en el histórico (0014).
INSERT OR IGNORE INTO properties
 (id, owner_kind, agency_id, branch_id, owner_user_id, operation, kind, title, description,
  price, currency, price_period, area_m2, rooms, bathrooms, city, province, lat, lng,
  status, published, archived_at) VALUES
 (11,'agency',1,1,1,'venta','ph','PH reciclado en el centro — VENDIDO',
  'PH de dos ambientes reciclado a nuevo. Operación cerrada en julio.',
  72000,'USD','total',56,1,1,'Villa Gesell','Buenos Aires',-37.2668,-56.9722,
  'vendida',0,datetime('now','-12 days'));

-- Reservas de temporada: hacen que el calendario y el filtro por fechas tengan sentido.
-- kind='reserva' (0014) → el estado disponible/reservada se calcula desde acá.
INSERT OR IGNORE INTO bookings (id, property_id, from_date, to_date, guest_name, kind, notes) VALUES
  (1, 2, '2027-01-02','2027-01-16','Familia Aguirre','reserva','Seña cobrada, saldo al ingresar'),
  (2, 2, '2027-01-20','2027-02-03','Grupo Lezama','reserva','Confirmada por WhatsApp'),
  (3, 4, '2027-01-05','2027-01-19','Familia Roldán','reserva','Quincena completa, pago total'),
  (4, 1, '2026-12-26','2027-01-02','Turno propietario','reserva','Bloqueo: la usa el dueño'),
  (5, 5, '2026-09-01','2027-04-30','Inquilino anual','alquiler','Alquiler permanente en curso');
