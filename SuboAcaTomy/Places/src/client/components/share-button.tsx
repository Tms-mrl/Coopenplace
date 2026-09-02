import { useState } from 'react';
import { Link as LinkIcon, Share2 } from 'lucide-react';
import { SiFacebook, SiInstagram, SiWhatsapp } from 'react-icons/si';
import { money, type Property } from '../lib/types';
import { toast } from '../lib/toast';
import { Modal } from './property-form';
import { Button } from './ui/button';

const origin = typeof window !== 'undefined' ? window.location.origin : '';

function shareData(p: Property) {
  const url = `${origin}/propiedad/${p.id}`;
  const loc = [p.city, p.province].filter(Boolean).join(', ');
  const text = `🏡 ${p.title} — ${money(p.price, p.currency, p.price_period)}${loc ? `\n📍 ${loc}` : ''}`;
  return { url, title: p.title, text, full: `${text}\n\n${url}` };
}

// Botón para compartir el aviso en redes (WhatsApp/Facebook/Instagram) + copiar link.
// Comparte el link PÚBLICO de la propiedad (con og:image/título para la vista previa).
export function ShareButton({ p, icon }: { p: Property; icon?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {icon
        ? <Button variant="ghost" size="icon" title="Compartir en redes" onClick={() => setOpen(true)}><Share2 className="h-4 w-4" /></Button>
        : <Button variant="ghost" size="sm" onClick={() => setOpen(true)}><Share2 className="h-4 w-4" />Compartir</Button>}
      {open && <ShareModal p={p} onClose={() => setOpen(false)} />}
    </>
  );
}

export function ShareModal({ p, onClose }: { p: Property; onClose: () => void }) {
  const { url, title, text, full } = shareData(p);
  const canNative = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const openWin = (u: string) => window.open(u, '_blank', 'noopener');
  const whatsapp = () => openWin(`https://wa.me/?text=${encodeURIComponent(full)}`);
  const facebook = () => openWin(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`);

  async function copy(t: string): Promise<boolean> {
    try { await navigator.clipboard.writeText(t); return true; } catch { return false; }
  }
  async function instagram() {
    // Instagram no acepta compartir un link por URL. En el celu usamos el share nativo
    // (deja elegir Instagram); si no, copiamos texto+link para pegar en historia/bio.
    if (canNative) { try { await navigator.share({ title, text, url }); onClose(); return; } catch { return; } }
    if (await copy(full)) toast('Copiamos el texto y el link. Pegalo en tu historia o bio de Instagram.', 'ok');
    else toast('No se pudo copiar. Copialo del link de abajo.', 'err');
  }
  async function copyLink() { const ok = await copy(url); toast(ok ? 'Link copiado ✓' : 'No se pudo copiar', ok ? 'ok' : 'err'); }
  async function nativeShare() { try { await navigator.share({ title, text, url }); onClose(); } catch { /* cancelado */ } }

  return (
    <Modal title="Compartir propiedad" onClose={onClose}>
      {!p.published && <p className="share-warn">⚠️ Esta propiedad está <b>sin publicar</b>: el link no será visible hasta que la publiques.</p>}
      <div className="share-grid">
        <button className="share-opt wa" onClick={whatsapp}><SiWhatsapp size={26} />WhatsApp</button>
        <button className="share-opt fb" onClick={facebook}><SiFacebook size={26} />Facebook</button>
        <button className="share-opt ig" onClick={instagram}><SiInstagram size={26} />Instagram</button>
        <button className="share-opt lk" onClick={copyLink}><LinkIcon className="h-6 w-6" />Copiar link</button>
      </div>
      {canNative && <Button variant="outline" className="mt-3 w-full" onClick={nativeShare}>Más opciones de compartir…</Button>}
      <p className="muted small" style={{ marginTop: 10 }}>Se comparte el link público del aviso, con foto y datos para la vista previa.</p>
    </Modal>
  );
}
