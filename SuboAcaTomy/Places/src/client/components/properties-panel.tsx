import { useEffect, useState } from 'react';
import {
  BarChart3, Calendar as CalendarIcon, Camera, Check, ChevronDown, ChevronLeft,
  ChevronRight, ChevronUp, Download, Link as LinkIcon, Pencil, Send, Trash2, X,
} from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/cn';
import { mediaUrl, money, STATUSES, type Branch, type Media, type Property } from '../lib/types';
import { AMENITIES, parseAmenities } from '../lib/amenities';
import { toast } from '../lib/toast';
import { prefetchClients } from '../lib/clients-cache';
import { CalendarModal } from './calendar-modal';
import { AskModal, Modal, PhotoManager, PropertyForm } from './property-form';
import { StatsModal } from './stats-modal';
import { ShareButton } from './share-button';
import { useIsMobile } from '../lib/use-mobile';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useConfirm } from './ui/use-confirm';

// Sentinels para <Select> (Radix no permite value="" en un Item) — nunca viajan al backend.
const ALL = '_all';
const NONE = '_none';

const STATUS_COLOR: Record<string, string> = {
  disponible: 'text-ok',
  reservada: 'text-warn',
  alquilada: 'text-muted-foreground',
  vendida: 'text-muted-foreground',
};

const KIND_LABEL: Record<string, string> = { reserva: 'Reservada', alquiler: 'Alquilada' };

// Etiqueta de solo lectura: disponible/reservada/alquilada se calculan desde el
// calendario, ya no se eligen a mano (ver SaleActions para el único estado manual).
function StatusChip({ status }: { status: string }) {
  return <span className={cn('status-chip', STATUS_COLOR[status])}>{status}</span>;
}

// Único estado manual (vendida) + archivado (solo permitido desde vendida). Se repite
// igual en PropertyCard/PropertyRow/PropertyMobileCard, cada uno ya tiene su propio
// `patch`/`confirm` locales.
function SaleActions({ p, patch, confirm }: {
  p: Property; patch: (body: Record<string, unknown>) => Promise<void>; confirm: ReturnType<typeof useConfirm>;
}) {
  if (p.archived_at) {
    return <Button variant="ghost" size="sm" onClick={() => patch({ archived: false })}>Desarchivar</Button>;
  }
  if (p.status === 'vendida') {
    return (
      <>
        <Button variant="ghost" size="sm" onClick={() => patch({ status: 'disponible' })}>Reactivar</Button>
        <Button variant="ghost" size="sm" onClick={async () => {
          if (await confirm(`¿Archivar "${p.title}"? Deja de aparecer en Inventario (y se despublica); queda como historial.`)) patch({ archived: true });
        }}>Archivar</Button>
      </>
    );
  }
  return (
    <Button variant="ghost" size="sm" onClick={async () => {
      if (await confirm(`¿Marcar "${p.title}" como vendida? Deja de aceptar nuevas reservas o alquileres.`)) patch({ status: 'vendida' });
    }}>Marcar como vendida</Button>
  );
}

// ¿Hay alguna reserva que se solape con el rango [from, to]? (test de solapamiento de intervalos)
function bookedInRange(bookingsJson: string | null, from: string, to: string): boolean {
  try { return (JSON.parse(bookingsJson || '[]') as { f: string; t: string }[]).some((b) => b.f <= to && from <= b.t); }
  catch { return false; }
}

const origin = typeof window !== 'undefined' ? window.location.origin : '';
const AMEN_MAP = new Map(AMENITIES.map((a) => [a.key, a]));

/** Filtro preseteado desde los KPIs del Resumen. */
export type PropPreset = { status?: string; branch?: number; op?: string; published?: string };

// Link wa.me para MANDARLE la info de una propiedad al cliente (número del cliente).
function clientWaLink(numRaw: string, p: Property): string {
  const digits = numRaw.replace(/\D/g, '');
  const facts = [p.rooms ? `${p.rooms} amb` : null, p.capacity ? `${p.capacity} personas` : null, p.area_m2 ? `${p.area_m2} m²` : null].filter(Boolean).join(' · ');
  const loc = [p.city, p.province].filter(Boolean).join(', ');
  const msg = `¡Hola! Te paso la info de esta propiedad:\n\n🏡 ${p.title}\n💵 ${money(p.price, p.currency, p.price_period)}${loc ? `\n📍 ${loc}` : ''}${facts ? `\n${facts}` : ''}\n\nVer más: ${origin}/propiedad/${p.id}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
}

// Botón "Enviar al cliente" con modal para el WhatsApp del cliente.
function SendToClientButton({ p, icon }: { p: Property; icon?: boolean }) {
  const [open, setOpen] = useState(false);
  function send(num: string) {
    if (num.replace(/\D/g, '').length < 8) { toast('Número inválido (con código de país)', 'err'); return; }
    setOpen(false);
    window.open(clientWaLink(num, p), '_blank');
  }
  return (
    <>
      {icon
        ? <Button variant="ghost" size="icon" title="Enviar al cliente por WhatsApp" onClick={() => setOpen(true)}><Send className="h-4 w-4" /></Button>
        : <Button size="sm" onClick={() => setOpen(true)}>Enviar al cliente</Button>}
      {open && <AskModal title="Enviar al cliente" label="WhatsApp del cliente (con código de país)" placeholder="5493415551234" cta="Enviar por WhatsApp" onSubmit={send} onClose={() => setOpen(false)} />}
    </>
  );
}

// Importar una propiedad desde un link de Argenprop (extrae datos + fotos).
export function ImportArgenprop({ scope, onImported }: { scope: 'agency' | 'particular'; onImported: () => void }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  async function run(url: string) {
    setOpen(false); setBusy(true);
    try {
      const r = await api<{ imported: { photos: number } }>('/api/properties/import', { method: 'POST', body: JSON.stringify({ url, scope }) });
      toast(`Importada con ${r.imported.photos} foto(s). Quedó como borrador — revisala y publicala.`, 'ok');
      onImported();
    } catch (e) { toast(String((e as Error).message), 'err'); }
    finally { setBusy(false); }
  }
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} disabled={busy}>
        <Download className="h-4 w-4" />{busy ? 'Importando…' : 'Importar de Argenprop'}
      </Button>
      {open && <AskModal title="Importar de Argenprop" label="Pegá el link de la propiedad en Argenprop." placeholder="https://www.argenprop.com/..." cta="Importar" onSubmit={run} onClose={() => setOpen(false)} />}
    </>
  );
}

// Card de propiedad (formato tarjeta) — usada en el home del propietario particular.
export function PropertyCard({ p, branches, onManage, onEdit, onCalendar, onReload }: {
  p: Property; branches?: Branch[]; onManage: () => void; onEdit: () => void; onCalendar: () => void; onReload: () => void;
}) {
  const confirm = useConfirm();
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState(false);
  async function patch(body: Record<string, unknown>) {
    try { await api(`/api/properties/${p.id}`, { method: 'PATCH', body: JSON.stringify(body) }); onReload(); }
    catch (e) { toast(String((e as Error).message), 'err'); }
  }
  async function del() {
    if (!(await confirm(`¿Eliminar "${p.title}"? No se puede deshacer.`, { destructive: true, confirmLabel: 'Eliminar' }))) return;
    try { await api(`/api/properties/${p.id}`, { method: 'DELETE' }); onReload(); }
    catch (e) { toast(String((e as Error).message), 'err'); }
  }
  function copyLink() {
    navigator.clipboard?.writeText(`${origin}/propiedad/${p.id}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }, () => {});
  }
  const facts = [p.rooms ? `🛏 ${p.rooms}` : null, p.bathrooms ? `🚿 ${p.bathrooms}` : null, p.capacity ? `👥 ${p.capacity}` : null, p.area_m2 ? `${p.area_m2} m²` : null].filter(Boolean).join(' · ');
  const amen = parseAmenities(p.amenities);
  return (
    <div className="prop-card">
      <div className="prop-thumb">{p.cover_key ? <img src={mediaUrl(p.cover_key)} alt="" /> : <span className="ph-ic">🏡</span>}</div>
      <div className="prop-info">
        <div className="prop-title">{p.title}</div>
        <div className="prop-meta"><span className="tag">{p.operation}</span><b>{money(p.price, p.currency, p.price_period)}</b>{facts && <span className="muted small">· {facts}</span>}</div>
        {amen.length > 0 && (
          <div className="amen-row">
            {amen.map((k) => { const a = AMEN_MAP.get(k); return a ? <span className="amen-chip" key={k}>{a.icon} {a.label}</span> : null; })}
          </div>
        )}
        <div className="prop-controls">
          <label>Disponibilidad
            <StatusChip status={p.status} />
          </label>
          <button className="views-chip" onClick={() => setStats(true)} title="Ver estadísticas de visitas">👁 {p.views ?? 0} visita{(p.views ?? 0) === 1 ? '' : 's'}</button>
        </div>
      </div>
      <div className="prop-actions">
        <SendToClientButton p={p} />
        <div className="prop-links">
          <ShareButton p={p} />
          <Button variant="ghost" size="sm" onClick={() => setStats(true)}><BarChart3 className="h-4 w-4" />Estadísticas</Button>
          <Button variant="ghost" size="sm" onClick={onEdit}><Pencil className="h-4 w-4" />Editar</Button>
          <Button variant="ghost" size="sm" onClick={copyLink}>{copied ? <Check className="h-4 w-4 text-ok" /> : <LinkIcon className="h-4 w-4" />}{copied ? 'Copiado' : 'Copiar link'}</Button>
          <Button variant="ghost" size="sm" onClick={onManage}><Camera className="h-4 w-4" />Fotos</Button>
          <Button variant="ghost" size="sm" onClick={onCalendar}><CalendarIcon className="h-4 w-4" />Reservas</Button>
          <Button variant="ghost" size="sm" onClick={() => patch({ published: !p.published })}>{p.published ? 'Despublicar' : 'Publicar'}</Button>
          <SaleActions p={p} patch={patch} confirm={confirm} />
          <Button variant="ghost" size="sm" onClick={del} className="text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" />Eliminar</Button>
        </div>
      </div>
      {stats && <StatsModal property={p} onClose={() => setStats(false)} />}
    </div>
  );
}

// Visor de fotos a pantalla completa.
function Lightbox({ media, onClose }: { media: Media[]; onClose: () => void }) {
  const [i, setI] = useState(0);
  const n = media.length;
  const at = ((i % n) + n) % n;
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setI((x) => x + 1);
      if (e.key === 'ArrowLeft') setI((x) => x - 1);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  if (!n) return null;
  return (
    <div className="lightbox" onClick={onClose}>
      <button className="lb-x" onClick={onClose}>✕</button>
      {n > 1 && <button className="lb-nav lb-prev" onClick={(e) => { e.stopPropagation(); setI((x) => x - 1); }}>‹</button>}
      <img src={mediaUrl(media[at]!.r2_key)} alt="" onClick={(e) => e.stopPropagation()} />
      {n > 1 && <button className="lb-nav lb-next" onClick={(e) => { e.stopPropagation(); setI((x) => x + 1); }}>›</button>}
      {n > 1 && <div className="lb-count">{at + 1} / {n}</div>}
    </div>
  );
}

// Fila de la planilla (+ detalle desplegable).
function PropertyRow({ p, branches, expanded, checked, onSelect, onToggle, onManage, onEdit, onCalendar, onLightbox, onStats, onReload }: {
  p: Property; branches: Branch[]; expanded: boolean; checked: boolean; onSelect: () => void;
  onToggle: () => void; onManage: () => void; onEdit: () => void; onCalendar: () => void; onLightbox: (p: Property) => void; onStats: () => void; onReload: () => void;
}) {
  const confirm = useConfirm();
  const [copied, setCopied] = useState(false);
  async function patch(body: Record<string, unknown>) {
    try { await api(`/api/properties/${p.id}`, { method: 'PATCH', body: JSON.stringify(body) }); onReload(); }
    catch (e) { toast(String((e as Error).message), 'err'); }
  }
  async function del() {
    if (!(await confirm(`¿Eliminar "${p.title}"? No se puede deshacer.`, { destructive: true, confirmLabel: 'Eliminar' }))) return;
    try { await api(`/api/properties/${p.id}`, { method: 'DELETE' }); onReload(); }
    catch (e) { toast(String((e as Error).message), 'err'); }
  }
  function copyLink() {
    navigator.clipboard?.writeText(`${origin}/propiedad/${p.id}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }, () => {});
  }
  const specs = [p.rooms ? `🛏${p.rooms}` : null, p.bathrooms ? `🚿${p.bathrooms}` : null, p.capacity ? `👥${p.capacity}` : null, p.area_m2 ? `${p.area_m2}m²` : null].filter(Boolean).join(' ');
  const amen = parseAmenities(p.amenities);
  return (
    <>
      <tr className={checked ? 'srow sel' : 'srow'}>
        <td className="c-check"><input type="checkbox" checked={checked} onChange={onSelect} /></td>
        <td className="c-thumb" onClick={() => onLightbox(p)} title="Ver galería de fotos">
          <div className="thumb-wrap">
            {p.cover_key ? <img className="thumb-sm" src={mediaUrl(p.cover_key)} alt="" /> : <span className="thumb-sm ph">🏡</span>}
            {(p.photos ?? 0) > 1 && <span className="thumb-count">📷 {p.photos}</span>}
          </div>
        </td>
        <td className="c-title" onClick={onToggle}><div className="st-title">{p.title}</div><div className="muted small">{[p.city, p.province].filter(Boolean).join(', ') || '—'}</div></td>
        <td><span className="tag">{p.operation}</span></td>
        <td className="c-price">{money(p.price, p.currency, p.price_period)}</td>
        <td className="muted small nowrap">{specs || '—'}<span className="row-views" title="Visitas"> · 👁 {p.views ?? 0}</span></td>
        <td>
          <Select value={p.branch_id != null ? String(p.branch_id) : NONE} onValueChange={(v) => patch({ branch_id: v === NONE ? null : Number(v) })}>
            <SelectTrigger className="h-8 min-w-[120px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>— sucursal</SelectItem>
              {branches.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </td>
        <td><StatusChip status={p.status} /></td>
        <td>
          <button className={p.published ? 'pub on' : 'pub'} title={p.published ? 'Publicada — click para despublicar' : 'Borrador — click para publicar'} onClick={() => patch({ published: !p.published })}>{p.published ? '●' : '○'}</button>
        </td>
        <td className="c-actions">
          <SendToClientButton p={p} icon />
          <ShareButton p={p} icon />
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Estadísticas de visitas" onClick={onStats}><BarChart3 className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Copiar link" onClick={copyLink}>{copied ? <Check className="h-4 w-4 text-ok" /> : <LinkIcon className="h-4 w-4" />}</Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar datos" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Gestionar fotos" onClick={onManage}><Camera className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Reservas / calendario" onClick={onCalendar}><CalendarIcon className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" title="Eliminar" onClick={del}><Trash2 className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Ver detalle" onClick={onToggle}>{expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button>
        </td>
      </tr>
      {expanded && (
        <tr className="sdetail">
          <td colSpan={10}>
            <div className="sd-grid">
              <div>
                <b>Detalle</b>
                <div className="muted">{[p.rooms && `${p.rooms} ambientes`, p.bathrooms && `${p.bathrooms} baños`, p.capacity && `${p.capacity} personas`, p.area_m2 && `${p.area_m2} m²`].filter(Boolean).join(' · ') || '—'}</div>
                {p.address && <div className="muted small">📍 {p.address}</div>}
                {(p.available_from || p.available_until) && <div className="muted small">🗓 {p.available_from || '…'} → {p.available_until || '…'}</div>}
              </div>
              <div>
                <b>Comodidades</b>
                <div className="amen-row">{amen.length ? amen.map((k) => { const a = AMEN_MAP.get(k); return a ? <span className="amen-chip" key={k}>{a.icon} {a.label}</span> : null; }) : <span className="muted">—</span>}</div>
              </div>
            </div>
            {p.description && <p className="sd-desc">{p.description}</p>}
            <div className="row" style={{ gap: 14 }}>
              <Button variant="ghost" size="sm" onClick={() => onLightbox(p)}>Ver fotos</Button>
              <Button variant="ghost" size="sm" onClick={onManage}><Camera className="h-4 w-4" />Gestionar fotos</Button>
              <a className="link-btn" href={`/propiedad/${p.id}`} target="_blank" rel="noreferrer">↗ Ver publicación</a>
              <SaleActions p={p} patch={patch} confirm={confirm} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// Versión mobile de la fila: card apilada con las mismas acciones (la tabla es innavegable en el cel).
function PropertyMobileCard({ p, branches, checked, onSelect, onManage, onEdit, onCalendar, onLightbox, onStats, onReload }: {
  p: Property; branches: Branch[]; checked: boolean; onSelect: () => void;
  onManage: () => void; onEdit: () => void; onCalendar: () => void; onLightbox: (p: Property) => void; onStats: () => void; onReload: () => void;
}) {
  const confirm = useConfirm();
  const [copied, setCopied] = useState(false);
  async function patch(body: Record<string, unknown>) {
    try { await api(`/api/properties/${p.id}`, { method: 'PATCH', body: JSON.stringify(body) }); onReload(); }
    catch (e) { toast(String((e as Error).message), 'err'); }
  }
  async function del() {
    if (!(await confirm(`¿Eliminar "${p.title}"? No se puede deshacer.`, { destructive: true, confirmLabel: 'Eliminar' }))) return;
    try { await api(`/api/properties/${p.id}`, { method: 'DELETE' }); onReload(); }
    catch (e) { toast(String((e as Error).message), 'err'); }
  }
  function copyLink() {
    navigator.clipboard?.writeText(`${origin}/propiedad/${p.id}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }, () => {});
  }
  const loc = [p.city, p.province].filter(Boolean).join(', ');
  const specs = [p.rooms ? `🛏${p.rooms}` : null, p.bathrooms ? `🚿${p.bathrooms}` : null, p.capacity ? `👥${p.capacity}` : null, p.area_m2 ? `${p.area_m2}m²` : null].filter(Boolean).join(' ');
  const amen = parseAmenities(p.amenities);
  return (
    <div className={checked ? 'mcard sel' : 'mcard'}>
      <div className="mcard-top">
        <input type="checkbox" checked={checked} onChange={onSelect} />
        <div className="mcard-thumb" onClick={() => onLightbox(p)} title="Ver fotos">
          {p.cover_key ? <img src={mediaUrl(p.cover_key)} alt="" /> : <span className="ph">🏡</span>}
          {(p.photos ?? 0) > 1 && <span className="thumb-count">📷 {p.photos}</span>}
        </div>
        <div className="mcard-main">
          <div className="mcard-title" onClick={onEdit}>{p.title}</div>
          <div className="muted small">{loc || '—'}</div>
          <div className="mcard-price"><span className="tag">{p.operation}</span> <b>{money(p.price, p.currency, p.price_period)}</b></div>
          <div className="muted small">{specs || '—'} · 👁 {p.views ?? 0}</div>
        </div>
      </div>
      {amen.length > 0 && <div className="amen-row">{amen.map((k) => { const a = AMEN_MAP.get(k); return a ? <span className="amen-chip" key={k}>{a.icon} {a.label}</span> : null; })}</div>}
      <div className="mcard-selects">
        <label className="fld">Estado
          <StatusChip status={p.status} />
        </label>
        <label className="fld">Sucursal
          <Select value={p.branch_id != null ? String(p.branch_id) : NONE} onValueChange={(v) => patch({ branch_id: v === NONE ? null : Number(v) })}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>—</SelectItem>
              {branches.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <button className={p.published ? 'pub on' : 'pub'} onClick={() => patch({ published: !p.published })}>{p.published ? '● Publicada' : '○ Borrador'}</button>
      </div>
      <div className="mcard-actions">
        <Button variant="secondary" size="sm" onClick={onStats}><BarChart3 className="h-4 w-4" />Stats</Button>
        <SendToClientButton p={p} icon />
        <ShareButton p={p} icon />
        <Button variant="ghost" size="icon" title="Copiar link" onClick={copyLink}>{copied ? <Check className="h-4 w-4 text-ok" /> : <LinkIcon className="h-4 w-4" />}</Button>
        <Button variant="ghost" size="icon" title="Editar" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" title="Fotos" onClick={onManage}><Camera className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" title="Reservas" onClick={onCalendar}><CalendarIcon className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" title="Eliminar" onClick={del}><Trash2 className="h-4 w-4" /></Button>
      </div>
      <div className="mcard-actions">
        <SaleActions p={p} patch={patch} confirm={confirm} />
      </div>
    </div>
  );
}

const EMPTY_F = { text: '', op: '', status: '', branch: '', priceMax: '', currency: 'ARS', capacity: '', dateFrom: '', dateTo: '', published: '', archived: false };

export function PropertiesPanel({ branches, onChanged, preset }: { branches: Branch[]; onChanged?: () => void; preset?: PropPreset }) {
  const confirm = useConfirm();
  const [props, setProps] = useState<Property[]>([]);
  const [managing, setManaging] = useState<Property | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [lb, setLb] = useState<Media[] | null>(null);
  const [editing, setEditing] = useState<Property | null>(null);
  const [cal, setCal] = useState<Property | null>(null);
  const [stats, setStats] = useState<Property | null>(null);
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [f, setF] = useState({ ...EMPTY_F });
  const set = (k: keyof typeof EMPTY_F, v: string) => setF((s) => ({ ...s, [k]: v }));
  const isMobile = useIsMobile();

  const load = () => api<{ properties: Property[] }>('/api/properties/mine').then((r) => setProps(r.properties)).catch(() => {});
  useEffect(() => { load(); prefetchClients(); }, []);
  useEffect(() => {
    if (!preset) return;
    setF({ ...EMPTY_F, status: preset.status || '', branch: preset.branch != null ? String(preset.branch) : '', op: preset.op || '', published: preset.published || '' });
  }, [preset]);
  const reload = () => { load(); onChanged?.(); };

  function toggleSel(id: number) { setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  async function bulkPatch(body: Record<string, unknown>) {
    await Promise.all([...selected].map((id) => api(`/api/properties/${id}`, { method: 'PATCH', body: JSON.stringify(body) }).catch(() => {})));
    setSelected(new Set()); reload();
  }
  async function bulkDelete() {
    if (!(await confirm(`¿Eliminar ${selected.size} propiedad(es)? No se puede deshacer.`, { destructive: true, confirmLabel: 'Eliminar' }))) return;
    await Promise.all([...selected].map((id) => api(`/api/properties/${id}`, { method: 'DELETE' }).catch(() => {})));
    setSelected(new Set()); reload();
  }
  function sortBy(key: string) { setSort((s) => (s && s.key === key ? { key, dir: (s.dir === 1 ? -1 : 1) } : { key, dir: 1 })); }
  const sortMark = (key: string) => (sort?.key === key ? (sort.dir === 1 ? ' ▲' : ' ▼') : '');

  async function openLightbox(p: Property) {
    try {
      const r = await api<{ media: Media[] }>(`/api/properties/${p.id}/media`);
      if (!r.media.length) { toast('Esta propiedad todavía no tiene fotos.', 'err'); return; }
      setLb(r.media);
    } catch (e) { toast(String((e as Error).message), 'err'); }
  }

  const filtered = props.filter((p) => {
    // Archivadas ocultas por defecto (el toggle "Ver archivadas" invierte esto).
    if (f.archived ? !p.archived_at : !!p.archived_at) return false;
    if (f.text) { const q = f.text.toLowerCase(); if (!(`${p.title} ${p.city || ''}`.toLowerCase().includes(q))) return false; }
    if (f.op && p.operation !== f.op) return false;
    if (f.status && p.status !== f.status) return false;
    if (f.branch && String(p.branch_id) !== f.branch) return false;
    if (f.published === 'yes' && !p.published) return false;
    if (f.published === 'no' && p.published) return false;
    if (f.priceMax && p.price != null) {
      // El precio máx se scopea a la moneda elegida (salvo 'all'): 100.000 ARS no matchea 50.000 USD.
      if (f.currency !== 'all' && p.currency !== f.currency) return false;
      if (p.price > Number(f.priceMax)) return false;
    }
    // Capacidad EXACTA, no mínima: pedir "1 persona" y que aparezcan las de 2, 3 y 4
    // convierte el filtro en ruido (decisión de Charly, 2026-08-07).
    if (f.capacity && p.capacity !== Number(f.capacity)) return false;
    if (f.dateFrom || f.dateTo) {
      // Rango pedido: la propiedad debe estar disponible TODO el tramo [from, to] y sin reservas que se solapen.
      const from = f.dateFrom || f.dateTo;
      const to = f.dateTo || f.dateFrom;
      if (p.available_from && p.available_from > from) return false;
      if (p.available_until && p.available_until < to) return false;
      if (bookedInRange(p.bookings, from, to)) return false;
    }
    return true;
  });
  const dirty = JSON.stringify(f) !== JSON.stringify(EMPTY_F);

  const sorted = sort ? [...filtered].sort((a, b) => {
    const k = sort.key as keyof Property;
    if (k === 'price') return ((a.price ?? -Infinity) - (b.price ?? -Infinity)) * sort.dir;
    const av = String(a[k] ?? '').toLowerCase(); const bv = String(b[k] ?? '').toLowerCase();
    return av < bv ? -sort.dir : av > bv ? sort.dir : 0;
  }) : filtered;
  const allSel = sorted.length > 0 && sorted.every((p) => selected.has(p.id));
  const toggleAll = () => setSelected(allSel ? new Set() : new Set(sorted.map((p) => p.id)));

  return (
    <div>
      <div className="panel-head">
        <h3>Inventario · {filtered.length} de {props.length}</h3>
        <div className="row" style={{ gap: 8 }}>
          <ImportArgenprop scope="agency" onImported={reload} />
          <Button onClick={() => setShowNew(true)}>Nueva propiedad</Button>
        </div>
      </div>
      <div className="filters">
        <input placeholder="Buscar título / ciudad" value={f.text} onChange={(e) => set('text', e.target.value)} />
        <Select value={f.op || ALL} onValueChange={(v) => set('op', v === ALL ? '' : v)}>
          <SelectTrigger className="w-auto min-w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Operación</SelectItem>
            <SelectItem value="alquiler">Alquiler</SelectItem>
            <SelectItem value="venta">Venta</SelectItem>
            <SelectItem value="temporario">Temporario</SelectItem>
          </SelectContent>
        </Select>
        <Select value={f.status || ALL} onValueChange={(v) => set('status', v === ALL ? '' : v)}>
          <SelectTrigger className="w-auto min-w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Estado</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={f.branch || ALL} onValueChange={(v) => set('branch', v === ALL ? '' : v)}>
          <SelectTrigger className="w-auto min-w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Sucursal</SelectItem>
            {branches.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={f.currency} onValueChange={(v) => set('currency', v)}>
          <SelectTrigger className="w-auto min-w-[100px]" title="Moneda del precio máx"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ARS">$ ARS</SelectItem>
            <SelectItem value="USD">US$</SelectItem>
            <SelectItem value="all">Ambas</SelectItem>
          </SelectContent>
        </Select>
        <input type="number" placeholder="Precio máx" value={f.priceMax} onChange={(e) => set('priceMax', e.target.value)} style={{ maxWidth: 120 }} />
        <input type="number" min={1} placeholder="Personas" title="Capacidad exacta: 4 muestra solo las de 4 personas" value={f.capacity} onChange={(e) => set('capacity', e.target.value)} style={{ maxWidth: 120 }} />
        <label className="date-f">Desde<input type="date" value={f.dateFrom} onChange={(e) => set('dateFrom', e.target.value)} /></label>
        <label className="date-f">Hasta<input type="date" value={f.dateTo} onChange={(e) => set('dateTo', e.target.value)} /></label>
        <Button variant={f.archived ? 'secondary' : 'outline'} size="sm" onClick={() => setF((s) => ({ ...s, archived: !s.archived }))}>
          {f.archived ? 'Viendo archivadas' : 'Ver archivadas'}
        </Button>
        {dirty && <Button variant="ghost" size="sm" onClick={() => setF({ ...EMPTY_F })}><X className="h-4 w-4" />Limpiar filtros</Button>}
      </div>
      <div className={selected.size > 0 ? 'bulk-bar-wrap open' : 'bulk-bar-wrap'}>
        <div className="bulk-bar-inner">
          <div className="bulk-bar">
            <span><b>{selected.size}</b> seleccionada{selected.size === 1 ? '' : 's'}</span>
            <Button size="sm" variant="secondary" onClick={() => bulkPatch({ published: true })}>Publicar</Button>
            <Button size="sm" variant="outline" onClick={() => bulkPatch({ published: false })}>Despublicar</Button>
            <Button size="sm" variant="outline" onClick={() => bulkPatch({ status: 'vendida' })}>Marcar como vendida</Button>
            <Select value={ALL} onValueChange={(v) => { if (v === NONE) bulkPatch({ branch_id: null }); else if (v !== ALL) bulkPatch({ branch_id: Number(v) }); }}>
              <SelectTrigger className="h-8 w-auto min-w-[150px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Mover a sucursal…</SelectItem>
                <SelectItem value={NONE}>— Sin sucursal</SelectItem>
                {branches.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" variant="destructive" onClick={bulkDelete}>Eliminar</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Cancelar</Button>
          </div>
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="muted">No hay propiedades con esos filtros.</p>
      ) : isMobile ? (
        <>
          <div className="mcard-toolbar">
            <label className="chk-all"><input type="checkbox" checked={allSel} onChange={toggleAll} /> Todas</label>
            <Select
              value={sort ? `${sort.key}:${sort.dir}` : ALL}
              onValueChange={(v) => { if (v === ALL) { setSort(null); return; } const [k, d] = v.split(':'); setSort({ key: k!, dir: Number(d) as 1 | -1 }); }}
            >
              <SelectTrigger className="h-8 w-auto min-w-[150px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Más recientes</SelectItem>
                <SelectItem value="price:1">Precio ↑</SelectItem>
                <SelectItem value="price:-1">Precio ↓</SelectItem>
                <SelectItem value="title:1">Título A→Z</SelectItem>
                <SelectItem value="status:1">Estado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="mcard-list">
            {sorted.map((p) => (
              <PropertyMobileCard key={p.id} p={p} branches={branches} checked={selected.has(p.id)} onSelect={() => toggleSel(p.id)}
                onManage={() => setManaging(p)} onEdit={() => setEditing(p)} onCalendar={() => setCal(p)} onLightbox={openLightbox} onStats={() => setStats(p)} onReload={reload} />
            ))}
          </div>
        </>
      ) : (
        <div className="sheet">
          <table className="sheet-tbl">
            <thead><tr>
              <th className="c-check"><input type="checkbox" checked={allSel} onChange={toggleAll} title="Seleccionar todas" /></th>
              <th></th>
              <th className="th-sort" onClick={() => sortBy('title')}>Propiedad{sortMark('title')}</th>
              <th className="th-sort" onClick={() => sortBy('operation')}>Op.{sortMark('operation')}</th>
              <th className="th-sort" onClick={() => sortBy('price')}>Precio{sortMark('price')}</th>
              <th>Detalle</th>
              <th className="th-sort" onClick={() => sortBy('branch_name')}>Sucursal{sortMark('branch_name')}</th>
              <th className="th-sort" onClick={() => sortBy('status')}>Estado{sortMark('status')}</th>
              <th>Pub.</th><th></th>
            </tr></thead>
            <tbody>
              {sorted.map((p) => (
                <PropertyRow key={p.id} p={p} branches={branches} expanded={expanded === p.id}
                  checked={selected.has(p.id)} onSelect={() => toggleSel(p.id)}
                  onToggle={() => setExpanded((e) => (e === p.id ? null : p.id))}
                  onManage={() => setManaging(p)} onEdit={() => setEditing(p)} onCalendar={() => setCal(p)} onLightbox={openLightbox} onStats={() => setStats(p)} onReload={reload} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showNew && <PropertyForm scope="agency" branches={branches} onClose={() => setShowNew(false)} onSaved={reload} />}
      {editing && <PropertyForm scope="agency" branches={branches} edit={editing} onClose={() => setEditing(null)} onSaved={reload} />}
      {managing && <PhotoManager property={managing} onClose={() => setManaging(null)} onSaved={reload} />}
      {cal && <CalendarModal property={cal} onClose={() => { setCal(null); reload(); }} />}
      {stats && <StatsModal property={stats} onClose={() => setStats(null)} />}
      {lb && <Lightbox media={lb} onClose={() => setLb(null)} />}
    </div>
  );
}
