'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const fecha = f => { const p = String(f).split('-'); return p.length === 3 ? `${+p[2]} de ${MES[+p[1] - 1]} de ${p[0]}` : f; };
const iniciales = n => esc(String(n).split(' ').map(w => w[0]).slice(0, 2).join(''));

// Si falta una foto en /img, se queda el recuadro de relleno
document.querySelectorAll('.phi img').forEach(i => i.addEventListener('error', () => i.remove()));

// Menú de móvil
const links = [['#historia', 'Historia'], ['#hermandad', 'Hermandad'], ['#cuaresma', 'Cuaresma'], ['#hermanas', 'Hermanas'], ['/noticias/', 'Noticias'], ['/zona/', 'Zona hermana']];
function menu(abrir) {
  $('#mn').innerHTML = abrir ? `<div class="sc" data-c="1"></div><div class="mn"><button class="x" data-c="1" aria-label="Cerrar">✕</button>${links.map(([h, t]) => `<a href="${h}">${t}</a>`).join('')}</div>` : '';
}
$('#hb').addEventListener('click', () => menu(true));
document.addEventListener('click', e => { if (e.target.closest('[data-c]') || e.target.closest('.mn a')) menu(false); });

// Datos que se editan desde la zona hermana
fetch('/api/public').then(r => r.json()).then(d => {
  $('#hitos').innerHTML = d.hitos.map(h => `<div><b>${esc(h.anio)}</b><br>${esc(h.texto)}</div>`).join('');
  if (d.hermanas.length) {
    $('#hermanas-l').innerHTML = d.hermanas.map(h => `<div class="card" style="text-align:center;padding:22px 14px"><div class="av">${h.foto ? `<img src="/media/${h.foto}" alt="${esc(h.nombre)}" loading="lazy">` : iniciales(h.nombre)}</div><b>${esc(h.nombre)}</b><br><span class="mu">${esc(h.cargo || 'Hermana')}</span>${h.anio ? `<br><small class="mu">En el cuartel desde ${h.anio}</small>` : ''}</div>`).join('');
  } else $('#hermanas').remove();
  $('#noticias-l').innerHTML = d.noticias.length
    ? d.noticias.map(n => `<div class="card news"><div class="ph">${n.imagen ? `<img src="/media/${n.imagen}" alt="" loading="lazy">` : 'Crónica'}</div><div class="t"><small class="mu">${esc(fecha(n.fecha))}</small><h3>${esc(n.titulo)}</h3><p class="mu" style="margin:0">${esc(n.texto)}</p>${n.url ? `<a class="btn" href="${esc(n.url)}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;margin-top:14px">Ver publicación original ↗</a>` : ''} </div></div>`).join('')
    : '<p class="mu">Pronto publicaremos aquí las crónicas de nuestros sábados.</p>';
}).catch(() => { $('#noticias-l').innerHTML = '<p class="mu">No se han podido cargar las noticias ahora mismo.</p>'; });
