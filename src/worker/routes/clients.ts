import { Hono } from 'hono';
import type { AppEnv } from '../lib/types';
import { bad, notFound, num, str } from '../lib/http';
import { getUserAgency } from '../lib/subscription';

// CRM de la inmobiliaria: contactos (propietarios en consignación + interesados)
// y cruce interesado→propiedades disponibles (matching).
export const clients = new Hono<AppEnv>();

// prefs = { operation?, city?, max_price?, min_rooms? } — qué busca el interesado.
function buildPrefs(body: Record<string, unknown>): string {
  const p: Record<string, unknown> = {};
  const op = str(body.operation, 20);
  if (op && ['venta', 'alquiler', 'temporario'].includes(op)) p.operation = op;
  const city = str(body.city, 80);
  if (city) p.city = city;
  const maxP = num(body.max_price);
  if (maxP != null) p.max_price = maxP;
  const minR = num(body.min_rooms);
  if (minR != null) p.min_rooms = minR;
  return JSON.stringify(p);
}

clients.get('/', async (c) => {
  const mine = await getUserAgency(c.env.DB, c.var.user.id);
  if (!mine) return c.json({ clients: [] });
  const res = await c.env.DB
    .prepare('SELECT * FROM clients WHERE agency_id = ? ORDER BY created_at DESC')
    .bind(mine.agency.id)
    .all();
  return c.json({ clients: res.results });
});

clients.post('/', async (c) => {
  const mine = await getUserAgency(c.env.DB, c.var.user.id);
  if (!mine) return bad(c, 'No tenés una inmobiliaria');
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = str(body.name, 120);
  if (!name) return bad(c, 'Falta el nombre del contacto');
  const kind = body.kind === 'propietario' ? 'propietario' : 'interesado';
  const row = await c.env.DB
    .prepare(
      `INSERT INTO clients (agency_id, kind, name, email, phone, notes, prefs)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    )
    .bind(mine.agency.id, kind, name, str(body.email, 160), str(body.phone, 40), str(body.notes, 2000), buildPrefs(body))
    .first();
  return c.json({ client: row }, 201);
});

clients.patch('/:id', async (c) => {
  const mine = await getUserAgency(c.env.DB, c.var.user.id);
  if (!mine) return bad(c, 'No tenés una inmobiliaria');
  const id = num(c.req.param('id'));
  if (id == null) return bad(c, 'id inválido');
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const sets: string[] = [];
  const binds: unknown[] = [];
  const put = (col: string, v: unknown) => { sets.push(`${col} = ?`); binds.push(v); };
  if ('name' in body) { const n = str(body.name, 120); if (!n) return bad(c, 'name vacío'); put('name', n); }
  if ('email' in body) put('email', str(body.email, 160));
  if ('phone' in body) put('phone', str(body.phone, 40));
  if ('notes' in body) put('notes', str(body.notes, 2000));
  if ('kind' in body) put('kind', body.kind === 'propietario' ? 'propietario' : 'interesado');
  if ('operation' in body || 'city' in body || 'max_price' in body || 'min_rooms' in body) put('prefs', buildPrefs(body));
  if (!sets.length) return bad(c, 'Nada para actualizar');
  binds.push(id, mine.agency.id);
  const r = await c.env.DB.prepare(`UPDATE clients SET ${sets.join(', ')} WHERE id = ? AND agency_id = ?`).bind(...binds).run();
  if (!r.meta.changes) return notFound(c, 'Contacto no encontrado');
  const updated = await c.env.DB.prepare('SELECT * FROM clients WHERE id = ?').bind(id).first();
  return c.json({ client: updated });
});

clients.delete('/:id', async (c) => {
  const mine = await getUserAgency(c.env.DB, c.var.user.id);
  if (!mine) return bad(c, 'No tenés una inmobiliaria');
  const id = num(c.req.param('id'));
  if (id == null) return bad(c, 'id inválido');
  const r = await c.env.DB.prepare('DELETE FROM clients WHERE id = ? AND agency_id = ?').bind(id, mine.agency.id).run();
  if (!r.meta.changes) return notFound(c, 'Contacto no encontrado');
  return c.json({ success: true });
});

// Cruce: propiedades DISPONIBLES de la agencia que matchean lo que busca el interesado.
clients.get('/:id/matches', async (c) => {
  const mine = await getUserAgency(c.env.DB, c.var.user.id);
  if (!mine) return c.json({ matches: [] });
  const id = num(c.req.param('id'));
  if (id == null) return bad(c, 'id inválido');
  const client = await c.env.DB
    .prepare('SELECT prefs FROM clients WHERE id = ? AND agency_id = ?')
    .bind(id, mine.agency.id)
    .first<{ prefs: string | null }>();
  if (!client) return notFound(c, 'Contacto no encontrado');
  const prefs = JSON.parse(client.prefs || '{}') as { operation?: string; city?: string; max_price?: number; min_rooms?: number };

  const where = ["agency_id = ?", "status = 'disponible'"];
  const binds: unknown[] = [mine.agency.id];
  if (prefs.operation) { where.push('operation = ?'); binds.push(prefs.operation); }
  if (prefs.city) { where.push('LOWER(city) LIKE ?'); binds.push(`%${prefs.city.toLowerCase()}%`); }
  if (prefs.max_price != null) { where.push('(price IS NULL OR price <= ?)'); binds.push(prefs.max_price); }
  if (prefs.min_rooms != null) { where.push('(rooms IS NULL OR rooms >= ?)'); binds.push(prefs.min_rooms); }
  const res = await c.env.DB
    .prepare(
      `SELECT id, title, operation, price, currency, city, rooms, area_m2, status,
              (SELECT r2_key FROM property_media pm WHERE pm.property_id = properties.id ORDER BY pm.sort LIMIT 1) AS cover_key
       FROM properties WHERE ${where.join(' AND ')} ORDER BY price LIMIT 50`,
    )
    .bind(...binds)
    .all();
  return c.json({ matches: res.results, prefs });
});
