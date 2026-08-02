import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useVisited } from '../lib/use-visited';
import type { Agency, Property, User } from '../lib/types';
import { AgencyWorkspace, type Tab as AgencyTab } from './agency-workspace';
import { CalendarModal, ImportArgenprop, PropertyCard } from './properties-panel';
import { AskModal, PhotoManager, PropertyForm } from './property-form';
import { ContractsPanel } from './contracts-panel';
import { FinancePanel } from './finance-panel';
import { TenantPanel } from './tenant-panel';
import { AccountMenu, SettingsPanel } from './account-menu';
import { toast } from '../lib/toast';

type NonAgencyView = 'inicio' | 'contratos' | 'finanzas' | 'guardados' | 'configuracion';

export function Dashboard({ user, brandName, onLogout }: { user: User; brandName: string; onLogout: () => void }) {
  const [agency, setAgency] = useState<Agency | null>(user.roles.agency);
  const [loaded, setLoaded] = useState(false);
  const [nonAgencyView, setNonAgencyView] = useState<NonAgencyView>('inicio');
  const [agencyTab, setAgencyTab] = useState<AgencyTab>('resumen');

  useEffect(() => {
    api<{ agency: Agency | null; role: string | null }>('/api/agencies/mine')
      .then((r) => setAgency(r.agency ? { ...r.agency, role: r.role || r.agency.role } : null))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="/">{brandName}</a>
        <div className="who">
          {user.isSuperAdmin && <a className="chip admin" href="/app/admin">Admin de Coopen</a>}
          <AccountMenu
            user={user}
            onLogout={onLogout}
            onFavorites={agency ? undefined : () => setNonAgencyView('guardados')}
            onSettings={() => (agency ? setAgencyTab('configuracion') : setNonAgencyView('configuracion'))}
          />
        </div>
      </header>
      <main className="content content-wide">
        {!loaded ? <p className="muted">Cargando…</p>
          : agency ? <AgencyWorkspace agency={agency} user={user} onLogout={onLogout} tab={agencyTab} setTab={setAgencyTab} />
          : <NonAgencyHome user={user} onAgencyCreated={setAgency} view={nonAgencyView} setView={setNonAgencyView} onLogout={onLogout} />}
      </main>
    </div>
  );
}

// Home del user sin inmobiliaria: propietario particular + inquilino en un mismo lugar,
// con un sub-nav (mis propiedades / contratos / favoritos y alertas / configuración). El
// view vive en Dashboard para que el menú de cuenta pueda saltar directo a cualquier tab.
function NonAgencyHome({ user, onAgencyCreated, view, setView, onLogout }: {
  user: User; onAgencyCreated: (a: Agency) => void; view: NonAgencyView; setView: (v: NonAgencyView) => void; onLogout: () => void;
}) {
  const visited = useVisited(view);
  return (
    <>
      <nav className="subnav">
        <button className={view === 'inicio' ? 'on' : ''} onClick={() => setView('inicio')}>Mis propiedades</button>
        <button className={view === 'contratos' ? 'on' : ''} onClick={() => setView('contratos')}>Contratos</button>
        <button className={view === 'finanzas' ? 'on' : ''} onClick={() => setView('finanzas')}>Finanzas</button>
        <button className={view === 'guardados' ? 'on' : ''} onClick={() => setView('guardados')}>Favoritos y alertas</button>
        <button className={view === 'configuracion' ? 'on' : ''} onClick={() => setView('configuracion')}>Configuración</button>
      </nav>
      {visited.has('inicio') && <div hidden={view !== 'inicio'}><OwnerHome user={user} onAgencyCreated={onAgencyCreated} /></div>}
      {visited.has('contratos') && <section className="panel" hidden={view !== 'contratos'}><ContractsPanel scope="particular" /></section>}
      {visited.has('finanzas') && <section className="panel" hidden={view !== 'finanzas'}><FinancePanel scope="particular" businessName={user.name || user.email} /></section>}
      {visited.has('guardados') && <div hidden={view !== 'guardados'}><TenantPanel /></div>}
      {visited.has('configuracion') && <div hidden={view !== 'configuracion'}><SettingsPanel user={user} onLogout={onLogout} /></div>}
    </>
  );
}

function OwnerHome({ user, onAgencyCreated }: { user: User; onAgencyCreated: (a: Agency) => void }) {
  const [props, setProps] = useState<Property[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [managing, setManaging] = useState<Property | null>(null);
  const [editing, setEditing] = useState<Property | null>(null);
  const [cal, setCal] = useState<Property | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const load = () => api<{ properties: Property[] }>('/api/properties/mine').then((r) => setProps(r.properties)).catch(() => {});
  useEffect(() => { load(); }, []);
  const visibleProps = props.filter((p) => (showArchived ? !!p.archived_at : !p.archived_at));

  const [askAgency, setAskAgency] = useState(false);
  async function createAgency(name: string) {
    setAskAgency(false);
    try {
      const r = await api<{ agency: Agency }>('/api/agencies', { method: 'POST', body: JSON.stringify({ name }) });
      onAgencyCreated({ ...r.agency, role: 'admin' } as Agency);
    } catch (e) { toast(String((e as Error).message), 'err'); }
  }

  const firstName = (user.name || '').trim().split(' ')[0] || 'Bienvenido';
  return (
    <>
      {!user.onboarded && <Onboarding onDone={() => window.location.reload()} />}

      <section className="owner-hero">
        <div className="bg" /><div className="ov" />
        <div className="in">
          <h1>Hola, {firstName} 👋</h1>
          <p>Publicá y administrá tus propiedades en un solo lugar.</p>
          <div className="cta">
            <button className="btn" onClick={() => setShowNew(true)}>+ Publicar propiedad</button>
            <ImportArgenprop scope="particular" onImported={load} />
          </div>
        </div>
      </section>

      <div className="owner-grid">
        <section className="panel">
          <div className="row between">
            <h2>Mis propiedades</h2>
            <div className="row" style={{ gap: 8 }}>
              {visibleProps.length > 0 && <span className="chip">{visibleProps.length}</span>}
              <button className="link-btn" onClick={() => setShowArchived((v) => !v)}>{showArchived ? 'Ver activas' : 'Ver archivadas'}</button>
            </div>
          </div>
          {visibleProps.length === 0 ? (
            showArchived ? <p className="muted">No hay propiedades archivadas.</p> : (
              <div className="empty-state">
                <img src="/media/site/keys.jpg" alt="" />
                <h3>Todavía no publicaste ninguna</h3>
                <p className="muted">Subí tu primera propiedad con fotos, o importala de Argenprop en segundos.</p>
                <button className="btn" onClick={() => setShowNew(true)}>Publicar mi primera propiedad</button>
              </div>
            )
          ) : (
            <div className="prop-list">
              {visibleProps.map((p) => <PropertyCard key={p.id} p={p} onManage={() => setManaging(p)} onEdit={() => setEditing(p)} onCalendar={() => setCal(p)} onReload={load} />)}
            </div>
          )}
        </section>

        <aside className="owner-aside">
          <section className="upsell">
            <img src="/media/site/together.jpg" alt="" />
            <div className="upsell-body">
              <h3>¿Sos inmobiliaria?</h3>
              <p className="muted">Gestioná sucursales, agentes y clientes con un panel completo. Demo gratis 30 días.</p>
              <button className="btn ghost" onClick={() => setAskAgency(true)}>Crear inmobiliaria</button>
            </div>
          </section>
        </aside>
      </div>

      {showNew && <PropertyForm scope="particular" onClose={() => setShowNew(false)} onSaved={load} />}
      {editing && <PropertyForm scope="particular" edit={editing} onClose={() => setEditing(null)} onSaved={load} />}
      {managing && <PhotoManager property={managing} onClose={() => setManaging(null)} onSaved={load} />}
      {cal && <CalendarModal property={cal} onClose={() => { setCal(null); load(); }} />}
      {askAgency && <AskModal title="Crear inmobiliaria" label="Nombre de la inmobiliaria" placeholder="Ej: ElMuelle Propiedades" cta="Crear" onSubmit={createAgency} onClose={() => setAskAgency(false)} />}
    </>
  );
}

function Onboarding({ onDone }: { onDone: () => void }) {
  const [owner, setOwner] = useState(true);
  const [tenant, setTenant] = useState(false);
  async function save() {
    try { await api('/api/profile', { method: 'PUT', body: JSON.stringify({ owner, tenant }) }); onDone(); }
    catch (e) { toast(String((e as Error).message), 'err'); }
  }
  return (
    <section className="panel onb">
      <h2>¡Bienvenido!</h2>
      <label><input type="checkbox" checked={owner} onChange={(e) => setOwner(e.target.checked)} /> Soy propietario / inmobiliaria y quiero publicar</label>
      <label><input type="checkbox" checked={tenant} onChange={(e) => setTenant(e.target.checked)} /> Busco alquilar o comprar</label>
      <button className="btn" onClick={save}>Continuar</button>
    </section>
  );
}
