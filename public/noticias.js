'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const fecha = f => { const p=String(f || '').split('-'); return p.length===3 ? p[2].replace(/^0/,'')+' de '+meses[+p[1]-1]+' de '+p[0] : (f || ''); };
const resumen = t => { const s=String(t || '').replace(/\s+/g,' ').trim(); return s.length>185 ? s.slice(0,182).trimEnd()+'…' : s; };
const menu = abrir => {
  $('#mn').innerHTML = abrir ? '<div class="sc" data-c="1"></div><div class="mn"><button class="x" data-c="1" aria-label="Cerrar">✕</button><a href="/">Inicio</a><a href="/historia/">Historia</a><a href="/noticias/">Noticias</a><a href="/zona/">Zona hermana</a></div>' : '';
};
$('#hb').addEventListener('click',()=>menu(true));
document.addEventListener('click',e=>{if(e.target.closest('[data-c]')||e.target.closest('.mn a'))menu(false);});
fetch('/api/noticias').then(r=>{if(!r.ok)throw new Error('No se han podido cargar las noticias');return r.json();}).then(items=>{
 const root=$('#news-archive');
 if(!items.length){root.innerHTML='<p class="empty-news">Todavía no hay noticias publicadas. Pronto compartiremos aquí nuevas crónicas y recuerdos.</p>';return;}
 root.innerHTML=items.map(n=>'<a class="card news-card" href="/noticias/'+encodeURIComponent(n.id)+'/"><div class="cover">'+(n.imagen?'<img src="/media/'+encodeURIComponent(n.imagen)+'" alt="'+esc(n.titulo)+'" loading="lazy">':'Las Tribulaciones de Sara')+'</div><div class="body"><time datetime="'+esc(n.fecha)+'">'+esc(fecha(n.fecha))+'</time><h2>'+esc(n.titulo)+'</h2><p>'+esc(resumen(n.texto))+'</p><span class="read">Leer noticia completa →</span></div></a>').join('');
}).catch(()=>{$('#news-archive').innerHTML='<p class="empty-news">No se han podido cargar las noticias en este momento. Vuelve a intentarlo más tarde.</p>';});
