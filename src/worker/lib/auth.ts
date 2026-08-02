import type { Context, Next } from 'hono';
import type { AppEnv, Env, UserRow } from './types';
import { forbidden } from './http';

// Login propio: Google OAuth (authorization code) + sesión local (tabla `sessions`,
// cookie opaca resuelta contra la DB). En paralelo, el link de acceso de agencia
// (magic link, tabla `agency_access`) sigue siendo una sesión local aparte, para
// clientes B2B que no inician sesión con Google.

const SESSION_COOKIE = 'places_session';
const SESSION_DAYS = 30;
const ACCESS_COOKIE = 'places_access';

/** Token aleatorio (48 hex) — cookies de sesión y links de acceso. */
export function genToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export function readCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get('Cookie') || '';
  const m = cookie.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return m && m[1] ? decodeURIComponent(m[1]) : null;
}

/** Busca (o crea) el usuario local a partir del sub del proveedor (ej "google:<id>"). */
export async function upsertUser(db: D1Database, sub: string, email: string, name?: string | null): Promise<UserRow> {
  const existing = await db.prepare('SELECT * FROM users WHERE auth_sub = ?').bind(sub).first<UserRow>();
  if (existing) return existing;
  const created = await db
    .prepare('INSERT INTO users (auth_sub, email, name) VALUES (?, ?, ?) RETURNING *')
    .bind(sub, email, name ?? null)
    .first<UserRow>();
  if (!created) throw new Error('No se pudo crear el usuario');
  // Perfil vacío (elige rol en el onboarding).
  await db.prepare('INSERT OR IGNORE INTO places_profiles (user_id) VALUES (?)').bind(created.id).run();
  return created;
}

/** Abre una sesión propia para el user (30 días) y devuelve el token de la cookie. */
export async function createSession(db: D1Database, userId: number): Promise<string> {
  const token = genToken();
  await db
    .prepare(`INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, datetime('now', ?))`)
    .bind(userId, token, `+${SESSION_DAYS} days`)
    .run();
  return token;
}

export function sessionCookieHeader(token: string): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_DAYS * 86400}; Secure; HttpOnly; SameSite=Lax`;
}
export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax`;
}
export function clearAccessCookieHeader(): string {
  return `${ACCESS_COOKIE}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax`;
}

export async function deleteSession(db: D1Database, token: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
}

export function readSessionToken(request: Request): string | null {
  return readCookie(request, SESSION_COOKIE);
}

/** Sesión propia (cookie `places_session`) resuelta contra la DB. */
export async function resolveSessionUser(env: Env, request: Request): Promise<UserRow | null> {
  const token = readSessionToken(request);
  if (!token) return null;
  return env.DB
    .prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > datetime('now')`)
    .bind(token)
    .first<UserRow>();
}

/**
 * Sesión local de agencia (link de acceso /i/<token>): la cookie places_access lleva
 * un token que mapea a un usuario sintético de la agencia. En paralelo al login normal.
 */
export async function resolveLocalUser(env: Env, request: Request): Promise<UserRow | null> {
  const token = readCookie(request, ACCESS_COOKIE);
  if (!token) return null;
  return env.DB
    .prepare('SELECT u.* FROM agency_access a JOIN users u ON u.id = a.user_id WHERE a.token = ? AND a.active = 1')
    .bind(token)
    .first<UserRow>();
}

/** Bypass de dev local (DEV_USER="email|nombre"). NUNCA en prod (no se setea el secret/var). */
async function resolveDevUser(env: Env): Promise<UserRow | null> {
  if (!env.DEV_USER) return null;
  const [email = 'dev@local', name = 'Dev'] = env.DEV_USER.split('|');
  return upsertUser(env.DB, 'dev:local', email, name);
}

/** ¿El user es super-admin? La allowlist (SUPER_ADMIN_SUBS) acepta sub o email. */
export function isSuperAdmin(env: Env, user: UserRow): boolean {
  const list = (env.SUPER_ADMIN_SUBS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.includes(user.auth_sub.toLowerCase()) || list.includes(user.email.toLowerCase());
}

/** Resuelve el user actual (dev bypass > link de acceso de agencia > sesión propia), o null. */
export async function resolveUser(env: Env, request: Request): Promise<UserRow | null> {
  return (await resolveDevUser(env)) || (await resolveLocalUser(env, request)) || (await resolveSessionUser(env, request));
}

/** Middleware: exige sesión (cualquiera de las tres). Deja el UserRow en c.var. */
export async function requireUser(c: Context<AppEnv>, next: Next) {
  const user = await resolveUser(c.env, c.req.raw);
  if (!user) return c.json({ error: 'No autenticado', code: 'UNAUTHENTICATED' }, 401);
  c.set('user', user);
  await next();
}

/** Middleware: además de sesión, exige ser super-admin. */
export async function requireSuperAdmin(c: Context<AppEnv>, next: Next) {
  if (!isSuperAdmin(c.env, c.var.user)) return forbidden(c, 'Requiere super-admin');
  await next();
}
