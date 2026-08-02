import { esc } from './layout';

// Landing SSR del marketplace — estética "warm editorial real estate".
// Hero con foto real, intención (alquilar/comprar/vender), sección humana, CTA login.
// Mobile-first; interactividad progresiva (título que cambia al hover), anda sin JS.

const LP_STYLES = `
.lp-hero{position:relative;overflow:hidden;border-radius:22px;margin:16px 0 12px;min-height:500px;display:flex;align-items:flex-end;background:#241d15;box-shadow:var(--shadow-lg)}
.lp-hero .lp-bg{position:absolute;inset:0;background:url('/media/site/hero.jpg') center/cover no-repeat;transform:scale(1.03);animation:lp-zoom 20s ease-in-out infinite alternate}
@keyframes lp-zoom{to{transform:scale(1.11)}}
.lp-hero .lp-ov{position:absolute;inset:0;background:linear-gradient(180deg,rgba(28,22,15,.12) 0%,rgba(28,22,15,.5) 52%,rgba(24,18,12,.9) 100%)}
.lp-hero .lp-in{position:relative;padding:40px 34px 34px;width:100%;max-width:720px}
.lp-eyebrow{display:inline-block;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#f2e4cf;background:rgba(189,90,55,.34);border:1px solid rgba(240,200,160,.35);border-radius:999px;padding:6px 14px;margin-bottom:16px}
.lp-title{font-size:clamp(32px,6.5vw,60px);line-height:1.02;margin:0 0 14px;font-weight:700;color:#fdf8ef;transition:opacity .18s}
.lp-sub{color:#eaddc8;font-size:clamp(16px,4vw,20px);max-width:540px;margin:0 0 26px;line-height:1.5}
.lp-cta{display:flex;gap:12px;flex-wrap:wrap}
.lp-fade{opacity:0;transform:translateY(16px);animation:lp-in .7s cubic-bezier(.2,.7,.2,1) forwards}
.lp-fade.d1{animation-delay:.06s}.lp-fade.d2{animation-delay:.18s}.lp-fade.d3{animation-delay:.3s}
@keyframes lp-in{to{opacity:1;transform:none}}

.lp-sec{margin:44px 0 10px}
.lp-sec h2{font-size:clamp(24px,5vw,32px);margin:0 0 6px}
.lp-sec .lp-lead{color:var(--muted);margin:0 0 20px;font-size:17px}

.lp-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.lp-card{position:relative;display:block;padding:26px 24px;border-radius:18px;border:1px solid var(--line);background:var(--surface);box-shadow:var(--shadow);transition:transform .16s ease,box-shadow .25s ease}
.lp-card:hover{transform:translateY(-5px);box-shadow:var(--shadow-lg)}
.lp-card .lp-ic{font-size:30px;display:block;margin-bottom:12px}
.lp-card b{font-size:21px;font-weight:600}
.lp-card span.lp-desc{display:block;color:var(--muted);margin-top:5px;font-size:15px}
.lp-card .lp-go{position:absolute;top:24px;right:24px;color:var(--accent);font-size:20px;opacity:0;transform:translateX(-4px);transition:.16s}
.lp-card:hover .lp-go{opacity:1;transform:none}

.lp-search{display:flex;gap:10px;flex-wrap:wrap;margin:20px 0 0;background:var(--surface);padding:12px;border-radius:16px;border:1px solid var(--line);box-shadow:var(--shadow)}
.lp-search select,.lp-search input{padding:12px 14px;border-radius:10px;border:1px solid var(--line);background:var(--paper);color:var(--ink);font:inherit;font-size:15px}
.lp-search input{flex:1;min-width:170px}

.lp-human{display:grid;grid-template-columns:1fr 1.05fr;gap:26px;align-items:center;margin:52px 0;padding:34px;border-radius:22px;background:var(--forest);color:#f0e6d3;box-shadow:var(--shadow-lg)}
.lp-human h2{margin:0 0 12px;font-size:clamp(24px,4.5vw,34px);color:#fdf8ef}
.lp-human p{color:#c9bda4;margin:0 0 20px;font-size:17px;line-height:1.55}
.lp-human .btn.wa{background:var(--wa)}
.lp-human-imgs{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.lp-human-imgs img{width:100%;height:230px;object-fit:cover;border-radius:16px;display:block}
.lp-human-imgs img:first-child{margin-top:-18px}
.lp-human-imgs img:last-child{margin-bottom:-18px}

.lp-account{margin:44px 0;padding:30px 34px;border-radius:22px;border:1px solid var(--line);background:var(--surface);box-shadow:var(--shadow);display:flex;justify-content:space-between;align-items:center;gap:18px;flex-wrap:wrap}
.lp-account b{font-size:22px;font-weight:600}
.lp-account p{color:var(--muted);margin:5px 0 0;font-size:16px}

.lp-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:10px 0 48px}
.lp-step{padding:22px;border:1px solid var(--line);border-radius:18px;background:var(--surface);box-shadow:var(--shadow)}
.lp-step .n{color:var(--accent);font-weight:700;font-size:24px}
.lp-step b{display:block;margin:8px 0 3px;font-size:17px}
.lp-step span{color:var(--muted);font-size:15px}

@media(max-width:820px){.lp-human{grid-template-columns:1fr}.lp-human-imgs img:first-child,.lp-human-imgs img:last-child{margin:0}}
@media(max-width:640px){
  .lp-hero{min-height:440px;border-radius:16px}.lp-hero .lp-in{padding:26px 20px 24px}
  .lp-cta .btn{flex:1;text-align:center}
  .lp-cards,.lp-steps{grid-template-columns:1fr}
  .lp-human{padding:22px}.lp-human-imgs img{height:160px}
  .lp-account{flex-direction:column;align-items:stretch;text-align:center;padding:24px}.lp-account .lp-cta .btn{flex:1}
}
`;

const LP_SCRIPT = `(function(){
  var t=document.getElementById('lp-title');
  if(t){var base=t.textContent;
    document.querySelectorAll('[data-title]').forEach(function(el){
      el.addEventListener('pointerenter',function(){t.style.opacity=.25;setTimeout(function(){t.textContent=el.getAttribute('data-title');t.style.opacity=1;},110);});
      el.addEventListener('pointerleave',function(){t.style.opacity=.25;setTimeout(function(){t.textContent=base;t.style.opacity=1;},110);});
    });
  }
  // "Cerca de mí": geolocaliza (con el gesto del click) y lleva a /buscar con las coords.
  document.querySelectorAll('[data-near]').forEach(function(b){
    b.addEventListener('click',function(){
      if(!navigator.geolocation){window.location.href='/buscar';return;}
      var orig=b.textContent;b.textContent='📍 Buscando…';b.disabled=true;
      navigator.geolocation.getCurrentPosition(function(pos){
        var la=Math.round(pos.coords.latitude*1e5)/1e5,ln=Math.round(pos.coords.longitude*1e5)/1e5;
        window.location.href='/buscar?near=1&lat='+la+'&lng='+ln;
      },function(){b.textContent=orig;b.disabled=false;alert('No pudimos obtener tu ubicación. Revisá los permisos del navegador y probá de nuevo.');},{enableHighAccuracy:true,timeout:8000});
    });
  });
})();`;

export type LandingOpts = { cards: string; brandName: string };

export function renderLanding({ cards, brandName }: LandingOpts): string {
  const login = `/api/auth/google?return_to=${encodeURIComponent('/app')}`;
  const intentCard = (href: string, ic: string, title: string, desc: string, heroTitle: string) =>
    `<a class="lp-card" href="${esc(href)}" data-title="${esc(heroTitle)}">
      <span class="lp-ic">${ic}</span><b>${esc(title)}</b>
      <span class="lp-desc">${esc(desc)}</span><span class="lp-go">→</span>
    </a>`;

  return `<style>${LP_STYLES}</style>
  <section class="lp-hero">
    <div class="lp-bg"></div><div class="lp-ov"></div>
    <div class="lp-in">
      <span class="lp-eyebrow lp-fade">${esc(brandName)}</span>
      <h1 class="lp-title lp-fade d1" id="lp-title">Tu próxima casa empieza acá</h1>
      <p class="lp-sub lp-fade d2">Alquilá, comprá o vendé propiedades. Inmobiliarias, propietarios e inquilinos, en un solo lugar.</p>
      <div class="lp-cta lp-fade d3">
        <a class="btn" href="/buscar">Buscar propiedades</a>
        <button class="btn ghost" type="button" data-near style="color:#fdf8ef;border-color:rgba(255,255,255,.4)">📍 Cerca de mí</button>
        <a class="btn ghost" style="color:#fdf8ef;border-color:rgba(255,255,255,.4)" href="${esc(login)}">Publicá tu propiedad</a>
      </div>
    </div>
  </section>

  <section class="lp-sec">
    <h2>¿Qué estás buscando?</h2>
    <div class="lp-cards">
      ${intentCard('/buscar?op=alquiler', '🔑', 'Alquilar', 'Encontrá dónde vivir, permanente o temporario', 'Encontrá dónde vivir')}
      ${intentCard('/buscar?op=venta', '🏡', 'Comprar', 'Invertí o mudate a tu próxima casa', 'Comprá con confianza')}
      ${intentCard(login, '📈', 'Vender / Publicar', 'Publicá tu propiedad y llegá a miles', 'Publicá y llegá a miles')}
    </div>
    <form class="lp-search" method="get" action="/buscar">
      <select name="op"><option value="">Cualquier operación</option><option value="alquiler">Alquiler</option><option value="venta">Venta</option><option value="temporario">Temporario</option></select>
      <input name="ciudad" placeholder="¿En qué ciudad?">
      <button class="btn" type="submit">Buscar</button>
      <button class="btn ghost" type="button" data-near>📍 Cerca de mí</button>
    </form>
  </section>

  <section class="lp-human">
    <div>
      <h2>Detrás de cada casa, hay personas</h2>
      <p>Ayudamos a familias a encontrar su lugar, a propietarios a alquilar y vender sin vueltas, y a inmobiliarias a llevar todo su negocio en un solo lugar.</p>
      <div class="lp-cta"><a class="btn" href="/buscar">Explorar propiedades</a></div>
    </div>
    <div class="lp-human-imgs">
      <img src="/media/site/interior.jpg" alt="Living cálido de un hogar" loading="lazy">
      <img src="/media/site/keys.jpg" alt="Llaves de una nueva casa" loading="lazy">
    </div>
  </section>

  <section class="lp-sec"><div class="section-h"><h2>Propiedades destacadas</h2><a href="/buscar">Ver todas →</a></div>${cards}</section>

  <section class="lp-account">
    <div>
      <b>¿Ya tenés cuenta?</b>
      <p>Ingresá para gestionar o publicar. ¿Primera vez? Creá tu cuenta gratis con Google.</p>
    </div>
    <div class="lp-cta">
      <a class="btn" href="${esc(login)}">Ingresar</a>
      <a class="btn ghost" href="${esc(login)}">Crear cuenta</a>
    </div>
  </section>

  <section class="lp-steps">
    <div class="lp-step"><span class="n">01</span><b>Buscá o publicá</b><span>Filtrá por operación, ciudad y precio, o subí tu propiedad con fotos.</span></div>
    <div class="lp-step"><span class="n">02</span><b>Conectá</b><span>Contactá al publicante por WhatsApp y coordiná una visita.</span></div>
    <div class="lp-step"><span class="n">03</span><b>Cerrá el trato</b><span>Inmobiliarias gestionan todo; propietarios venden o alquilan directo.</span></div>
  </section>
  <script>${LP_SCRIPT}</script>`;
}
