import { Hono } from 'hono';
import type { AppEnv } from '../lib/types';
import { bad, forbidden, str } from '../lib/http';
import { getBrandName } from '../lib/layout';
import { isSuperAdmin, requireUser } from '../lib/auth';
import { getUserAgency } from '../lib/subscription';

// Marca del sitio (white-label): 1 deploy = 1 cliente, editable en vivo desde
// Configuración por el admin/manager de la agencia. GET es público (landing/login
// la necesitan antes de loguearse); PUT exige sesión + rol, aplicado a nivel de ruta
// porque este archivo se monta antes del requireUser global (ver index.ts).
export const site = new Hono<AppEnv>();

site.get('/', async (c) => {
  return c.json({ brandName: await getBrandName(c.env.DB) });
});

site.put('/', requireUser, async (c) => {
  const mine = await getUserAgency(c.env.DB, c.var.user.id);
  const allowed = (mine && ['admin', 'manager'].includes(mine.role)) || isSuperAdmin(c.env, c.var.user);
  if (!allowed) return forbidden(c, 'Solo el admin de la inmobiliaria');
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const brandName = str(body.brandName, 60);
  if (!brandName) return bad(c, 'Nombre vacío');
  await c.env.DB
    .prepare(
      `INSERT INTO site_settings (id, brand_name, updated_at) VALUES (1, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET brand_name = ?, updated_at = datetime('now')`,
    )
    .bind(brandName, brandName)
    .run();
  return c.json({ brandName });
});
