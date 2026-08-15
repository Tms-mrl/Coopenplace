-- El Muelle · 04 · galerías de fotos.
--
--   npx wrangler d1 execute elmuelle-db --remote --file=../Clientes/ElMuelle/seed/04-fotos.sql
--
-- REQUISITO: las imágenes tienen que estar en el bucket `elmuelle-media` ANTES de correr
-- esto (si no, las fichas quedan con el <img> roto). Se copiaron desde `coopen-places-media`:
--
--   npx wrangler r2 object get coopen-places-media/seed/casa1.jpg --file=casa1.jpg --remote
--   npx wrangler r2 object put elmuelle-media/seed/casa1.jpg      --file=casa1.jpg --remote
--
-- ⚠️ NO ALCANZA CON LAS FOTOS DE LAS PROPIEDADES. El landing (SSR) tiene 3 imágenes
-- **hardcodeadas en el código** (`lib/landing.ts`) que también viven en R2 y hay que
-- copiar, o el hero sale como un rectángulo negro:
--
--   site/hero.jpg · site/interior.jpg · site/keys.jpg
--
-- Es el paso que más fácil se olvida al provisionar un cliente white-label nuevo: el
-- seed de la base no las menciona porque no son filas, son parte del diseño del sitio.
--
-- ⚠️ SON FOTOS GENÉRICAS DE DEMO, no propiedades reales de El Muelle. Antes de mostrarle
-- el sitio al cliente como suyo, reemplazarlas por las de su cartera (se suben desde el
-- panel, que ya las manda a R2 con key `prop/<id>/<uuid>.jpg`).
--
-- Idempotente: ids fijos + INSERT OR IGNORE. La foto de `sort` más bajo es la portada.

INSERT OR IGNORE INTO property_media (id, property_id, r2_key, kind, sort) VALUES
  -- 1 · Casa a 2 cuadras del muelle
  ( 1, 1,'seed/casa1.jpg','photo',1), ( 2, 1,'seed/casa3.jpg','photo',2), ( 3, 1,'seed/casa4.jpg','photo',3),
  -- 2 · Cabaña en el bosque
  ( 4, 2,'seed/casa2.jpg','photo',1), ( 5, 2,'seed/casa4.jpg','photo',2), ( 6, 2,'seed/casa1.jpg','photo',3),
  -- 3 · Depto frente al mar
  ( 7, 3,'seed/casa3.jpg','photo',1), ( 8, 3,'seed/casa2.jpg','photo',2),
  -- 4 · Casa con pileta en Cariló
  ( 9, 4,'seed/casa4.jpg','photo',1), (10, 4,'seed/casa1.jpg','photo',2), (11, 4,'seed/casa2.jpg','photo',3),
  (12, 4,'seed/casa3.jpg','photo',4),
  -- 5 · Monoambiente
  (13, 5,'seed/casa2.jpg','photo',1),
  -- 6 · Dos ambientes alquiler anual
  (14, 6,'seed/casa3.jpg','photo',1), (15, 6,'seed/casa1.jpg','photo',2),
  -- 7 · Casa 3 dormitorios Pinamar
  (16, 7,'seed/casa1.jpg','photo',1), (17, 7,'seed/casa4.jpg','photo',2),
  -- 8 · Casa 4 ambientes en venta
  (18, 8,'seed/casa4.jpg','photo',1), (19, 8,'seed/casa2.jpg','photo',2), (20, 8,'seed/casa3.jpg','photo',3),
  -- 9 · Lote (sin fotos: es un terreno, se ve el mapa)
  -- 10 · Depto frente al golf
  (21,10,'seed/casa3.jpg','photo',1), (22,10,'seed/casa4.jpg','photo',2);
