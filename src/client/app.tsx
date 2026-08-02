import { useEffect, useState } from 'react';
import { api } from './lib/api';
import type { Me } from './lib/types';
import { Dashboard } from './components/dashboard';
import { AdminConsole } from './components/admin-console';

const DEFAULT_BRAND = 'Coopen Places';

export function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [brandName, setBrandName] = useState(DEFAULT_BRAND);

  useEffect(() => {
    api<Me>('/api/auth/me')
      .then(setMe)
      .catch((e) => setErr(String(e.message || e)))
      .finally(() => setLoading(false));
    api<{ brandName: string }>('/api/site')
      .then((r) => setBrandName(r.brandName || DEFAULT_BRAND))
      .catch(() => {});
  }, []);

  useEffect(() => { document.title = `${brandName} — Panel`; }, [brandName]);

  function login() {
    window.location.href = `/api/auth/google?return_to=${encodeURIComponent('/app')}`;
  }
  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    window.location.reload();
  }

  if (loading) return <div className="center muted">Cargando…</div>;
  if (err) return <div className="center err">Error: {err}</div>;
  if (!me?.authed || !me.user) return <Login brandName={brandName} onLogin={login} />;
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  if (path.startsWith('/app/admin') && me.user.isSuperAdmin) return <AdminConsole user={me.user} onLogout={logout} />;
  return <Dashboard user={me.user} brandName={brandName} onLogout={logout} />;
}

function Login({ brandName, onLogin }: { brandName: string; onLogin: () => void }) {
  return (
    <div className="center">
      <div className="card-lg">
        <h1>{brandName}</h1>
        <p className="muted">Gestión inmobiliaria y publicación de propiedades.</p>
        <button className="btn" onClick={onLogin}>Entrar con Google</button>
        <p className="muted small">
          Iniciá sesión con tu cuenta de Google. Email y contraseña, próximamente.
        </p>
        <a className="link" href="/">← Volver al marketplace</a>
      </div>
    </div>
  );
}
