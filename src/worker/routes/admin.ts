import { Hono } from 'hono';
import type { AppEnv, UserRow } from '../lib/types';
import { bad, notFound, num, str } from '../lib/http';
import { createAgencyWithTrial } from '../lib/subscription';
import { genToken } from '../lib/auth';

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'inmo';
}

// Admin de Coopen (módulo D). Gateado por requireSuperAdmin en el index.
// v0: Charly cobra en persona y extiende trial / marca pago a mano (sin checkout online).
export const admin = new Hono<AppEnv>();

// Todas las agencias con su suscripción (estado efectivo) y su dueño.
admin.get('/agencies', async (c) => {
  const res = await c.env.DB
    .prepare(
      `SELECT a.id, a.name, a.created_at, u.email AS owner_email,
              s.status, s.trial_ends_at, s.active_until, s.notes,
              CASE
                WHEN s.status = 'blocked' THEN 1
                WHEN s.status = 'trial'  AND s.trial_ends_at IS NOT NULL AND datetime('now') > s.trial_ends_at THEN 1
                WHEN s.status = 'active' AND s.active_until  IS NOT NULL AND datetime('now') > s.active_until  THEN 1
                ELSE 0
              END AS blocked,
              CAST(julianday(COALESCE(s.active_until, s.trial_ends_at)) - julianday('now') AS INTEGER) AS days_left,
              (SELECT COUNT(*) FROM properties p WHERE p.agency_id = a.id) AS properties,
              (SELECT token FROM agency_access aa WHERE aa.agency_id = a.id AND aa.active = 1 ORDER BY aa.id LIMIT 1) AS access_token
       FROM agencies a
       JOIN users u ON u.id = a.owner_user_id
       LEFT JOIN subscriptions s ON s.agency_id = a.id
       ORDER BY a.created_at DESC`,
    )
    .all();
  return c.json({ agencies: res.results });
});

// Extender el trial N días (reactiva la gestión sin cobrar todavía).
admin.post('/agencies/:id/extend-trial', async (c) => {
  const id = num(c.req.param('id'));
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const days = num(body.days) ?? 30;
  if (id == null) return bad(c, 'id inválido');
  if (days <= 0 || days > 3650) return bad(c, 'days fuera de rango');
  const r = await c.env.DB
    .prepare(
      `UPDATE subscriptions SET status = 'trial', trial_ends_at = datetime('now', ?),
              notes = ?, updated_at = datetime('now') WHERE agency_id = ?`,
    )
    .bind(`+${days} days`, `trial +${days}d por admin`, id)
    .run();
  if (!r.meta.changes) return notFound(c, 'Agencia sin suscripción');
  return c.json({ ok: true, status: 'trial', days });
});

// Marcar como paga N meses (cobro en persona → activa la gestión).
admin.post('/agencies/:id/mark-paid', async (c) => {
  const id = num(c.req.param('id'));
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const months = num(body.months) ?? 1;
  if (id == null) return bad(c, 'id inválido');
  if (months <= 0 || months > 120) return bad(c, 'months fuera de rango');
  const r = await c.env.DB
    .prepare(
      `UPDATE subscriptions SET status = 'active', active_until = datetime('now', ?),
              notes = ?, updated_at = datetime('now') WHERE agency_id = ?`,
    )
    .bind(`+${months} months`, `pago en persona ${months}m`, id)
    .run();
  if (!r.meta.changes) return notFound(c, 'Agencia sin suscripción');
  return c.json({ ok: true, status: 'active', months });
});

// Bloquear manualmente.
admin.post('/agencies/:id/block', async (c) => {
  const id = num(c.req.param('id'));
  if (id == null) return bad(c, 'id inválido');
  const r = await c.env.DB
    .prepare("UPDATE subscriptions SET status = 'blocked', updated_at = datetime('now') WHERE agency_id = ?")
    .bind(id)
    .run();
  if (!r.meta.changes) return notFound(c, 'Agencia sin suscripción');
  return c.json({ ok: true, status: 'blocked' });
});

// Crear una inmobiliaria nueva + su usuario sintético + link de acceso único.
admin.post('/agencies', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = str(body.name, 120);
  if (!name) return bad(c, 'Falta el nombre de la inmobiliaria');
  const sub = 'local:' + crypto.randomUUID();
  const email = `${slugify(name)}.${genToken().slice(0, 6)}@places.local`;
  const user = await c.env.DB
    .prepare('INSERT INTO users (auth_sub, email, name) VALUES (?, ?, ?) RETURNING *')
    .bind(sub, email, name)
    .first<UserRow>();
  if (!user) return bad(c, 'No se pudo crear el usuario de la inmobiliaria');
  await c.env.DB.prepare('INSERT OR IGNORE INTO places_profiles (user_id, is_owner, onboarded) VALUES (?, 1, 1)').bind(user.id).run();
  const agency = await createAgencyWithTrial(c.env.DB, user.id, { name });
  const token = genToken();
  await c.env.DB
    .prepare('INSERT INTO agency_access (agency_id, user_id, token, label) VALUES (?, ?, ?, ?)')
    .bind(agency.id, user.id, token, `Acceso ${name}`)
    .run();
  return c.json({ agency, accessUrl: `${new URL(c.req.url).origin}/i/${token}` }, 201);
});

// Regenerar el link de acceso (revoca el anterior).
admin.post('/agencies/:id/regenerate-access', async (c) => {
  const id = num(c.req.param('id'));
  if (id == null) return bad(c, 'id inválido');
  const token = genToken();
  const acc = await c.env.DB.prepare('SELECT id FROM agency_access WHERE agency_id = ? ORDER BY id LIMIT 1').bind(id).first<{ id: number }>();
  if (acc) {
    await c.env.DB.prepare('UPDATE agency_access SET token = ?, active = 1 WHERE id = ?').bind(token, acc.id).run();
  } else {
    const ag = await c.env.DB.prepare('SELECT owner_user_id FROM agencies WHERE id = ?').bind(id).first<{ owner_user_id: number }>();
    if (!ag) return notFound(c, 'Agencia no encontrada');
    await c.env.DB.prepare('INSERT INTO agency_access (agency_id, user_id, token, label) VALUES (?, ?, ?, ?)').bind(id, ag.owner_user_id, token, 'Acceso').run();
  }
  return c.json({ accessUrl: `${new URL(c.req.url).origin}/i/${token}` });
});
