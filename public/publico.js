'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const fecha = f => { const p = String(f).split('-'); return p.length === 3 ? `${+p[2]} de ${MES[+p[1] - 1]} de ${p[0]}` : f; };
const iniciales = n => esc(String(n).split(' ').map(w => w[0]).slice(0, 2).join(''));

// Si falta una foto en /img, se queda el recuadro de relleno
document.querySelectorAll('.phi img').forEach(i => i.addEventListener('error', () => i.remove()));

const menuItems = [
  { label:'Inicio', href:'/' },
  { group:'Historia', items:[['Nuestra historia','/historia/'],['Hermandad','/#hermandad']] },
  { label:'Cuaresma', href:'/#cuaresma' },
  { group:'Publicaciones', items:[['Noticias','/noticias/'],['Crónicas','/cronicas/']] },
  { label:'Zona hermana', href:'/zona/' }
];
function menu(abrir) {
  $('#mn').innerHTML = abrir ? `<div class="sc" data-c="1"></div><div class="mn"><button class="x" data-c="1" aria-label="Cerrar">✕</button>${menuItems.map(x => x.group ? `<div class="mn-group"><span>${x.group}</span>${x.items.map(([label,href])=>`<a href="${href}">${label}</a>`).join('')}</div>` : `<a class="mn-main" href="${x.href}">${x.label}</a>`).join('')}</div>` : '';
}
$('#hb').addEventListener('click', () => menu(true));
document.addEventListener('click', e => { if (e.target.closest('[data-c]') || e.target.closest('.mn a')) menu(false); });
document.querySelectorAll('.nav-trigger').forEach(button => button.addEventListener('click', e => {
  e.stopPropagation();
  const item = button.closest('.nav-drop');
  const open = !item.classList.contains('open');
  document.querySelectorAll('.nav-drop.open').forEach(x => { x.classList.remove('open'); x.querySelector('.nav-trigger')?.setAttribute('aria-expanded','false'); });
  item.classList.toggle('open', open);
  button.setAttribute('aria-expanded', String(open));
}));
document.addEventListener('click', e => { if (!e.target.closest('.nav-drop')) document.querySelectorAll('.nav-drop.open').forEach(x => { x.classList.remove('open'); x.querySelector('.nav-trigger')?.setAttribute('aria-expanded','false'); }); });
document.addEventListener('keydown', e => { if(e.key==='Escape') document.querySelectorAll('.nav-drop.open').forEach(x => { x.classList.remove('open'); x.querySelector('.nav-trigger')?.setAttribute('aria-expanded','false'); }); });

// Datos que se editan desde la zona hermana
fetch('/api/public').then(r => r.json()).then(d => {
  const hitos = $('#hitos');
  if (hitos) hitos.innerHTML = (d.hitos || []).map(h => `<div><b>${esc(h.anio)}</b><br>${esc(h.texto)}</div>`).join('');
  if (d.hermanas.length) {
    $('#hermanas-l').innerHTML = d.hermanas.map(h => `<div class="card" style="text-align:center;padding:22px 14px"><div class="av">${h.foto ? `<img src="/media/${h.foto}" alt="${esc(h.nombre)}" loading="lazy">` : iniciales(h.nombre)}</div><b>${esc(h.nombre)}</b><br><span class="mu">${esc(h.cargo || 'Hermana')}</span>${h.anio ? `<br><small class="mu">En el cuartel desde ${h.anio}</small>` : ''}</div>`).join('');
  } else $('#hermanas-l').innerHTML = '<p class="mu">Estamos preparando este espacio. Las hermanas que tengan activada la opción «Aparece en la web» se mostrarán aquí.</p>';
  const publicaciones = (d.noticias || []).slice(0, 3);
  $('#noticias-l').innerHTML = publicaciones.length
    ? publicaciones.map(n => `<article class="home-news-card">
        <a class="home-news-photo" href="/${n.tipo==='cronica'?'cronicas':'noticias'}/${n.id}/" aria-label="Leer ${esc(n.titulo)}">
          ${n.imagen ? `<img src="/media/${n.imagen}" alt="" loading="lazy">` : `<span class="home-news-placeholder">${n.tipo==='cronica'?'Crónica de Cuaresma':'Actualidad del cuartel'}</span>`}
        </a>
        <div class="home-news-body">
          <small class="home-news-meta">${n.tipo==='cronica'?'CRÓNICA':'NOTICIA'} <span>·</span> ${esc(fecha(n.fecha))}</small>
          <h3>${esc(n.titulo)}</h3>
          <p>${esc(String(n.texto || '').replace(/\s+/g,' ').trim().slice(0,165))}${String(n.texto || '').trim().length>165?'…':''}</p>
          <div class="home-news-actions">
            <a class="home-news-read" href="/${n.tipo==='cronica'?'cronicas':'noticias'}/${n.id}/">Leer ${n.tipo==='cronica'?'crónica':'noticia'}</a>
            ${n.url ? `<a class="home-news-original" href="${esc(n.url)}" target="_blank" rel="noopener noreferrer">Ver publicación original ↗</a>` : ''}
          </div>
        </div>
      </article>`).join('')
    : '<p class="mu">Pronto publicaremos aquí las crónicas de nuestros sábados.</p>';
}).catch(() => { $('#noticias-l').innerHTML = '<p class="mu">No se han podido cargar las noticias ahora mismo.</p>'; });
