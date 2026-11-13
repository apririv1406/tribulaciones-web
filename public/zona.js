'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const iniciales = n => esc(String(n).split(' ').map(w => w[0]).slice(0, 2).join(''));
const fechaHoyLocal = () => { const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,10); };
const GSVG = '<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.600 2.400 30.200 0 24 0 14.600 0 6.500 5.400 2.600 13.200l7.800 6.100C12.300 13.600 17.700 9.500 24 9.500z"/><path fill="#4285F4" d="M46.500 24.500c0-1.600-.1-3.100-.4-4.500H24v9h12.700c-.6 3-2.300 5.500-4.800 7.200l7.500 5.800c4.400-4.100 7.100-10.100 7.100-17.500z"/><path fill="#FBBC05" d="M10.400 28.700A14.500 14.500 0 0 1 9.500 24c0-1.600.3-3.200.9-4.700l-7.800-6.100A24 24 0 0 0 0 24c0 3.900.9 7.500 2.600 10.800l7.800-6.100z"/><path fill="#34A853" d="M24 48c6.500 0 11.900-2.100 15.900-5.800l-7.500-5.800c-2.100 1.400-4.800 2.300-8.400 2.300-6.300 0-11.700-4.100-13.600-9.800l-7.800 6.100C6.500 42.600 14.600 48 24 48z"/></svg>';
let CAL_MES = new Date(new Date().getFullYear(), new Date().getMonth(), 1), ME = null, ME_REAL = null, VISTA_HERMANA = false, NOTICIA_EDITANDO = null, MENU = false, LAST = '', PAGO_MODAL = false, SAB_TAB = 'prox', CUENTA_TAB = 'deb', COCINA_TAB = 'mis', TES_TAB = 'res', TES_CFG_TAB = 'pre', TES_REC_TAB = 'mes', TES_REPORT_FROM = fechaHoyLocal().slice(0,7) + '-01', TES_REPORT_TO = fechaHoyLocal(), TES_IMPORT_FILE = '', TES_NEW_FIXED_MODAL = false, TES_MOV_MODAL = false, TES_TRANSFER_MODAL = false, ADMIN_HERM_TAB = 'her', ACTAS_TAB = 'conv', COCINA_SORTEO_RESULTADO = [], TES_FILTRO = { tipo:'todos', desde:'', hasta:'', texto:'', cuenta:'', hermana:'', anio:'', categoria:'' };

async function api(method, path, body) {
  const r = await fetch('/api' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' }, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || 'Ha ocurrido un error'), { status: r.status });
  return d;
}
function mostrarPopup(titulo, contenido, err = false) {
  let modal = document.getElementById('lts-popup');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'lts-popup';
  modal.className = 'lts-popup-backdrop';
  modal.innerHTML = `<section class="lts-popup ${err ? 'is-error' : 'is-success'}" role="dialog" aria-modal="true" aria-labelledby="lts-popup-title">
    <button type="button" class="lts-popup-close" aria-label="Cerrar">×</button>
    <div class="lts-popup-mark">${err ? '!' : '✓'}</div>
    <h3 id="lts-popup-title">${esc(titulo)}</h3>
    <div class="lts-popup-content">${contenido}</div>
    <button type="button" class="btn lts-popup-ok">Aceptar</button>
  </section>`;
  document.body.appendChild(modal);
  let escapePopup;
  const cerrar = () => {
    modal.remove();
    if (escapePopup) document.removeEventListener('keydown', escapePopup);
  };
  modal.querySelector('.lts-popup-close').addEventListener('click', cerrar);
  modal.querySelector('.lts-popup-ok').addEventListener('click', cerrar);
  modal.addEventListener('click', e => { if (e.target === modal) cerrar(); });
  escapePopup = e => { if (e.key === 'Escape' && document.getElementById('lts-popup') === modal) cerrar(); };
  document.addEventListener('keydown', escapePopup);
  modal.querySelector('.lts-popup-ok').focus();
}

function confirmarAccion(mensaje, textoBoton = 'Confirmar') {
  return new Promise(resolve => {
    const anterior = document.getElementById('lts-popup');
    if (anterior) anterior.remove();
    const modal = document.createElement('div');
    modal.id = 'lts-popup';
    modal.className = 'lts-popup-backdrop';
    modal.innerHTML = `<section class="lts-popup lts-popup-question" role="dialog" aria-modal="true" aria-labelledby="lts-popup-title">
      <button type="button" class="lts-popup-close" aria-label="Cerrar">×</button>
      <div class="lts-popup-mark">?</div>
      <h3 id="lts-popup-title">¿Quieres continuar?</h3>
      <div class="lts-popup-content"><p>${esc(mensaje)}</p></div>
      <div class="lts-popup-actions">
        <button type="button" class="chip lts-popup-cancel">Cancelar</button>
        <button type="button" class="btn lts-popup-accept">${esc(textoBoton)}</button>
      </div>
    </section>`;
    document.body.appendChild(modal);
    let resuelta = false;
    const cerrar = valor => {
      if (resuelta) return;
      resuelta = true;
      modal.remove();
      document.removeEventListener('keydown', tecla);
      resolve(valor);
    };
    const tecla = e => { if (e.key === 'Escape' && document.getElementById('lts-popup') === modal) cerrar(false); };
    modal.querySelector('.lts-popup-close').addEventListener('click', () => cerrar(false));
    modal.querySelector('.lts-popup-cancel').addEventListener('click', () => cerrar(false));
    modal.querySelector('.lts-popup-accept').addEventListener('click', () => cerrar(true));
    modal.addEventListener('click', e => { if (e.target === modal) cerrar(false); });
    document.addEventListener('keydown', tecla);
    modal.querySelector('.lts-popup-cancel').focus();
  });
}

function toast(msg, err) {
  const texto = String(msg || '');
  const esGuardado = /\b(guardad[oa]s?|actualizad[oa]s?|registrad[oa]s?|cread[oa]s?|añadid[oa]s?|cambiad[oa]s?)\b/i.test(texto);
  const titulo = err ? 'No se ha podido completar' : (esGuardado ? 'GUARDADO CORRECTAMENTE' : 'OPERACIÓN COMPLETADA');
  mostrarPopup(titulo, '<p>' + esc(msg) + '</p>', !!err);
}
function reducir(file, max, q = 0.82) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onerror = () => rej(new Error('No se puede leer esa imagen'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', q));
      };
      img.onerror = () => rej(new Error('No se puede leer esa imagen'));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ---------- estructura ---------- */
const menuGroups = () => {
  if (!ME) return [];
  const admin = !!ME_REAL?.admin && !VISTA_HERMANA;
  const groups = [
    { title: 'Inicio', links: [['#/', 'Resumen']] },
    { title: 'Gestión', links: [['#/calendario', 'Calendario'], ['#/sabados', 'Sábados y asistencia'], ['#/cocina', 'Cocina'], ...(admin ? [['#/admin/eventos', 'Otros eventos']] : []), ] },
  ];
  if (admin) groups.push({ title: 'Hermanas', links: [['#/admin/hermanas', 'Hermanas y cargos']] });
  if (ME.tes || admin) groups.push({ title: 'Economía', links: [['#/tesoreria', 'Tesorería y cuotas']] });
  groups.push({ title: 'Secretaría', links: [[admin ? '#/admin/actas' : '#/actas', 'Actas y juntas']] });
  if (admin) groups.push({ title: 'Comunicación', links: [['#/admin/noticias', 'Publicaciones'], ['#/admin/historia', 'Historia']] });
  groups.push({ title: 'Mi espacio', links: [['#/cuenta', 'Mi cuenta'], ['#/perfil', 'Mi perfil']] });
  return groups;
};
const items = () => menuGroups().flatMap(g => g.links);
function aplicarVista() {
  if (!ME_REAL) { ME = null; return; }
  ME = VISTA_HERMANA ? { ...ME_REAL, admin: false, tes: ME_REAL.cargo_permiso === 'tes', actas: ME_REAL.cargo_permiso === 'actas' } : { ...ME_REAL };
}
function shell(html) {
  LAST = html;
  const cur = location.hash || '#/', groups = menuGroups();
  const active = links => links.some(([h]) => h === '#/' ? cur === '#/' || cur === '' : cur.startsWith(h));
  const dropdowns = groups.filter(g => g.title !== 'Inicio').map(g => `<div class="nav-drop ${active(g.links)?'active':''}"><button class="nav-trigger" type="button">${g.title}<span>⌄</span></button><div class="nav-menu">${g.links.map(([h,t])=>`<a class="${cur===h?'on':''}" href="${h}">${t}</a>`).join('')}</div></div>`).join('');
  $('#nav').innerHTML = `<a class="logo" href="/"><img src="/logo.png" alt="Las Tribulaciones de Sara"></a><a class="dk ${cur==='#/'?'on':''}" href="#/">Inicio</a>` + dropdowns + `<a class="dk nav-public" href="/">Web pública</a>` + (ME_REAL?.admin ? `<button class="cta dk" type="button" data-a="cambiar-vista">${VISTA_HERMANA?'Vista administradora':'Ver como hermana'}</button>` : '') + (ME ? `<a class="cta dk" href="#/" data-a="salir">Salir</a>` : '') + `<button class="hb" data-a="menu" aria-label="Menú"><i></i><i></i><i></i></button>`;
  const drawer = groups.map(g => `<section class="mn-group"><span>${g.title}</span>${g.links.map(([h,t])=>`<a href="${h}" class="${cur===h?'current':''}" ${cur===h?'aria-current="page"':''}>${t}<span aria-hidden="true">›</span></a>`).join('')}</section>`).join('');
  const fotoMenu = ME?.foto_id ? `<img src="/media/${Number(ME.foto_id)}" alt="">` : `<span>${esc(iniciales(ME?.nombre || 'Hermana'))}</span>`;
  $('#mn').innerHTML = MENU ? `<div class="sc" data-a="menu"></div><aside class="mn" aria-label="Menú de navegación">
    <div class="mn-head"><a href="#/perfil" class="mn-user">${fotoMenu}<span><b>${esc(ME?.nombre || 'Hermana')}</b><small>${esc(ME?.cargo || 'Zona hermana')}</small></span></a><button class="x" data-a="menu" aria-label="Cerrar menú">×</button></div>
    <div class="mn-scroll">${drawer}
      <section class="mn-extra"><a href="/">Web pública <span>↗</span></a></section>
    </div>
    <div class="mn-footer">${ME_REAL?.admin?`<button type="button" class="mn-switch" data-a="cambiar-vista">${VISTA_HERMANA?'Volver a vista administradora':'Ver como hermana'}</button>`:'' }${ME?'<button type="button" class="mn-logout" data-a="salir">Cerrar sesión</button>':''}</div>
  </aside>` : '';
  const bottom=$('#bottom-nav');
  if(bottom) bottom.style.display = MENU ? 'none' : '';
  if(bottom && ME_REAL?.admin && !VISTA_HERMANA) bottom.innerHTML = `<nav class="admin-bottom-nav"><a class="${cur==='#/'?'on':''}" href="#/"><span>⌂</span>Inicio</a><a class="${cur.startsWith('#/admin/hermanas')?'on':''}" href="#/admin/hermanas"><span>♙</span>Hermanas</a><a class="${cur.startsWith('#/tesoreria')?'on':''}" href="#/tesoreria"><span>€</span>Economía</a><a class="${cur.startsWith('#/admin/actas')||cur==='#/actas'?'on':''}" href="#/admin/actas"><span>▤</span>Secretaría</a><button type="button" data-a="menu"><span>☰</span>Más</button></nav>`;
  else if(bottom && ME) bottom.innerHTML = `<nav class="admin-bottom-nav sister-bottom-nav"><a class="${cur==='#/'?'on':''}" href="#/"><span>⌂</span>Inicio</a><a class="${cur==='#/sabados'||cur==='#/cocina'?'on':''}" href="#/sabados"><span>◷</span>Gestión</a><a class="${cur==='#/cuenta'||cur==='#/tesoreria'?'on':''}" href="#/cuenta"><span>€</span>Mi cuenta</a><a class="${cur==='#/actas'||cur==='#/admin/actas'?'on':''}" href="#/actas"><span>▤</span>Actas</a><button type="button" data-a="menu"><span>☰</span>Más</button></nav>`;
  else if(bottom) bottom.innerHTML = '';
  $('#app').innerHTML = html;
}
const subnav = (mod, actual, opciones) => `<div class="sub" style="margin:16px 0 20px">${opciones.map(([k,l])=>`<button type="button" class="${actual===k?'on':''}" data-a="module-tab" data-module="${mod}" data-tab="${k}">${l}</button>`).join('')}</div>`;
const campo = (n, t, extra = '') => `<label class="fl" style="text-align:left">${t}</label><input class="t" name="${n}" ${extra}>`;

/* ---------- acceso ---------- */
const ERR = { google: 'No se ha podido entrar con Google. Inténtalo de nuevo o usa tu correo y contraseña.', 'no-registrada': 'Ese correo de Google no está registrado en el cuartel. Pide a la administradora que lo añada.' };
function vLogin(err) {
  shell(`<div class="login"><div class="card"><img src="/logo.png" alt="" style="height:110px"><h2 style="margin-top:6px">Zona hermana</h2>${err ? `<p style="color:var(--ko);font-size:14px">${esc(ERR[err] || 'No se ha podido entrar.')}</p>` : ''}
<form data-f="login">${campo('email', 'Correo', 'type="email" required autocomplete="username"')}${campo('password', 'Contraseña', 'type="password" required autocomplete="current-password"')}<button class="btn" style="width:100%;margin-top:16px">Entrar</button></form>
<p style="margin:12px 0 0"><a href="#/olvido" style="color:var(--br);font-size:14px">He olvidado mi contraseña</a></p><div class="or">o</div><a class="g" href="/api/auth/google">${GSVG}Continuar con Google</a>
<p class="mu" style="font-size:13px;margin:16px 0 0">¿Primer acceso? Usa el enlace de bienvenida que te ha enviado la administradora por correo electrónico.</p></div></div>`);
}
function vOlvido() {
  shell(`<div class="login"><div class="card"><img src="/logo.png" alt="" style="height:90px"><h2 style="margin-top:6px">¿Olvidaste tu contraseña?</h2><p class="mu">Para crear una contraseña nueva, ponte en contacto con la administradora del cuartel. Te enviará un enlace personal por correo electrónico.</p><p style="margin:18px 0 0"><a class="btn" href="#/">Volver a entrar</a></p></div></div>`);
}
function vClave(tok) {
  shell(`<div class="login"><div class="card"><img src="/logo.png" alt="" style="height:90px"><div class="tag" style="margin-top:6px">Contraseña</div><h2>Crea tu contraseña</h2><p class="mu">Elige una contraseña para entrar a la Zona hermana. Mínimo 8 caracteres.</p><form data-f="clave" data-t="${esc(tok)}">${campo('p1', 'Contraseña', 'type="password" required minlength="8" autocomplete="new-password"')}${campo('p2', 'Repite la contraseña', 'type="password" required minlength="8" autocomplete="new-password"')}<button class="btn" style="width:100%;margin-top:16px">Guardar y entrar</button></form></div></div>`);
}
function vSetup() {
  shell(`<div class="login"><div class="card"><img src="/logo.png" alt="" style="height:90px"><div class="tag" style="margin-top:6px">Instalación</div><h2>Primer acceso de la administradora</h2><p class="mu">Escribe la clave de instalación (SETUP_KEY) y elige tu contraseña.</p><form data-f="setup">${campo('key', 'Clave de instalación', 'type="password" required')}${campo('p1', 'Tu contraseña', 'type="password" required minlength="8" autocomplete="new-password"')}<button class="btn" style="width:100%;margin-top:16px">Crear mi cuenta</button></form></div></div>`);
}

/* ---------- zona ---------- */
async function vInicio() {
  const nombre = esc((ME.nombre || '').split(' ')[0] || 'hermana');
  const resultados = await Promise.allSettled([
    api('GET', '/modulos/sabados'),
    api('GET', '/modulos/cuenta'),
    api('GET', '/modulos/eventos')
  ]);
  const sabados = resultados[0].status === 'fulfilled' ? resultados[0].value : [];
  const cuenta = resultados[1].status === 'fulfilled' ? resultados[1].value : null;
  const eventos = resultados[2].status === 'fulfilled' ? resultados[2].value : [];
  const proximosEventos=eventos.filter(x=>x.estado==='publicado'&&x.fecha>=fechaISOlocal(new Date())).sort((a,b)=>a.fecha.localeCompare(b.fecha)).slice(0,5);
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const siguiente = sabados.filter(s => s.estado !== 'cancelado' && new Date(s.fecha + 'T12:00:00') >= hoy).sort((a,b) => a.fecha.localeCompare(b.fecha))[0];
  const fechaSiguiente = siguiente ? new Date(siguiente.fecha + 'T12:00:00').toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'}) : '';
  const asistencia = siguiente ? (siguiente.mi_asistencia == null ? 'Aún no has confirmado tu asistencia' : Number(siguiente.mi_asistencia) === 1 ? 'Has confirmado que vas' : 'Has indicado que no asistirás') : '';
  const cuotasPendientes = cuenta ? (cuenta.cuotas || []).filter(c => c.estado !== 'pagada').reduce((a,c) => a + Number(c.restante_centimos || 0),0) : null;
  const cargosPendientes = cuenta ? (cuenta.cargos || []).reduce((a,c) => a + Number(c.restante_centimos || 0),0) : 0;
  const pagosRevision = cuenta ? (cuenta.pagos || []).filter(p => p.estado === 'pendiente').reduce((a,p) => a + Number(p.importe_centimos || 0),0) : 0;
  const deuda = cuenta ? Math.max(0,cuotasPendientes + cargosPendientes - pagosRevision) : null;
  const mod = (t, d, href, etiqueta, icono) => `<a class="sister-module" href="${href}"><span class="sister-module-icon" aria-hidden="true">${icono}</span><span class="sister-module-copy"><small>${etiqueta}</small><b>${t}</b><span>${d}</span></span><span class="sister-module-arrow" aria-hidden="true">→</span></a>`;
  shell(`<div class="sister-home">
    <section class="hero2 sister-welcome">
      <div class="tag" style="color:var(--go)">LAS TRIBULACIONES DE SARA</div>
      <h2 style="color:#fff;margin:7px 0 4px">¡Hola, ${nombre}!</h2>
      <p class="sister-welcome-sub">${esc(ME.cargo || 'Hermana')}</p>
      <p class="sister-welcome-note">Tu espacio para estar al día con el cuartel.</p>
    </section>
    ${proximosEventos.length?`<section class="home-events"><div class="home-events-head"><div><div class="tag">AGENDA DE LA HERMANDAD</div><h2>Próximos eventos</h2></div><a href="#/calendario">Ver calendario →</a></div>${proximosEventos.map(ev=>`<a class="home-event-row" href="#/calendario"><span class="home-event-date"><b>${new Date(ev.fecha+'T12:00:00').getDate()}</b><small>${new Date(ev.fecha+'T12:00:00').toLocaleDateString('es-ES',{month:'short'}).replace('.','')}</small></span><span class="home-event-copy"><b>${esc(ev.titulo)}</b><small>${esc([({cofradia:'Acto de cofradía',cruz_mayo:'Cruz de Mayo',cultos:'Cultos',convivencia:'Convivencia',otros:'Evento'})[ev.tipo]||'Evento',fechaBonita(ev.fecha),ev.hora,ev.lugar].filter(Boolean).join(' · '))}</small></span><span class="home-event-arrow">→</span></a>`).join('')}</section>`:''}
    <section class="sister-home-status" aria-label="Tu información">
      <article class="sister-status-card">
        <div class="sister-status-heading"><span class="sister-status-icon">◷</span><span>PRÓXIMO SÁBADO</span></div>
        ${siguiente ? `<b class="sister-status-main">${esc(siguiente.titulo || 'Sábado de cuartel')}</b><span class="sister-status-detail">${esc(fechaSiguiente)}${siguiente.hora ? ' · ' + esc(siguiente.hora) : ''}</span><span class="sister-status-state">${esc(asistencia)}</span>` : '<b class="sister-status-main">Sin sábados programados</b><span class="sister-status-detail">Cuando se publique el próximo, aparecerá aquí.</span>'}
        <a href="#/sabados" class="sister-status-link">${siguiente ? 'Ver sábado y asistencia' : 'Consultar sábados'} <span>→</span></a>
      </article>
      <article class="sister-status-card">
        <div class="sister-status-heading"><span class="sister-status-icon">€</span><span>MI CUENTA</span></div>
        ${cuenta ? `<b class="sister-status-main sister-status-money">${euros(deuda)}</b><span class="sister-status-detail">Pendiente de pago</span>${pagosRevision ? '<span class="sister-status-state">' + euros(pagosRevision) + ' en revisión por Tesorería</span>' : '<span class="sister-status-state">' + (deuda > 0 ? 'Consulta el desglose de tus cuotas' : 'No tienes importes pendientes') + '</span>'}` : '<b class="sister-status-main">Consulta tu cuenta</b><span class="sister-status-detail">Revisa tus cuotas y tus pagos.</span>'}
        <a href="#/cuenta" class="sister-status-link">Ir a mi cuenta <span>→</span></a>
      </article>
    </section>
    ${ME.admin ? `<section class="sister-admin-shortcut"><div><b>Administración del cuartel</b><span>Accede a las herramientas de gestión.</span></div><a class="btn" href="#/admin">Abrir panel</a></section>` : ''}
    <section class="sister-home-modules">
      <div class="tag">TU ESPACIO</div><h2>¿Qué necesitas hacer?</h2>
      <div class="sister-module-list">
        ${mod('Sábados y asistencia','Confirma tu asistencia y organiza tus invitadas.','#/sabados','ORGANIZACIÓN','◷')}
        ${mod('Mi cuenta','Consulta cuotas, registra pagos y revisa tu historial.','#/cuenta','TESORERÍA PERSONAL','€')}
        ${mod('Cocina','Consulta tus turnos, menús y la información del sábado.','#/cocina','CUARTEL','⌂')}
        ${mod('Actas y estatutos','Consulta convocatorias, actas y documentación.','#/actas','DOCUMENTACIÓN','▤')}
        ${ME.tes ? mod('Tesorería','Gestiona cuotas, ingresos, gastos e informes.','#/tesoreria','GESTIÓN ECONÓMICA','＋') : ''}
        ${ME.admin ? mod('Gestión de hermanas','Fichas, cargos, permisos y cuentas.','#/admin/hermanas','ADMINISTRACIÓN','♙') : ''}
      </div>
    </section>
    <div class="sister-home-footer"><a href="#/perfil">Mi perfil</a><span>·</span><a href="#/actas">Documentación del cuartel</a></div>
  </div>`);
}

const ALERGIAS_TAGS = ['Sin gluten (celiaquía)','Sin lactosa','Frutos secos','Marisco y pescado','Huevo','Vegetariana'];
const euros = n => (Number(n || 0) / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const fechaBonita = f => f ? new Date(`${f}T12:00:00`).toLocaleDateString('es-ES') : '—';
const readFileData = file => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(new Error('No se ha podido leer el archivo')); r.readAsDataURL(file); });

function fechaISOlocal(d) {
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function vCalendarioHTML(eventos) {
  const anio=CAL_MES.getFullYear(), mes=CAL_MES.getMonth();
  const inicio=new Date(anio,mes,1), dias=new Date(anio,mes+1,0).getDate();
  const offset=(inicio.getDay()+6)%7;
  const nombreMes=CAL_MES.toLocaleDateString('es-ES',{month:'long',year:'numeric'});
  const porFecha={};
  eventos.forEach(ev=>{(porFecha[ev.fecha] ||= []).push(ev);});
  const seleccion=CAL_SELECCION || fechaISOlocal(new Date());
  const celdas=[];
  for(let i=0;i<offset;i++) celdas.push('<div class="cal-empty" aria-hidden="true"></div>');
  for(let dia=1;dia<=dias;dia++){
    const fecha=fechaISOlocal(new Date(anio,mes,dia)), lista=porFecha[fecha]||[];
    celdas.push('<button type="button" class="cal-day '+(lista.length?'has-events':'')+(fecha===fechaISOlocal(new Date())?' today':'')+(fecha===seleccion?' selected':'')+'" data-a="cal-dia" data-fecha="'+fecha+'"><b class="cal-day-number">'+dia+'</b><span class="cal-day-dots">'+lista.slice(0,3).map(x=>'<i class="cal-dot '+x.tipo+'"></i>').join('')+'</span><span class="cal-day-labels">'+lista.slice(0,2).map(x=>'<i class="cal-mini-event '+x.tipo+'">'+esc(x.titulo)+'</i>').join('')+'</span>'+(lista.length>2?'<small>+'+(lista.length-2)+' más</small>':'')+'</button>');
  }
  const delDia=eventos.filter(x=>x.fecha===seleccion).sort((a,b)=>(a.hora||'').localeCompare(b.hora||''));
  const tituloDia=new Date(seleccion+'T12:00:00').toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
  return '<section class="calendar-wrap"><div class="calendar-head"><div><div class="tag">Agenda del cuartel</div><h2>Calendario</h2><p class="mu">Sábados, juntas, cocina y actos especiales en un mismo sitio.</p></div><div class="calendar-controls"><button class="chip" data-a="cal-prev" aria-label="Mes anterior">‹</button><b>'+esc(nombreMes.charAt(0).toLocaleUpperCase('es-ES')+nombreMes.slice(1))+'</b><button class="chip" data-a="cal-next" aria-label="Mes siguiente">›</button><button class="chip" data-a="cal-hoy">Hoy</button></div></div><div class="calendar-legend"><span><i class="cal-dot sabado"></i>Sábados</span><span><i class="cal-dot junta"></i>Juntas</span><span><i class="cal-dot cocina"></i>Cocina</span><span><i class="cal-dot evento"></i>Otros eventos</span></div><div class="calendar-grid calendar-weekdays">'+['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(x=>'<b>'+x+'</b>').join('')+'</div><div class="calendar-grid">'+celdas.join('')+'</div><section class="calendar-day-events"><div class="tag">Agenda del día</div><h3>'+esc(tituloDia)+'</h3>'+(delDia.length?delDia.map(ev=>'<article class="calendar-event"><i class="cal-dot '+ev.tipo+'"></i><div><b>'+esc(ev.titulo)+'</b><p>'+esc([ev.hora,ev.detalle,ev.estado].filter(Boolean).join(' · '))+'</p></div><span class="calendar-event-type">'+(ev.tipo==='sabado'?'Sábado':ev.tipo==='junta'?'Junta':ev.tipo==='cocina'?'Cocina':'Evento')+'</span></article>').join(''):'<p class="mu">No hay actividades registradas para este día.</p>')+'</section></section>';
}
let CAL_SELECCION = fechaISOlocal(new Date()), CAL_EVENTOS = [];
async function vCalendario() {
  const [sabados,juntas,cocina]=await Promise.all([
    api('GET','/modulos/sabados'),
    api('GET','/modulos/actas'),
    api('GET','/modulos/cocina')
  ]);
  const eventos=[];
  sabados.forEach(s=>eventos.push({fecha:s.fecha,tipo:'sabado',titulo:s.titulo||'Encuentro del cuartel',hora:s.hora||'',detalle:s.categoria||'Encuentro',estado:s.estado==='cancelado'?'Cancelado':''}));
  (juntas.juntas||[]).forEach(j=>eventos.push({fecha:j.fecha,tipo:'junta',titulo:j.lugar||'Junta del cuartel',hora:j.hora||'',detalle:j.convocatoria||'Convocatoria de junta',estado:j.estado||''}));
  (cocina.turnos||[]).forEach(t=>eventos.push({fecha:t.fecha,tipo:'cocina',titulo:t.turno||'Turno de cocina',hora:'',detalle:t.responsable||t.menu||'Organización de cocina',estado:''}));
  const especiales=await api('GET','/modulos/eventos');
  especiales.filter(x=>x.estado==='publicado').forEach(x=>eventos.push({fecha:x.fecha,tipo:'evento',titulo:x.titulo,hora:x.hora||'',detalle:[({cofradia:'Acto de cofradía',cruz_mayo:'Cruz de Mayo',cultos:'Cultos',convivencia:'Convivencia',otros:'Evento'})[x.tipo]||'Evento',x.lugar,x.descripcion].filter(Boolean).join(' · '),estado:''}));
  CAL_EVENTOS=eventos.filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x.fecha||''));
  return shell(vCalendarioHTML(CAL_EVENTOS));
}

async function vSabados() {
  const ss = await api('GET', '/modulos/sabados');
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const proximos = ss.filter(s => new Date(`${s.fecha}T12:00:00`) >= hoy).sort((a,b)=>a.fecha.localeCompare(b.fecha));
  const celebrados = ss.filter(s => new Date(`${s.fecha}T12:00:00`) < hoy).sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const siguiente = proximos[0];
  const precioSabado = Number(siguiente?.precio_sabado_centimos ?? 1000);
  const precioInvitada = Number(siguiente?.precio_invitada_centimos ?? 1000);
  const nombre = String(ME.nombre || '').split(' ')[0] || 'hermana';
  const limite = s => {
    const d = new Date(`${s.fecha}T12:00:00`);
    d.setDate(d.getDate()-2);
    d.setHours(23,0,0,0);
    return d;
  };
  const tags = (valor) => String(valor || '').split(/[,;\n]/).map(x=>x.trim()).filter(Boolean);
  const alergiasPersona = (s,tipo,numero) => (s.mis_alergias_personas || []).find(x=>x.persona_tipo===tipo && Number(x.persona_numero)===numero);
  const campoAlergias = (s,tipo,numero,titulo,oculto=false) => {
    const guardada = alergiasPersona(s,tipo,numero);
    const perfil = tipo==='hermana';
    const valores = tags(guardada ? guardada.alergias : (perfil ? s.mis_alergias : ''));
    const nota = guardada ? guardada.observaciones : (perfil ? s.mi_alergias_observaciones : '');
    const nombreCampo = tipo==='hermana' ? 'alergia_hermana_0' : 'alergia_invitada_'+numero;
    const nombreNota = tipo==='hermana' ? 'alergia_extra_hermana_0' : 'alergia_extra_invitada_'+numero;
    const guestAttr = tipo==='invitada' ? `data-guest-index="${numero}"` : '';
    const display = tipo==='invitada' && oculto ? 'none' : 'block';
    return `<div class="card" ${guestAttr} style="display:${display};padding:12px;margin-top:9px;background:var(--bg)">
      <b>${titulo}</b><div class="wr" style="margin:8px 0 4px">${ALERGIAS_TAGS.map(t=>`<label class="chip ${valores.includes(t)?'on':''}" style="display:inline-flex;align-items:center;gap:7px"><input type="checkbox" name="${nombreCampo}" value="${esc(t)}" ${valores.includes(t)?'checked':''}> ${esc(t)}</label>`).join('')}</div>
      <input class="t" name="${nombreNota}" placeholder="Otra alergia o aclaración (opcional)" value="${esc(nota || '')}">
    </div>`;
  };
  const tarjetas = lista => lista.map(s => {
    const fecha = new Date(`${s.fecha}T12:00:00`);
    const pasado = fecha < hoy;
    const abierto = s.estado === 'abierto';
    const puedeEditar = !pasado && abierto && (ME.admin || ME.tes || new Date() <= limite(s));
    const partes = String(s.fecha || '').split('-');
    const dia = partes.length === 3 ? partes[2] : '—';
    const mes = partes.length === 3 ? fecha.toLocaleDateString('es-ES',{month:'short'}).replace('.','') : '';
    const respondida = s.mi_asistencia !== null && s.mi_asistencia !== undefined;
    const asiste = Number(s.mi_asistencia) === 1;
    const invitadas = Math.max(0,Number(s.mis_acompanantes || 0));
    const plazas = Number(s.plazas_ocupadas ?? (Number(s.confirmadas||0)+Number(s.invitadas||0)));
    const importe = (asiste ? Number(s.precio_sabado_centimos ?? precioSabado) : 0) + invitadas*Number(s.precio_invitada_centimos ?? precioInvitada);
    const alergias = campoAlergias(s,'hermana',0,'Yo');
    const alergiasInvitadas = Array.from({length:20},(_,i)=>campoAlergias(s,'invitada',i+1,'Invitada '+(i+1),i+1>invitadas)).join('');
    return `<article class="card sab ${pasado ? 'past' : ''} ${s.id === siguiente?.id ? 'sab-featured' : ''}">
      <div class="date"><b>${esc(dia)}</b><span>${esc(mes)}</span></div>
      <div class="bd">
        <div class="sab-card-head"><h3>${esc(s.titulo)}</h3><div class="sab-status"><span class="pill ${puedeEditar?'ok':''}">${pasado?'Celebrado':s.estado==='cancelado'?'Cancelado':puedeEditar?'Confirmación abierta':'Plazo cerrado'}</span>${puedeEditar?'<small>Hasta el jueves · 23:00</small>':''}</div></div>
        <div class="menu sab-date-line">${fechaBonita(s.fecha)}${s.hora?' · '+esc(s.hora):''}</div>
        ${!pasado && abierto && puedeEditar ? `<form data-f="sabado-rsvp" data-id="${s.id}" data-plazas-otras="${Math.max(0,plazas-(s.mi_asistencia===1?1:0)-invitadas)}" data-precio-sabado="${Number(s.precio_sabado_centimos ?? precioSabado)}" data-precio-invitada="${Number(s.precio_invitada_centimos ?? precioInvitada)}" style="margin-top:10px">
          <div class="seg"><button type="button" class="${respondida && asiste?'y':''}" data-a="rsvp-choice" data-value="1" aria-pressed="${respondida && asiste}">Voy</button><button type="button" class="${respondida && !asiste?'n':''}" data-a="rsvp-choice" data-value="0" aria-pressed="${respondida && !asiste}">No voy</button></div>
          <input type="hidden" name="asiste" value="${respondida?(asiste?'1':'0'):''}">
          <div class="st" style="margin-top:12px"><span>Invitadas</span><button type="button" data-a="rsvp-invitadas-step" data-delta="-1" aria-label="Quitar invitada">−</button><b data-invitadas-count>${invitadas}</b><button type="button" data-a="rsvp-invitadas-step" data-delta="1" aria-label="Añadir invitada">+</button><input type="hidden" name="acompanantes" value="${invitadas}"></div>
          <details class="rsvp-allergies" style="margin-top:14px"><summary>Alergias o dietas <span>· Opcional</span></summary><p class="mu" style="margin:7px 0 9px">Indica las de cada persona, sin necesidad de poner nombres. Solo las verá el turno de cocina y la junta.</p>
          ${alergias}${alergiasInvitadas}</details>
          <label class="fl" style="margin-top:12px">Observaciones del sábado</label><textarea class="t" name="observaciones" rows="2">${esc(s.mi_observaciones || '')}</textarea>
          <div class="pay rsvp-pay" style="margin-top:12px"><span class="mu" data-rsvp-summary>${!respondida?'Selecciona si vas a asistir':asiste?'Asistencia confirmada':'Has indicado que no vas'}${invitadas?' · '+invitadas+' invitada(s) × '+euros(s.precio_invitada_centimos ?? precioInvitada):''}</span><b data-rsvp-total>${!respondida&&!invitadas?'—':euros(importe)}</b></div>
          <div class="meter" style="margin-top:12px"><i data-rsvp-seats-bar style="width:${Math.min(100,plazas/40*100)}%"></i></div><div class="menu" data-rsvp-seats-label>${plazas} de 40 plazas ocupadas</div>
          <button class="btn" style="margin-top:12px">Guardar asistencia</button>
        </form>` : pasado && s.mi_asistencia === 1 ? `<p class="mu" style="margin:12px 0 6px">Apunta las consumiciones que tomaste después del sábado.</p><form data-f="sabado-consumos" data-id="${s.id}"><div class="row"><div style="flex:1 1 130px">${campo('copas','Copas','type="number" min="0" max="50" value="'+(s.mis_copas || 0)+'"')}</div><div style="flex:1 1 130px">${campo('refrescos','Refrescos','type="number" min="0" max="50" value="'+(s.mis_refrescos || 0)+'"')}</div></div><button class="btn" style="margin-top:10px">Guardar consumiciones</button></form>` : pasado ? '<p class="mu" style="margin:12px 0 0">No confirmaste asistencia a este sábado.</p>' : s.estado==='cancelado' ? '<p class="mu" style="margin:14px 0 0">Este sábado ha sido cancelado.</p>' : '<p class="mu" style="margin:14px 0 0">El plazo de confirmación terminó el jueves a las 23:00.</p>'}
        ${ME.admin || ME.tes ? `<p style="margin:12px 0 0"><button class="chip" type="button" data-a="sabado-asistentes" data-id="${s.id}">Ver asistentes</button></p>` : ''}
      </div></article>`;
  }).join('');
  const cabecera = `<div class="top sabados-heading"><div class="tag">CUARTEL · SÁBADOS</div><h2>Hola, ${esc(nombre)}</h2><p class="mu" style="margin:0">Consulta los próximos encuentros y confirma tu asistencia antes del jueves a las 23:00.</p></div>`;
  const resumen = '';
  const alta = ME.admin || ME.tes ? `<details class="card" style="margin:16px 0"><summary class="chip">Gestionar sábados</summary><form data-f="sabado-new" style="margin-top:14px"><div class="row" style="align-items:flex-end"><div style="flex:1 1 150px">${campo('fecha','Fecha','type="date" required')}</div><div style="flex:1 1 120px">${campo('hora','Hora','type="time"')}</div><div style="flex:2 1 220px">${campo('titulo','Actividad','required maxlength="120"')}</div><div style="flex:1 1 150px"><label class="fl">Concepto de cobro</label><select class="t" name="categoria"><option>Cuaresma</option><option>Semana Santa</option><option>Otros</option></select></div></div><label class="fl">Información del encuentro</label><textarea class="t" name="descripcion" rows="2"></textarea><button class="btn" style="margin-top:10px">Publicar sábado</button></form></details>` : '';
  return shell(cabecera+resumen+alta+`<div class="sub s2"><button type="button" class="${SAB_TAB==='prox'?'on':''}" data-a="sabados-tab" data-tab="prox">Próximos sábados</button><button type="button" class="${SAB_TAB==='ant'?'on':''}" data-a="sabados-tab" data-tab="ant">Ya celebrados · apuntar bebidas</button></div><section class="sec" style="padding-top:12px">${SAB_TAB==='prox'?(tarjetas(proximos)||'<div class="card"><p class="mu" style="margin:0">No hay próximos sábados publicados.</p></div>'):(tarjetas(celebrados)||'<div class="card"><p class="mu" style="margin:0">Todavía no hay sábados celebrados.</p></div>')}</section>`);
}

async function vCuenta() {
  const d=await api('GET','/modulos/cuenta');
  const cargos=d.cargos||[];
  const pendientes=d.cuotas.filter(c=>c.estado!=='pagada');
  const deudaCuotas=pendientes.reduce((a,c)=>a+Number(c.restante_centimos||0),0);
  const deudaCargos=cargos.reduce((a,c)=>a+Number(c.restante_centimos||0),0);
  const totalPendiente=deudaCuotas+deudaCargos;
  const pendienteRevision=d.pagos.filter(p=>p.estado==='pendiente').reduce((a,p)=>a+Number(p.importe_centimos||0),0);
  const deudaTrasRevision=Math.max(0,totalPendiente-pendienteRevision);
  const TAGS=ALERGIAS_TAGS;
  const alergiasActuales=String(d.alergias?.alergias||'').split(/[,;\n]/).map(x=>x.trim()).filter(Boolean);
  const mes=p=>{const [y,m]=String(p||'').split('-');return m?new Date(Number(y),Number(m)-1,1).toLocaleDateString('es-ES',{month:'long',year:'numeric'}):p;};
  const estado=p=>p.estado==='confirmado'?'<span class="pill ok">Confirmado</span>':p.estado==='rechazado'?'<span class="pill">Rechazado</span>':'<span class="pill warn">Pendiente</span>';
  let contenido='';
  if(CUENTA_TAB==='deb') {
    const filasCuotas=pendientes.map(c=>`<div class="mv"><div class="x"><b>${esc(mes(c.periodo))}</b><br><small>${Number(c.importe_centimos/100).toFixed(0)} € de cuota mensual</small></div><div class="amt">${euros(c.restante_centimos)}</div></div>`).join('');
    const filasCargos=['Cuaresma','Semana Santa','Otros'].map(cat=>{
      const arr=cargos.filter(x=>x.categoria===cat&&x.restante_centimos>0);
      const total=arr.reduce((a,x)=>a+Number(x.restante_centimos),0);
      return `<div class="mv"><div class="x"><b>${cat}</b><br><small>${arr.length?arr.map(x=>esc(x.concepto)+' · '+euros(x.restante_centimos)).join('<br>'):'—'}</small></div><div class="amt">${total?euros(total):'—'}</div></div>`;
    }).join('');
    contenido=`<section class="sec" style="padding-top:0"><div class="tag">Desglose de deuda</div><h3>Lo que debo</h3><div class="card"><div class="mv"><div class="x"><b>Cuotas mensuales</b><br><small>${filasCuotas?pendientes.length+' cuota(s) pendiente(s)':'Al día'}</small></div><div class="amt">${deudaCuotas?euros(deudaCuotas):'—'}</div></div>${filasCargos}</div><p class="mu">Los importes se calculan automáticamente con los precios configurados por Tesorería, las asistencias y las invitadas confirmadas.</p></section>`;
  }
  if(CUENTA_TAB==='pag') contenido=`<section class="sec" style="padding-top:0"><div class="row" style="justify-content:space-between;align-items:center"><div><div class="tag">Historial</div><h3>Mis pagos</h3></div><button class="btn" data-a="cuenta-pago-open">Registrar un pago</button></div><div class="card">${d.pagos.length?d.pagos.map(p=>`<div class="mv"><div class="x"><b>${esc(p.categoria||p.concepto||p.cargo_concepto||p.periodo||'Pago')}</b><br><small>${esc(p.metodo||'Método no indicado')} · ${fechaBonita(p.fecha_pago)}</small></div><div style="text-align:right"><b class="amt">${euros(p.importe_centimos)}</b><br>${estado(p)}</div></div>`).join(''):'<p class="mu">Todavía no has registrado ningún pago.</p>'}</div><p class="mu">Los pagos pendientes se descuentan de tu deuda cuando Tesorería los confirma.</p></section>`;
  if(CUENTA_TAB==='al') contenido=`<section class="sec" style="padding-top:0"><div class="tag">Información alimentaria</div><h3>Mis alergias o dietas</h3><div class="card"><p class="mu" style="margin-top:0">Son el punto de partida cada vez que confirmas un sábado. Puedes cambiarlas en cada uno.</p><form data-f="alergias"><div class="wr">${TAGS.map(t=>`<label class="chip ${alergiasActuales.includes(t)?'on':''}" style="display:inline-flex;align-items:center;gap:7px"><input type="checkbox" name="alergia" value="${esc(t)}" ${alergiasActuales.includes(t)?'checked':''}> ${esc(t)}</label>`).join('')}</div><label class="fl">Otras alergias o aclaraciones</label><textarea class="t" name="observaciones" rows="3">${esc(d.alergias?.observaciones||'')}</textarea><button class="btn" style="margin-top:14px">Guardar mis alergias</button></form><p class="mu" style="margin:14px 0 0">Son datos de salud: solo los ve el turno de cocina de cada sábado y la junta.</p></div></section>`;
  return shell(`<div class="top"><div class="tag">Tu situación</div><h2>Mi cuenta</h2></div>
  <section class="hero2" style="padding:22px"><span style="opacity:.75">Pendiente de pago</span><div class="big">${euros(deudaTrasRevision)}</div>${pendienteRevision?'<div style="opacity:.8;font-size:14px;margin-top:6px">'+euros(pendienteRevision)+' en revisión por Tesorería</div>':''}<p style="margin:16px 0 0"><button class="btn" data-a="cuenta-pago-open">Registrar un pago</button></p></section>
  ${subnav('cuenta',CUENTA_TAB,[['deb','Lo que debo'],['pag','Mis pagos ('+d.pagos.length+')'],['al','Mis alergias']])}
  ${contenido}
  ${PAGO_MODAL?`<div class="ov" data-a="cuenta-pago-close"><div class="sheet" data-a="cuenta-pago-stop" role="dialog" aria-modal="true"><div class="row" style="justify-content:space-between"><h3>Registrar un pago</h3><button class="chip" type="button" data-a="cuenta-pago-close">✕</button></div><p class="mu">Indica el pago que has realizado. Tesorería lo comprobará antes de confirmarlo.</p><form data-f="cuenta-pago"><label class="fl">¿Qué estás pagando?</label><select class="t" name="categoria" required><option value="Cuotas mensuales">Cuotas mensuales</option><option value="Cuotas extraordinarias">Cuotas extraordinarias</option><option value="Sábados e invitadas">Sábados e invitadas</option><option value="Copas y refrescos">Copas y refrescos</option><option value="Otros">Otros</option></select>${campo('importe','Importe (€)','type="number" min="0.01" step="0.01" required')}${campo('fecha_pago','Fecha de pago','type="date" required value="'+new Date().toISOString().slice(0,10)+'"')}<label class="fl">¿Cómo has pagado?</label><select class="t" name="metodo"><option>Bizum</option><option>Transferencia</option><option>Efectivo</option></select>${campo('concepto','Nota (opcional)','maxlength="300"')}<button class="btn" style="width:100%;margin-top:18px">Enviar a Tesorería</button></form></div></div>`:''}`);
}




function selectsAsignacionCocina(d,asignadas) {
  const cantidad=Math.max(Number(d.personas_por_turno||2),asignadas.length,1);
  return Array.from({length:cantidad},(_,i)=>'<label class="fl cocina-assignment-slot">Persona '+(i+1)+'<select class="t" name="hermana"><option value="">Sin asignar</option>'+d.hermanas.map(h=>'<option value="'+h.id+'" '+(asignadas[i]?.hermana_id===h.id?'selected':'')+'>'+esc(h.nombre)+'</option>').join('')+'</select></label>').join('');
}

function listaAsistenciaJunta(junta,d) {
  const presentes=(d.asistencias||[]).filter(a=>Number(a.junta_id)===Number(junta.id)).map(a=>Number(a.hermana_id));
  return (d.hermanas||[]).map(h=>'<label class="fl" style="display:flex;align-items:center;gap:10px;padding:7px 0"><input type="checkbox" name="hermana" value="'+h.id+'" '+(presentes.includes(Number(h.id))?'checked':'')+'> '+esc(h.nombre)+'</label>').join('') || '<p class="mu">No hay hermanas activas disponibles.</p>';
}

function cambioTurnoMarkup(turno,miTurno,disponibles,cambios,turnos,asignaciones) {
  const intercambios=miTurno&&turno.fecha>=new Date().toISOString().slice(0,10)?turnos.filter(x=>x.id!==turno.id&&x.fecha>=new Date().toISOString().slice(0,10)&&!asignaciones.some(a=>a.turno_id===x.id&&a.hermana_id===ME.id)).flatMap(x=>asignaciones.filter(a=>a.turno_id===x.id&&a.hermana_id!==ME.id&&!asignaciones.some(b=>b.turno_id===turno.id&&b.hermana_id===a.hermana_id)).map(a=>({turno:x,hermana:a}))):[];
  const formulario=intercambios.length?'<details style="margin-top:12px"><summary class="chip">Intercambiar sábado</summary><form data-f="cocina-intercambio" data-id="'+turno.id+'" style="margin-top:12px"><label class="fl">Sábado y hermana con quien intercambiar</label><select class="t" name="destino" required><option value="">Selecciona el turno</option>'+intercambios.map(x=>'<option value="'+x.turno.id+':'+x.hermana.hermana_id+'">'+fechaBonita(x.turno.fecha)+' · '+esc(x.hermana.nombre)+'</option>').join('')+'</select><p class="mu">Intercambiaréis vuestros turnos completos. El cambio quedará registrado en el historial.</p><button class="btn" style="margin-top:8px">Confirmar intercambio</button></form></details>':'';
  const sustitucion=miTurno && turno.fecha>=new Date().toISOString().slice(0,10) && disponibles.length ? `<details style="margin-top:10px"><summary class="chip">Buscar sustituta</summary><form data-f="cocina-cambio" data-id="${turno.id}" style="margin-top:12px"><label class="fl">Hermana que me sustituye</label><select class="t" name="hermana_id" required><option value="">Selecciona una hermana</option>${disponibles.map(h=>`<option value="${h.id}">${esc(h.nombre)}</option>`).join("")}</select><p class="mu">La sustitución quedará anotada en el historial del turno.</p><button class="btn" style="margin-top:8px">Confirmar sustitución</button></form></details>` : "";
  const historial=cambios.length ? `<div class="sec" style="padding:12px 0 0"><b>Historial de cambios</b>${cambios.map(x=>`<div class="mv"><div class="x"><b>${esc(x.hermana_sale)}</b><br><small class="mu">Sustituida por ${esc(x.hermana_entra)} · ${fechaBonita((x.creado||"").slice(0,10))}</small></div></div>`).join("")}</div>` : "";
  return formulario+sustitucion+historial;
}

async function vCocina() {
  const d = await api('GET', '/modulos/cocina');
  const admin = ME.admin || ME.tes;
  const turnos = d.turnos.filter(t => COCINA_TAB === 'mis' ? d.asignaciones.some(a=>a.turno_id===t.id && a.hermana_id===ME.id) : true);
  const tarjetas = turnos.map(t => {
    const asignadas=d.asignaciones.filter(a=>a.turno_id===t.id);
    const comensales=Number(t.confirmadas||0)+Number(t.invitadas||0);
    const presupuesto=Number(t.presupuesto_calculado_centimos||0);
    const gastos=d.tickets.filter(x=>x.turno_cocina_id===t.id);
    const miTurno=asignadas.some(a=>a.hermana_id===ME.id);
    const cambiosTurno=(d.cambios||[]).filter(x=>x.turno_id===t.id);
    const disponibles=(d.hermanas||[]).filter(h=>!asignadas.some(a=>a.hermana_id===h.id));
    const alergiasTurno=d.alergias.filter(a=>!a.fecha || a.fecha===t.fecha);
    return `<article class="card"><div class="row" style="justify-content:space-between;align-items:center"><span class="tag">${esc(t.turno || 'Encuentro')}</span><span class="pill">${fechaBonita(t.fecha)}</span></div><h3 style="margin-top:10px">${esc(t.responsable || 'Turno de cocina')}</h3><div class="kp" style="margin-top:12px"><div class="card"><small class="mu">Comensales confirmados</small><b>${comensales}</b><small class="mu">${t.confirmadas||0} hermanas · ${t.invitadas||0} invitadas</small></div><div class="card"><small class="mu">Presupuesto automático</small><b>${euros(presupuesto)}</b><small class="mu">${euros(Number(t.precio_persona_centimos||0))} por comensal</small></div></div>${t.observaciones ? `<p class="mu" style="margin:12px 0 0">${esc(t.observaciones)}</p>` : ''}${asignadas.length ? `<p class="mu" style="margin-top:12px"><b>Hermanas asignadas:</b> ${asignadas.map(a=>esc(a.nombre)).join(', ')}</p>` : '<p class="mu" style="margin-top:12px">Turno pendiente de asignación.</p>'}
    ${cambioTurnoMarkup(t,miTurno,disponibles,cambiosTurno,d.turnos,d.asignaciones)}
    ${alergiasTurno.length && (ME.admin || ME.actas || asignadas.some(a=>a.hermana_id===ME.id)) ? `<div class="sec"><div class="tag">Información alimentaria · uso exclusivo del turno</div>${alergiasTurno.map(a=>`<div class="mv"><div class="x"><b>${esc(a.nombre)}</b><br><small>${esc(a.alergias||'Sin alergias indicadas')} ${esc(a.observaciones||'')}</small></div></div>`).join('')}</div>` : ''}
    ${admin ? `<div class="sec" style="padding:14px 0 0"><b>Gestionar asignación</b><form data-f="cocina-asignar" data-id="${t.id}" style="margin-top:8px"><div class="grid">${selectsAsignacionCocina(d,asignadas)}</div><button class="chip on" style="margin-top:10px">Guardar asignación</button></form>
    <details style="margin-top:14px"><summary class="chip">Editar turno</summary><form data-f="cocina-edit" data-id="${t.id}" style="margin-top:12px"><div class="row"><div style="flex:1 1 140px">${campo('fecha','Fecha','type="date" required value="'+esc(t.fecha)+'"')}</div><div style="flex:1 1 130px">${campo('turno','Turno','value="'+esc(t.turno || '')+'"')}</div><div style="flex:1 1 180px">${campo('responsable','Responsable','value="'+esc(t.responsable || '')+'"')}</div></div><label class="fl">Menú</label><textarea class="t" name="menu" rows="3">${esc(t.menu || '')}</textarea><label class="fl">Observaciones</label><textarea class="t" name="observaciones" rows="2">${esc(t.observaciones || '')}</textarea><button class="chip on" style="margin-top:10px">Guardar cambios</button></form></details><p style="margin:14px 0 0"><button class="chip" data-a="cocina-del" data-id="${t.id}">Eliminar turno</button></p></div>` : ''}
    <section class="sec"><div class="tag">Compras</div><h3>Tickets del turno</h3>${gastos.length ? gastos.map(x=>`<div class="mv"><div class="x"><b>${esc(x.nombre_archivo)}</b><br><small class="mu">${fechaBonita((x.creado||'').slice(0,10))}</small></div><a class="chip" target="_blank" href="/api/modulos/cocina/tickets/${x.id}">Abrir</a></div>`).join('') : '<p class="mu">No hay tickets asociados.</p>'}
    ${(d.asignaciones.some(a=>a.turno_id===t.id && a.hermana_id===ME.id)||admin) ? `<form data-f="cocina-ticket" style="margin-top:12px"><input type="hidden" name="turno_cocina_id" value="${t.id}"><label class="fl">Comercio o concepto</label><input class="t" name="comercio" required placeholder="Ej.: Mercadona"><label class="fl">Importe (€)</label><input class="t" name="importe" type="number" min="0.01" step="0.01" required><label class="fl">¿Cómo se ha pagado?</label><select class="t" name="forma_pago"><option value="tarjeta">Con la tarjeta del grupo</option><option value="caja">Con dinero de la caja</option><option value="yo">Lo he adelantado yo</option></select><label class="fl">Foto del ticket (máx. 1 MB)</label><input class="t" type="file" name="ticket" accept="image/jpeg,image/png,image/webp,application/pdf" required><button class="btn" style="margin-top:10px">Enviar ticket a Tesorería</button></form>` : ''}
    </section></article>`;
  }).join('');
  let contenido = '';
  if (COCINA_TAB === 'sorteo') contenido = admin ? `<div class="card"><div class="tag">Organización de turnos</div><h3>Sorteo de cocina</h3><p class="mu">Reparte los próximos sábados entre las hermanas activas, equilibrando el número de turnos asignados. Puedes elegir dos o tres personas por sábado.</p><form data-f="cocina-sorteo"><label class="fl">Personas por turno</label><select class="t" name="personas_por_turno"><option value="2" ${Number(d.personas_por_turno||2)===2?'selected':''}>2 personas</option><option value="3" ${Number(d.personas_por_turno||2)===3?'selected':''}>3 personas</option></select><button class="btn" style="margin-top:14px">Realizar sorteo de los próximos sábados</button></form><button type="button" class="chip" data-a="cocina-sorteo-del" ${turnosAsignados.length?'':'disabled'}>Eliminar sorteo</button><p class="mu" style="margin-bottom:0">El sorteo sustituye las asignaciones de los turnos futuros incluidos. Los sábados ya celebrados no se modifican.</p></div>` : '';
  else if (COCINA_TAB === 'tickets') contenido = `<div class="card"><h3>Tickets de compra</h3>${d.tickets.length ? d.tickets.map(t=>`<div class="mv"><div class="x"><b>${esc(t.nombre_archivo)}</b><br><small class="mu">${fechaBonita((t.creado||'').slice(0,10))}</small></div><a class="chip" target="_blank" href="/api/modulos/cocina/tickets/${t.id}">Abrir</a></div>`).join('') : '<p class="mu">Todavía no hay tickets guardados.</p>'}</div>`;
  else contenido = `<section class="sec" style="padding-top:0"><div class="g2">${tarjetas || '<div class="card"><p class="mu">No hay turnos para mostrar.</p></div>'}</div></section>`;
  const opciones=[['mis','Mis turnos'],['cal','Todos los turnos']];
  if (admin) opciones.push(['sorteo','Sorteo']);
  return shell(`<div class="top"><div class="tag">Organización del cuartel</div><h2>Cocina</h2><p class="mu" style="margin:0">Turnos, menús, presupuesto calculado según las confirmaciones y compras.</p></div>
  ${subnav('cocina',COCINA_TAB,opciones)}
  ${admin && COCINA_TAB==='cal' ? `<section class="card" style="margin-bottom:16px"><div class="tag">Planificación</div><h3>Nuevo turno de cocina</h3><form data-f="cocina-new"><div class="row" style="align-items:flex-end"><div style="flex:1 1 140px">${campo('fecha','Fecha','type="date" required')}</div><div style="flex:1 1 130px">${campo('turno','Turno','placeholder="Comida / cena"')}</div><div style="flex:1 1 180px">${campo('responsable','Responsable')}</div><button class="btn">Añadir turno</button></div><label class="fl">Menú</label><textarea class="t" name="menu" rows="3"></textarea><label class="fl">Observaciones</label><textarea class="t" name="observaciones" rows="2"></textarea></form></section>` : ''}
  ${contenido}`);
}


async function vActas() {
  const d = await api('GET', '/modulos/actas');
  const puedeGestionar = ME.admin || ME.actas;
  let contenido='';
  if(ACTAS_TAB==='conv' && puedeGestionar) contenido=`<section class="card"><div class="tag">Secretaría</div><h3>Convocar junta</h3><form data-f="junta-new"><div class="row actas-junta-fields"><div style="flex:1 1 140px">${campo('fecha','Fecha','type="date" required')}</div><div style="flex:1 1 120px">${campo('hora','Hora','type="time"')}</div><div style="flex:1 1 180px">${campo('lugar','Lugar')}</div></div><label class="fl">Convocatoria</label><textarea class="t" name="convocatoria" rows="2"></textarea><label class="fl">Orden del día</label><textarea class="t" name="orden_dia" rows="4"></textarea><button class="btn" style="margin-top:12px">Crear convocatoria</button></form></section>
  <section class="sec"><div class="tag">Juntas</div><h3>Convocatorias registradas</h3>${d.juntas.length?d.juntas.map(j=>`<div class="card" style="margin-bottom:12px"><div class="row" style="justify-content:space-between"><span class="pill">${esc(j.estado)}</span><span class="mu">${fechaBonita(j.fecha)} · ${esc(j.hora||'')}</span></div><h3>${esc(j.lugar||'Junta')}</h3><p>${esc(j.convocatoria||'')}</p><p class="mu"><b>Orden del día</b><br>${esc(j.orden_dia||'Sin definir')}</p><details><summary class="chip">Registrar asistencia</summary><form data-f="junta-asistencia" data-id="${j.id}" style="margin-top:10px"><div class="grid">${listaAsistenciaJunta(j,d)}</div><button class="chip on" style="margin-top:10px">Guardar asistencia</button></form></details><details><summary class="chip">Editar convocatoria</summary><form data-f="junta-edit" data-id="${j.id}" style="margin-top:10px"><div class="two formgrid"><div>${campo('fecha','Fecha','type="date" required value="'+esc(j.fecha)+'"')}</div><div>${campo('hora','Hora','type="time" value="'+esc(j.hora||'')+'"')}</div><div>${campo('lugar','Lugar','value="'+esc(j.lugar||'')+'"')}</div><div><label class="fl">Estado</label><select class="t" name="estado"><option value="convocada" ${j.estado==='convocada'?'selected':''}>Convocada</option><option value="celebrada" ${j.estado==='celebrada'?'selected':''}>Celebrada</option><option value="cancelada" ${j.estado==='cancelada'?'selected':''}>Cancelada</option></select></div></div><label class="fl">Convocatoria</label><textarea class="t" name="convocatoria" rows="2">${esc(j.convocatoria||'')}</textarea><label class="fl">Orden del día</label><textarea class="t" name="orden_dia" rows="3">${esc(j.orden_dia||'')}</textarea><button class="chip on">Guardar cambios</button></form></details><p style="margin:12px 0 0"><button class="chip" data-a="junta-del" data-id="${j.id}">Eliminar convocatoria</button></p></div>`).join(''):'<div class="card"><p class="mu">No hay juntas convocadas.</p></div>'}</section>`;
  if(ACTAS_TAB==='conv' && !puedeGestionar) contenido=`<section class="sec" style="padding-top:0"><div class="tag">Información del cuartel</div><h3>Convocatorias de juntas</h3>${d.juntas.length?d.juntas.map(j=>`<article class="card" style="margin-bottom:12px"><div class="row" style="justify-content:space-between"><span class="pill">${esc(j.estado)}</span><span class="mu">${fechaBonita(j.fecha)} · ${esc(j.hora||'')}</span></div><h3>${esc(j.lugar||'Junta')}</h3><p>${esc(j.convocatoria||'')}</p><p class="mu"><b>Orden del día</b><br>${esc(j.orden_dia||'Sin definir')}</p></article>`).join(''):'<div class="card"><p class="mu">Todavía no hay convocatorias publicadas.</p></div>'}</section>`;
  if(ACTAS_TAB==='act') {
    const actasVisibles=d.juntas.filter(j=>Number(String(j.fecha||'').slice(0,4))>=2026);
    contenido=`${puedeGestionar?`<section class="card" style="margin-bottom:18px"><div class="tag">Archivo histórico</div><h3>Incorporar un acta anterior</h3><p class="mu">Registra la fecha de la reunión y después adjunta su PDF. Esta opción no envía convocatorias ni correos.</p><form data-f="acta-historica"><div class="two formgrid"><div>${campo('fecha','Fecha de la junta','type="date" required')}</div><div>${campo('lugar','Título o lugar','placeholder="Junta ordinaria / extraordinaria"')}</div></div><label class="fl">Orden del día (opcional)</label><textarea class="t" name="orden_dia" rows="2"></textarea><button class="btn" style="margin-top:10px">Añadir al archivo</button></form></section>`:''}
    <section class="sec" style="padding-top:0"><div class="tag">Archivo de secretaría</div><h3>Actas</h3><p class="mu">Archivo de actas desde 2026. Los documentos PDF se pueden consultar desde cualquier cuenta de hermana.</p>${actasVisibles.map(j=>{
      const a=d.actas.find(x=>x.junta_id===j.id)||{}, pdf=(d.documentos||[]).find(x=>Number(x.junta_id)===j.id);
      return `<article class="card" style="margin-bottom:12px"><div class="row" style="justify-content:space-between"><b>${esc(j.lugar||'Junta')}</b><span class="mu">${fechaBonita(j.fecha)}</span></div><p class="mu">Orden del día: ${esc(j.orden_dia||'—')}</p>
      ${pdf?`<div class="mv" style="margin:12px 0"><div class="x"><b>${esc(pdf.nombre)}</b><br><small class="mu">${Math.ceil(pdf.tamano/1024)} KB · Subido: ${fechaBonita(String(pdf.creado||'').slice(0,10))}</small></div><a class="chip on" href="/api/modulos/actas/juntas/${j.id}/archivo" target="_blank" rel="noopener">Abrir PDF</a></div>`:'<p class="mu">Todavía no se ha adjuntado el PDF de esta acta.</p>'}
      ${puedeGestionar?`<details style="margin-top:12px" open><summary class="chip">Gestionar acta</summary><form data-f="acta-pdf" data-id="${j.id}" style="margin-top:12px"><label class="fl">Subir o sustituir PDF (máx. 1 MB)</label><input class="t" type="file" name="archivo" accept="application/pdf" required><button class="btn" style="margin-top:8px">${pdf?'Sustituir PDF':'Subir PDF'}</button></form><form data-f="acta-save" data-id="${j.id}" style="margin-top:16px"><label class="fl">Texto del acta (opcional si adjuntas el PDF)</label><textarea class="t" name="texto" rows="5">${esc(a.texto||'')}</textarea><label class="fl">Acuerdos</label><textarea class="t" name="acuerdos" rows="3">${esc(a.acuerdos||'')}</textarea><button class="chip on" style="margin-top:8px">Guardar texto y acuerdos</button></form></details>`:`<div class="acta-lectura">${a.texto?`<p style="white-space:pre-wrap">${esc(a.texto)}</p>`:''}${a.acuerdos?`<div class="sec"><b>Acuerdos</b><p style="white-space:pre-wrap">${esc(a.acuerdos)}</p></div>`:''}</div>`}
      </article>`;
    }).join('')||'<div class="card"><p class="mu">Todavía no hay reuniones registradas desde 2026.</p></div>'}</section>`;
  }
  if(ACTAS_TAB==='est') { const doc=await api('GET','/modulos/actas/estatutos'); contenido=`<div class="card"><div class="tag">Documentación</div><h3>Estatutos</h3><p class="mu">Documento vigente del cuartel. Todas las hermanas pueden consultarlo.</p>${doc.documento?`<div class="mv"><div class="x"><b>${esc(doc.documento.nombre)}</b><br><small class="mu">Actualizado: ${fechaBonita((doc.documento.creado||'').slice(0,10))} · ${Math.ceil(doc.documento.tamano/1024)} KB</small></div><a class="chip on" href="/api/modulos/actas/estatutos/archivo" target="_blank" rel="noopener">Abrir PDF</a></div>`:'<p class="mu">Todavía no se ha publicado ningún documento.</p>'}${ME.admin||ME.actas?`<form data-f="estatutos" style="margin-top:18px"><label class="fl">Subir o sustituir el PDF vigente (máx. 1 MB)</label><input class="t" type="file" name="archivo" accept="application/pdf" required><button class="btn" style="margin-top:10px">Publicar estatutos</button></form>`:''}</div>`; }
  return shell(`${ME.admin?adm('actas',''):''}<div class="top"><div class="tag">Secretaría</div><h2>Juntas y actas</h2><p class="mu" style="margin:0">Convocatorias, orden del día, asistencia y acuerdos.</p></div>
  ${subnav('actas',ACTAS_TAB,[['conv','Convocatoria'],['act','Actas'],['est','Estatutos']])}
  ${contenido}`);
}


function extraRow(x={}) { return `<div class="extra-row card" style="margin:10px 0;padding:12px"><div class="two formgrid"><div>${campo('nombre','Concepto','required value="'+esc(x.nombre||'')+'"')}</div><div><label class="fl">Categoría</label><select class="t" name="categoria"><option ${x.categoria==='Cuaresma'?'selected':''}>Cuaresma</option><option ${x.categoria==='Semana Santa'?'selected':''}>Semana Santa</option><option ${!x.categoria||x.categoria==='Otros'?'selected':''}>Otros</option></select></div><div>${campo('importe','Importe (€)','type="number" min="0" step="0.01" value="'+(Number(x.importe_centimos||0)/100)+'"')}</div><div><label class="fl">Aplicación</label><select class="t" name="tipo"><option value="una_vez" ${x.tipo==='una_vez'?'selected':''}>Una sola vez</option><option value="por_sabado" ${x.tipo==='por_sabado'?'selected':''}>Cada sábado que asista</option></select></div></div><button type="button" class="chip" data-a="extra-del" style="margin-top:8px">Eliminar concepto</button></div>`; }

async function entregarPDF(blob,nombre,titulo,texto) {
  const archivo=new File([blob],nombre,{type:'application/pdf'});
  // La descarga se inicia siempre: cancelar el diálogo de compartir no debe perder el PDF.
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=nombre;a.style.display='none';document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),120000);

  if(typeof navigator.share==='function' && typeof navigator.canShare==='function' && navigator.canShare({files:[archivo]})) {
    try {
      await navigator.share({files:[archivo],title:titulo,text:texto});
      toast('PDF descargado y compartido.');
      return;
    } catch(e) {
      if(e?.name==='AbortError') {
        toast('PDF descargado. Puedes adjuntarlo en WhatsApp cuando quieras.');
        return;
      }
    }
  }
  toast('PDF descargado. Adjunta el archivo en WhatsApp para enviarlo.');
}

async function crearPDFSimple(lineas) {
  const limpiar=t=>String(t).replace(/€/g,"\x80").replace(/[()\\]/g,ch=>"\\"+ch).replace(/[^\x20-\xff]/g,"?");
  let contenido="BT /F1 10 Tf 40 800 Td 14 TL\n";
  lineas.forEach(linea=>{contenido+="("+limpiar(linea)+") Tj T*\n";});
  contenido+="ET";
  const objetos=["<</Type/Catalog/Pages 2 0 R>>","<</Type/Pages/Kids[3 0 R]/Count 1>>","<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>","<</Length "+contenido.length+">>\nstream\n"+contenido+"\nendstream","<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>"];
  let pdf="%PDF-1.4\n", offsets=[];
  objetos.forEach((obj,i)=>{offsets.push(pdf.length);pdf+=(i+1)+" 0 obj\n"+obj+"\nendobj\n";});
  const inicio=pdf.length;pdf+="xref\n0 6\n0000000000 65535 f \n"+offsets.map(n=>String(n).padStart(10,"0")+" 00000 n \n").join("")+"trailer\n<</Size 6/Root 1 0 R>>\nstartxref\n"+inicio+"\n%%EOF";
  return new Blob([Uint8Array.from(pdf,ch=>ch.charCodeAt(0)&255)],{type:"application/pdf"});
}

let RESUMEN_MES = fechaHoyLocal().slice(0,7), RESUMEN_DATA = null;

async function vResumenMensual() {
  const d = await api('GET', '/modulos/resumen-mensual?periodo=' + encodeURIComponent(RESUMEN_MES));
  RESUMEN_DATA = d;
  const titulo = new Date(d.periodo + '-01T12:00:00').toLocaleDateString('es-ES',{month:'long',year:'numeric'});
  const anteriorTitulo = new Date(d.comparativa.periodo + '-01T12:00:00').toLocaleDateString('es-ES',{month:'long',year:'numeric'});
  const eurosDelta = (a,b) => { const v=Number(a||0)-Number(b||0); return (v>0?'+':v<0?'−':'')+euros(Math.abs(v)); };
  const numDelta = (a,b) => { const v=Number(a||0)-Number(b||0); return (v>0?'+':'')+v; };
  const variacion = (actual, previo) => '<small class="monthly-compare">Mes anterior: '+euros(previo)+' · '+eurosDelta(actual,previo)+'</small>';
  const actividadDelta = (actual, previo) => '<small class="monthly-compare">Mes anterior: '+previo+' · '+numDelta(actual,previo)+'</small>';
  const movimientos = d.movimientos || [];
  const ingresos = movimientos.filter(x=>x.tipo==='ingreso').reduce((n,x)=>n+Number(x.importe_centimos||0),0);
  const gastos = movimientos.filter(x=>x.tipo==='gasto').reduce((n,x)=>n+Number(x.importe_centimos||0),0);
  const fmtFecha = x => fechaBonita(x);
  const kpi = (label,valor,clase,comparacion) => '<article class="monthly-kpi"><span>'+label+'</span><b class="'+(clase||'')+'">'+valor+'</b>'+(comparacion||'')+'</article>';
  const listaMovimientos = movimientos.length ? '<div class="monthly-list">'+movimientos.map(x=>'<div class="monthly-row"><span><b>'+esc(x.concepto)+'</b><small>'+fmtFecha(x.fecha)+' · '+esc(x.categoria||'Sin categoría')+'</small></span><strong class="'+(x.tipo==='ingreso'?'positive':'negative')+'">'+(x.tipo==='ingreso'?'+':'−')+euros(x.importe_centimos)+'</strong></div>').join('')+'</div>' : '<p class="mu">No hay ingresos ni gastos contabilizados en este mes.</p>';
  const listaSabados = d.sabados.length ? '<div class="monthly-list">'+d.sabados.map(x=>'<div class="monthly-row"><span><b>'+esc(x.titulo||'Sábado de cuartel')+'</b><small>'+fmtFecha(x.fecha)+'</small></span><strong>'+Number(x.asistentes||0)+' hermanas · '+Number(x.invitadas||0)+' invitadas</strong></div>').join('')+'</div>' : '<p class="mu">No hay sábados registrados en este mes.</p>';
  const juntas = d.juntas.length ? '<div class="monthly-list">'+d.juntas.map(x=>'<div class="monthly-row"><span><b>'+esc(x.lugar||'Junta')+'</b><small>'+fmtFecha(x.fecha)+' · '+esc(x.estado)+'</small></span><strong>'+Number(x.asistentes||0)+' asistentes</strong></div>').join('')+'</div>' : '<p class="mu">No hay juntas registradas en este mes.</p>';
  const eventos = d.eventos.length ? '<div class="monthly-list">'+d.eventos.map(x=>'<div class="monthly-row"><span><b>'+esc(x.titulo)+'</b><small>'+fmtFecha(x.fecha)+' · '+esc(({cofradia:'Acto de cofradía',cruz_mayo:'Cruz de Mayo',cultos:'Cultos',convivencia:'Convivencia',otros:'Otros'})[x.tipo]||'Evento')+'</small></span><strong class="'+(x.estado==='cancelado'?'negative':'')+'">'+(x.estado==='cancelado'?'Cancelado':'Publicado')+'</strong></div>').join('')+'</div>' : '<p class="mu">No hay otros eventos registrados en este mes.</p>';
  const resumenCuotas=d.cuotas||{cantidad:0,generado:0,cobrado:0,pendiente:0};
  shell(`<div class="top"><div class="tag">Gestión del cuartel</div><h2>Resumen mensual</h2><p class="mu" style="margin:0">Una visión conjunta de la economía y la actividad, a partir de los registros existentes.</p></div>
    <section class="monthly-report">
      <div class="monthly-toolbar card"><div><div class="tag">Informe del periodo</div><h3>${esc(titulo)}</h3><p class="mu">Comparativa con ${esc(anteriorTitulo)}</p></div><form data-f="resumen-mes" class="monthly-period-form"><label class="fl" for="resumen-periodo">Consultar mes</label><input class="t" id="resumen-periodo" type="month" name="periodo" required value="${esc(RESUMEN_MES)}"><button class="btn">Consultar</button></form></div>
      <div class="monthly-section-head"><div><div class="tag">Tesorería</div><h3>Situación económica</h3></div><span class="monthly-note">Movimientos confirmados · sin traspasos</span></div>
      <div class="monthly-kpis">
        ${kpi('Ingresos del mes',euros(ingresos),'positive',variacion(ingresos,d.comparativa.ingresos))}
        ${kpi('Gastos del mes',euros(gastos),'negative',variacion(gastos,d.comparativa.gastos))}
        ${kpi('Resultado del mes',euros(ingresos-gastos),ingresos-gastos>=0?'positive':'negative',variacion(ingresos-gastos,d.comparativa.resultado))}
      </div>
      <div class="monthly-section-head"><div><div class="tag">Cuotas</div><h3>Cuotas generadas en el periodo</h3></div></div>
      <div class="monthly-kpis monthly-kpis-three">
        ${kpi('Generado',euros(resumenCuotas.generado),'',actividadDelta(resumenCuotas.cantidad,d.comparativa.cuotas?.cantidad||0)+'<span class="monthly-caption">'+Number(resumenCuotas.cantidad||0)+' cuotas</span>')}
        ${kpi('Cobrado',euros(resumenCuotas.cobrado),'positive','<span class="monthly-caption">Pagos confirmados aplicados a estas cuotas</span>')}
        ${kpi('Pendiente de cobro',euros(resumenCuotas.pendiente),'', '<span class="monthly-caption">Pendiente actual de las cuotas de este periodo</span>')}
      </div>
      <div class="monthly-section-head"><div><div class="tag">Actividad</div><h3>Vida del cuartel</h3></div></div>
      <div class="monthly-kpis monthly-kpis-three">
        ${kpi('Sábados del mes',String(d.sabados_programados), '', actividadDelta(d.sabados_programados,d.comparativa.sabados_programados))}
        ${kpi('Asistencia confirmada',String(d.asistencia), '', actividadDelta(d.asistencia,d.comparativa.asistencia))}
        ${kpi('Juntas celebradas',String(d.juntas_celebradas), '', actividadDelta(d.juntas_celebradas,d.comparativa.juntas_celebradas))}
      </div>
      <div class="monthly-detail-grid">
        <section class="card"><div class="tag">Contabilidad</div><h3>Ingresos y gastos</h3>${listaMovimientos}</section>
        <section class="card"><div class="tag">Sábados</div><h3>Asistencia y convivencia</h3>${listaSabados}</section>
        <section class="card"><div class="tag">Secretaría</div><h3>Juntas</h3>${juntas}</section>
        <section class="card"><div class="tag">Agenda</div><h3>Otros eventos</h3>${eventos}</section>
      </div>
      <div class="monthly-export"><div><b>Informe mensual en PDF</b><small>Resumen económico, cuotas, asistencia, juntas y eventos.</small></div><button class="btn" type="button" data-a="resumen-pdf"> <span aria-hidden="true">↓</span> Exportar PDF</button></div>
    </section>`);
}

async function vTesoreria() {
  const d = await api('GET', '/modulos/tesoreria');
  const ingresos=d.totales.ingresos, gastos=d.totales.gastos, saldo=Number(d.totales.saldo_centimos||0);
  const aniosMov=[...new Set(d.movimientos.map(x=>String(x.fecha||'').slice(0,4)).filter(Boolean))].sort().reverse();
  const categoriasMov=[...new Set(d.movimientos.map(x=>x.categoria).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  const movimientosVisibles=d.movimientos.filter(x=>(TES_FILTRO.tipo==='todos'||x.tipo===TES_FILTRO.tipo)&&(!TES_FILTRO.cuenta||x.cuenta===TES_FILTRO.cuenta)&&(!TES_FILTRO.hermana||String(x.hermana_id)===TES_FILTRO.hermana)&&(!TES_FILTRO.anio||String(x.fecha||'').slice(0,4)===TES_FILTRO.anio)&&(!TES_FILTRO.categoria||x.categoria===TES_FILTRO.categoria)&&(!TES_FILTRO.desde||x.fecha>=TES_FILTRO.desde)&&(!TES_FILTRO.hasta||x.fecha<=TES_FILTRO.hasta)&&(!TES_FILTRO.texto||(x.concepto+' '+(x.categoria||'')+' '+(x.hermana||'')).toLowerCase().includes(TES_FILTRO.texto.toLowerCase())));
  const periodoActual=fechaHoyLocal().slice(0,7);
  const movimientosMes=d.movimientos.filter(x=>String(x.fecha||'').startsWith(periodoActual));
  const ingresosMes=movimientosMes.filter(x=>x.tipo==='ingreso').reduce((n,x)=>n+Number(x.importe_centimos||0),0);
  const gastosMes=movimientosMes.filter(x=>x.tipo==='gasto').reduce((n,x)=>n+Number(x.importe_centimos||0),0);
  const pendienteCobro=(d.cuotas_pendientes||[]).reduce((n,x)=>n+Number(x.restante_centimos||0),0)+(d.cargos_pendientes||[]).reduce((n,x)=>n+Number(x.restante_centimos||0),0);
  const pendientesRevision=(d.pagos_pendientes||[]).length+(d.movimientos_pendientes||[]).length+(d.tickets||[]).filter(x=>x.estado==='pendiente'||(!x.estado&&!x.movimiento_id)).length;
  const moneyParam=k=>Number(d.parametros?.[k]||0)/100;
  const mensual=d.estadisticas?.mensuales||[], maxMes=Math.max(1,...mensual.flatMap(x=>[Number(x.ingresos||0),Number(x.gastos||0)]));
  const pal=['#e8c23a','#c9971a','#8b6b45','#b8956a','#6b4f2f','#f0d878','#a07f4f','#d7b98c','#3b2c1c'];
  const donut=tipo=>{
    const base=(d.estadisticas?.categorias||[]).filter(x=>x.tipo===tipo&&Number(x.total)>0); const arr=Object.values(base.reduce((a,x)=>{const k=x.categoria||'Sin categoría';if(!a[k])a[k]={categoria:k,total:0};a[k].total+=Number(x.total||0);return a;},{}));
    const total=arr.reduce((a,x)=>a+Number(x.total),0);
    if(!total)return '<p class="mu">Todavía no hay datos para este gráfico.</p>';
    let acum=0;const stops=arr.map((x,i)=>{const ini=acum;acum+=Number(x.total)/total*100;return `${pal[i%pal.length]} ${ini}% ${acum}%`;}).join(',');
    return `<div class="row" style="align-items:center;gap:18px"><div class="donut" style="width:140px;height:140px;flex:0 0 140px;border-radius:50%;background:conic-gradient(${stops});position:relative"></div><div style="flex:1;min-width:150px">${arr.map((x,i)=>`<div class="lg"><i style="background:${pal[i%pal.length]}"></i><span>${esc(x.categoria||'Sin categoría')}</span><b>${Math.round(Number(x.total)/total*100)}%</b></div>`).join('')}</div></div>`;
  };
  let contenido='';
  if(TES_TAB==='res') contenido=`<section class="tes-overview"><div class="tes-overview-head"><div><div class="tag">Seguimiento del mes</div><h3>Situación económica · ${new Date(periodoActual+'-01T12:00:00').toLocaleDateString('es-ES',{month:'long',year:'numeric'})}</h3><p class="mu">Cifras contabilizadas y tareas que necesitan atención.</p></div><div class="tes-overview-actions"><button class="chip on" data-a="module-tab" data-module="tesoreria" data-tab="pun">Revisar pendientes · ${pendientesRevision}</button><button class="chip" data-a="module-tab" data-module="tesoreria" data-tab="mov">Ver movimientos</button></div></div><div class="tes-overview-kpis"><article><span>Ingresos del mes</span><b class="positive">${euros(ingresosMes)}</b></article><article><span>Gastos del mes</span><b class="negative">${euros(gastosMes)}</b></article><article><span>Pendiente de cobro</span><b>${euros(pendienteCobro)}</b></article></div></section><section class="kp tes-stats-kp"><div class="card"><span class="tag">Ingresos</span><b style="color:var(--ok)">${euros(ingresos)}</b></div><div class="card"><span class="tag">Gastos</span><b style="color:var(--ko)">${euros(gastos)}</b></div><div class="card"><span class="tag">Resultado</span><b>${euros(saldo)}</b></div></section>
  <div class="card tes-month-chart"><h3>Ingresos y gastos por mes</h3>${mensual.length?`<div class="cols">${mensual.map(x=>{const i=Number(x.ingresos||0),g=Number(x.gastos||0);return `<div class="col"><small><b>${euros(i-g)}</b></small><div class="pair"><i style="height:${Math.max(2,i/maxMes*100)}%;background:var(--go)"></i><i style="height:${Math.max(2,g/maxMes*100)}%;background:var(--br)"></i></div><span class="mu">${esc(x.periodo)}</span></div>`;}).join('')}</div><p class="mu">Dorado: ingresos · Marrón: gastos · Cifra: resultado del mes</p>`:'<p class="mu">Todavía no hay movimientos registrados.</p>'}</div>
  <div class="grid tes-donuts"><div class="card"><h3>¿En qué gastamos?</h3>${donut('gasto')}</div><div class="card"><h3>¿De dónde ingresamos?</h3>${donut('ingreso')}</div></div>`;
  if(TES_TAB==='mov') contenido=`<div class="tes-mov-toolbar"><div><div class="tag">Contabilidad</div><h3>Movimientos registrados</h3><p class="mu">Consulta, filtra y revisa los ingresos, gastos y traspasos del cuartel.</p></div><div class="wr"><button class="btn" data-a="tes-mov-open">＋ Nuevo apunte</button><button class="chip" data-a="tes-transfer-open">↔ Traspaso</button></div></div>
  <div class="card tes-filter-card"><form data-f="tes-filtro" class="tes-filter-grid">
  <div><label class="fl">Tipo de movimiento</label><select class="t" name="tipo"><option value="todos" ${TES_FILTRO.tipo==='todos'?'selected':''}>Todos</option><option value="ingreso" ${TES_FILTRO.tipo==='ingreso'?'selected':''}>Ingresos</option><option value="gasto" ${TES_FILTRO.tipo==='gasto'?'selected':''}>Gastos</option><option value="traspaso" ${TES_FILTRO.tipo==='traspaso'?'selected':''}>Traspasos</option></select></div>
  <div><label class="fl">Hermana</label><select class="t" name="hermana"><option value="">Todas</option>${(d.hermanas||[]).map(h=>`<option value="${h.id}" ${TES_FILTRO.hermana===String(h.id)?'selected':''}>${esc(h.nombre)}</option>`).join('')}</select></div>
  <div><label class="fl">Año</label><select class="t" name="anio"><option value="">Todos</option>${aniosMov.map(y=>`<option value="${y}" ${TES_FILTRO.anio===y?'selected':''}>${y}</option>`).join('')}</select></div>
  <div><label class="fl">Categoría</label><select class="t" name="categoria"><option value="">Todas</option>${categoriasMov.map(x=>`<option value="${esc(x)}" ${TES_FILTRO.categoria===x?'selected':''}>${esc(x)}</option>`).join('')}</select></div>
  <div><label class="fl">Cuenta</label><select class="t" name="cuenta"><option value="">Todas</option><option ${TES_FILTRO.cuenta==='Banco'?'selected':''}>Banco</option><option ${TES_FILTRO.cuenta==='Caja fuerte'?'selected':''}>Caja fuerte</option></select></div>
  <div>${campo('texto','Buscar','value="'+esc(TES_FILTRO.texto)+'" placeholder="Concepto o descripción"')}</div>
  <div>${campo('desde','Desde','type="date" value="'+TES_FILTRO.desde+'"')}</div>
  <div>${campo('hasta','Hasta','type="date" value="'+TES_FILTRO.hasta+'"')}</div>
  <div class="row"><button class="btn">Filtrar</button><button type="button" class="chip" data-a="tes-filtro-reset">Limpiar</button></div></form><div class="tes-list-summary"><b>${movimientosVisibles.length}</b> de ${d.movimientos.length} movimientos <span>·</span> Ingresos <b>${euros(ingresos)}</b> <span>·</span> Gastos <b>${euros(gastos)}</b></div></div><div class="card tes-mov-list">${movimientosVisibles.map(x=>`<div class="mv"><div class="ic" style="background:${x.tipo==='gasto'?'var(--ko)':'var(--ok)'}"></div><div class="x"><b>${esc(x.concepto)}</b><br><small class="mu">${fechaBonita(x.fecha)} · ${esc(x.categoria||'')} · ${esc(x.hermana||'')}</small></div><b class="amt">${x.tipo==='gasto'?'−':'+'}${euros(x.importe_centimos)}</b>${x.tickets?x.tickets.split(',').map(id=>`<a class="chip" target="_blank" href="/api/modulos/tesoreria/tickets/${id}">Ticket</a>`).join(''):''}</div>`).join('')||'<p class="mu">No hay movimientos con esos filtros.</p>'}</div>${TES_MOV_MODAL?`<div class="tes-modal-backdrop"><section class="tes-modal" role="dialog" aria-modal="true" aria-label="Nuevo apunte"><div class="tes-modal-head"><div><div class="tag">Contabilidad</div><h3>Nuevo apunte</h3></div><button type="button" class="chip" data-a="tes-mov-close">Cerrar ×</button></div><form data-f="tes-movimiento" class="tes-entry-form"><div class="tes-type-choice"><label><input type="radio" name="tipo" value="ingreso" checked> Ingreso</label><label><input type="radio" name="tipo" value="gasto"> Gasto</label></div><div class="two formgrid"><div><label class="fl">Importe (€)</label><input class="t" name="importe" type="number" min="0.01" step="0.01" placeholder="0,00" required></div><div><label class="fl">Fecha</label><input class="t" name="fecha" type="date" required value="${new Date().toISOString().slice(0,10)}"></div><div><label class="fl">Categoría</label><select class="t" name="categoria" required>${categoriasMov.map(x=>`<option>${esc(x)}</option>`).join('')}</select></div><div><label class="fl">Cuenta</label><select class="t" name="cuenta"><option>Banco</option><option>Caja fuerte</option></select></div><div style="grid-column:1/-1">${campo('concepto','Concepto o descripción','required placeholder="Ej.: Donación, subvención, compra..."')}</div></div><div class="row" style="justify-content:flex-end;margin-top:16px"><button type="button" class="chip" data-a="tes-mov-close">Cancelar</button><button class="btn">Guardar apunte</button></div></form></section></div>`:''}${TES_TRANSFER_MODAL?`<div class="tes-modal-backdrop" data-a="tes-mov-close"><section class="tes-modal" role="dialog" aria-modal="true" aria-label="Traspaso entre cuentas"><div class="tes-modal-head"><div><div class="tag">Tesorería</div><h3>Traspaso entre cuentas</h3></div><button type="button" class="chip" data-a="tes-mov-close">Cerrar ×</button></div><p class="mu">No cuenta como ingreso ni gasto: solo mueve dinero entre Banco y Caja fuerte.</p><form data-f="tes-traspaso" class="two formgrid"><div>${campo('fecha','Fecha','type="date" required value="'+new Date().toISOString().slice(0,10)+'"')}</div><div>${campo('importe','Importe (€)','type="number" min="0.01" step="0.01" required')}</div><div><label class="fl">Sale de</label><select class="t" name="origen"><option>Banco</option><option>Caja fuerte</option></select></div><div><label class="fl">Entra en</label><select class="t" name="destino"><option>Caja fuerte</option><option>Banco</option></select></div><div class="row" style="grid-column:1/-1;justify-content:flex-end"><button type="button" class="chip" data-a="tes-mov-close">Cancelar</button><button class="btn">Registrar traspaso</button></div></form></section></div>`:''}`;
  if(TES_TAB==='rec') {
    const periodo=new Date().toISOString().slice(0,7),mesActual=Number(periodo.slice(5,7));
    const mesTexto=new Date(periodo+'-01T00:00:00').toLocaleDateString('es-ES',{month:'long',year:'numeric'});
    const fijosMes=d.gastos_fijos.filter(g=>g.activo&&(g.periodicidad==='mensual'||(g.periodicidad==='anual'&&Number(g.mes)===mesActual)));
    const pendientes=fijosMes.filter(g=>g.ultimo_periodo!==periodo);
    const meses=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const opcionesMes=meses.map((m,i)=>`<option value="${i+1}" ${Number(i+1)===mesActual?'selected':''}>${m}</option>`).join('');
    const cfgRows=d.gastos_fijos.map(g=>`<div class="mv" style="flex-wrap:wrap"><div class="x"><b>${esc(g.concepto)}</b><br><small class="mu">${esc(g.categoria||'Sin categoría')} · ${esc(g.cuenta||'Banco')} · ${g.periodicidad==='anual'?'Anual · '+meses[Number(g.mes||1)-1]:'Mensual'} · día ${g.dia}${g.variable?' · importe variable':''} · ${g.activo?'Activo':'Inactivo'}</small></div><b class="amt">${euros(g.importe_centimos)}</b><button class="chip" data-a="fijo-del" data-id="${g.id}">Desactivar</button><details style="flex:1 1 100%"><summary class="chip">Editar</summary><form data-f="tes-fijo-edit" data-id="${g.id}" class="two formgrid"><div>${campo('concepto','Concepto','required value="'+esc(g.concepto)+'"')}</div><div>${campo('categoria','Categoría','value="'+esc(g.categoria||'')+'"')}</div><div>${campo('importe','Importe (€)','type="number" min="0.01" step="0.01" value="'+(g.importe_centimos/100)+'"')}</div><div><label class="fl">Cuenta</label><select class="t" name="cuenta"><option ${g.cuenta==='Banco'?'selected':''}>Banco</option><option ${g.cuenta==='Caja fuerte'?'selected':''}>Caja fuerte</option></select></div><div><label class="fl">Periodicidad</label><select class="t" name="periodicidad"><option value="mensual" ${g.periodicidad==='mensual'?'selected':''}>Mensual</option><option value="anual" ${g.periodicidad==='anual'?'selected':''}>Anual</option></select></div><div><label class="fl">Mes (solo anual)</label><select class="t" name="mes">${meses.map((m,i)=>`<option value="${i+1}" ${Number(g.mes||1)===i+1?'selected':''}>${m}</option>`).join('')}</select></div><div>${campo('dia','Día','type="number" min="1" max="28" value="'+g.dia+'"')}</div><label class="mu"><input type="checkbox" name="variable" ${g.variable?'checked':''}> Importe variable</label><label class="mu"><input type="checkbox" name="activo" ${g.activo?'checked':''}> Activo</label><button class="chip on">Guardar</button></form></details></div>`).join('');
    const nuevoForm=`<form data-f="tes-fijo" class="two formgrid"><div>${campo('concepto','Concepto (ej.: Alquiler cuartel)','required')}</div><div>${campo('categoria','Categoría')}</div><div>${campo('importe','Importe (€)','type="number" min="0.01" step="0.01" required')}</div><div><label class="fl">Cuenta</label><select class="t" name="cuenta"><option>Banco</option><option>Caja fuerte</option></select></div><div><label class="fl">Periodicidad</label><select class="t" name="periodicidad"><option value="mensual">Mensual</option><option value="anual">Anual</option></select></div><div><label class="fl">Mes (solo anual)</label><select class="t" name="mes">${opcionesMes}</select></div><div>${campo('dia','Día de cargo','type="number" min="1" max="28" value="1"')}</div><label class="mu"><input type="checkbox" name="variable"> Importe variable</label><div class="row" style="grid-column:1/-1;justify-content:flex-end"><button type="button" class="chip" data-a="tes-fixed-close">Cancelar</button><button class="btn">Guardar gasto fijo</button></div></form>`;
    if(TES_REC_TAB==='cfg') contenido=`<div class="tes-fixed-toolbar"><div><h3>Gastos fijos configurados</h3><p class="mu">Se repiten cada mes o cada año y pasan a revisión cuando se registran.</p></div><button class="btn" type="button" data-a="tes-fixed-open">＋ Añadir gasto fijo</button></div><div class="card tes-fixed-list">${cfgRows||'<p class="mu">No hay gastos fijos configurados.</p>'}</div>${TES_NEW_FIXED_MODAL?`<div class="tes-modal-backdrop"><section class="tes-modal" role="dialog" aria-modal="true" aria-label="Añadir gasto fijo"><div class="tes-modal-head"><div><div class="tag">Configuración</div><h3>Añadir gasto fijo</h3></div><button type="button" class="chip" data-a="tes-fixed-close">Cerrar ×</button></div><p class="mu">Elige el concepto, la periodicidad y cómo se cargará. Si el importe varía, podrás ajustarlo cada mes.</p>${nuevoForm}</section></div>`:''}`;
    else contenido=`<div class="card"><div class="tag">Gastos previstos</div><h3>Gastos fijos de ${mesTexto}</h3><p class="mu">Confirma cada gasto cuando se haya pagado. Puedes ajustar el importe si es variable.</p>${fijosMes.length?fijosMes.map(g=>{const registrado=g.ultimo_periodo===periodo;return `<div class="mv" style="flex-wrap:wrap"><div class="x"><b>${esc(g.concepto)}</b><br><small class="mu">${esc(g.categoria||'Sin categoría')} · ${esc(g.cuenta||'Banco')} · día ${g.dia}</small></div>${registrado?'<span class="pill">Pendiente de validación</span>':`<form data-f="tes-fijo-registrar" data-id="${g.id}" class="row" style="align-items:center;gap:8px"><input type="hidden" name="periodo" value="${periodo}">${g.variable?`<input class="t" name="importe" type="number" min="0.01" step="0.01" required value="${(g.importe_centimos/100).toFixed(2)}" style="width:115px">`:`<input type="hidden" name="importe" value="${(g.importe_centimos/100).toFixed(2)}"><b class="amt">${euros(g.importe_centimos)}</b>`}<button class="chip on">Registrar</button></form>`}</div>`;}).join(''):'<p class="mu">No hay gastos fijos previstos para este mes.</p>'}${pendientes.length?'<p style="margin-top:14px"><button class="btn" data-a="fijo-registrar-todos">Registrar todos los pendientes</button></p>':''}</div>`;
    contenido=subnav('tesrec',TES_REC_TAB,[['mes','Este mes'],['cfg','Configurar gastos fijos']])+contenido;
  }
  if(TES_TAB==='pun') {
    const pagos=d.pagos_pendientes||[], movs=d.movimientos_pendientes||[];
    const pagosHtml=pagos.map(p=>`<article class="tes-review-row"><div class="tes-review-main"><b>${esc(p.hermana)}</b><small>${fechaBonita(p.fecha_pago)} · ${esc(p.metodo||'')} · ${esc(p.periodo||p.concepto||'Pago')}</small></div><strong>${euros(p.importe_centimos)}</strong><div class="tes-review-actions"><button class="chip on" data-a="pago-confirm" data-id="${p.id}">Confirmar</button><button class="chip" data-a="pago-reject" data-id="${p.id}">Rechazar</button></div></article>`).join('');
    const fijos=movs.filter(x=>x.origen==='gasto_fijo'||x.tipo==='gasto_fijo');
    const otros=movs.filter(x=>!fijos.includes(x));
    const movHtml=arr=>arr.map(x=>`<article class="tes-review-row"><div class="tes-review-main"><b>${esc(x.concepto)}</b><small>${fechaBonita(x.fecha)} · ${esc(x.categoria||'Sin categoría')} · ${esc(x.cuenta||'Banco')}</small></div><strong>${euros(x.importe_centimos)}</strong><div class="tes-review-actions"><button class="chip on" data-a="mov-confirm" data-id="${x.id}">Validar</button><button class="chip" data-a="mov-reject" data-id="${x.id}">Rechazar</button></div></article>`).join('');
    contenido=`<div class="tes-section-intro"><div><div class="tag">Bandeja de revisión</div><h3>Por validar</h3><p class="mu">Comprueba cada ingreso o gasto antes de incorporarlo a los saldos y estadísticas.</p></div><div class="tes-review-count"><b>${pagos.length+movs.length}</b><span>pendientes</span></div></div>
    <div class="tes-review-grid"><section class="card tes-review-group"><header><div><h3>Pagos de hermanas</h3><p class="mu">Bizum, transferencias y efectivo comunicados por las hermanas.</p></div><span class="tes-count">${pagos.length}</span></header>${pagosHtml||'<p class="tes-empty">No hay pagos pendientes de comprobar.</p>'}</section>
    <section class="card tes-review-group"><header><div><h3>Gastos fijos previstos</h3><p class="mu">Cargos recurrentes que deben comprobarse antes de contabilizarse.</p></div><span class="tes-count">${fijos.length}</span></header>${movHtml(fijos)||'<p class="tes-empty">No hay gastos fijos por validar.</p>'}</section>
    <section class="card tes-review-group tes-review-wide"><header><div><h3>Otros movimientos</h3><p class="mu">Ingresos y gastos manuales que están pendientes de confirmación.</p></div><span class="tes-count">${otros.length}</span></header>${movHtml(otros)||'<p class="tes-empty">No hay otros movimientos pendientes.</p>'}</section></div>`;
  }
  if(TES_TAB==='gp') {
    const pendientes=d.tickets.filter(t=>t.estado==='pendiente'||(!t.estado&&!t.movimiento_id));
    const revisados=d.tickets.filter(t=>t.estado==='incluido'||t.estado==='rechazado');
    contenido=`<div class="tes-section-intro"><div><div class="tag">Justificantes</div><h3>Gastos pendientes</h3><p class="mu">Revisa el justificante, comprueba quién adelantó el dinero y decide cómo contabilizarlo.</p></div><div class="tes-review-count"><b>${pendientes.length}</b><span>por revisar</span></div></div>
    <section class="card tes-ticket-list">${pendientes.map(t=>`<article class="tes-ticket-row"><div class="tes-ticket-info"><div><b>${esc(t.comercio||t.nombre_archivo)}</b><small>${esc(t.subido_por_nombre||'Hermana')} · ${fechaBonita((t.creado||'').slice(0,10))} · ${esc(t.forma_pago||'Forma de pago no indicada')}</small></div><strong>${euros(t.importe_centimos||0)}</strong><a class="chip" target="_blank" href="/api/modulos/tesoreria/tickets/${t.id}">Ver justificante ↗</a></div><form data-f="tes-ticket-review" data-id="${t.id}" class="tes-ticket-form"><div><label class="fl">Categoría</label><select class="t" name="categoria">${['Comida y bebida','Limpieza','Material y decoración','Otros'].map(x=>`<option ${t.categoria===x?'selected':''}>${x}</option>`).join('')}</select></div><div><label class="fl">Cuenta</label><select class="t" name="cuenta"><option ${(t.cuenta||'Banco')==='Banco'?'selected':''}>Banco</option><option ${t.cuenta==='Caja fuerte'?'selected':''}>Caja fuerte</option></select></div><div><label class="fl">Importe (€)</label><input class="t" name="importe" type="number" min="0.01" step="0.01" required value="${(Number(t.importe_centimos||0)/100)}"></div><div class="tes-ticket-actions"><button class="btn">Incluir en contabilidad</button><button type="button" class="chip" data-a="tes-ticket-reject" data-id="${t.id}">Rechazar</button></div></form></article>`).join('')||'<p class="tes-empty">No hay tickets pendientes de incluir.</p>'}</section>
    <details class="card tes-ticket-archive"><summary>Archivo de tickets revisados <span>${revisados.length}</span></summary>${revisados.map(t=>`<div class="mv"><div class="x"><b>${esc(t.comercio||t.nombre_archivo)}</b><br><small class="mu">${esc(t.estado)}</small></div><b class="amt">${euros(t.importe_centimos||0)}</b><a class="chip" target="_blank" href="/api/modulos/tesoreria/tickets/${t.id}">Ver</a></div>`).join('')||'<p class="mu">Todavía no hay tickets revisados.</p>'}</details>`;
  }
  if(TES_TAB==='pen') {
    const cuotas=d.cuotas_pendientes||[], cargos=d.cargos_pendientes||[];
    const personas=(d.hermanas||[]).map(h=>{
      const qs=cuotas.filter(x=>x.hermana_id===h.id&&Number(x.restante_centimos||0)>0);
      const cs=cargos.filter(x=>x.hermana_id===h.id&&Number(x.restante_centimos||0)>0);
      const importeCuotas=qs.reduce((a,x)=>a+Number(x.restante_centimos||0),0);
      const importe=(cat)=>cs.filter(x=>x.categoria===cat).reduce((a,x)=>a+Number(x.restante_centimos||0),0);
      const conceptos=(cat)=>cs.filter(x=>x.categoria===cat).map(x=>x.concepto).filter(Boolean);
      const cuaresma=importe('Cuaresma'), semana=importe('Semana Santa'), otros=importe('Otros');
      const detalleCuotas=qs.sort((a,b)=>a.periodo.localeCompare(b.periodo)).map(x=>{
        const [y,m]=String(x.periodo||'').split('-');
        const mes=y&&m?new Date(Number(y),Number(m)-1,1).toLocaleDateString('es-ES',{month:'short',year:'numeric'}):x.periodo;
        return mes+' · '+euros(x.restante_centimos);
      });
      return {id:h.id,nombre:h.nombre,cuotas:importeCuotas,detalleCuotas,cuaresma,semana,otros,
        notas:{cuaresma:conceptos('Cuaresma'),semana:conceptos('Semana Santa'),otros:conceptos('Otros')},
        total:importeCuotas+cuaresma+semana+otros};
    }).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));
    const conDeuda=personas.filter(x=>x.total>0);
    const alDia=personas.filter(x=>x.total===0);
    const suma=k=>personas.reduce((a,x)=>a+x[k],0);
    const eurCell=(n,detail='')=>n?'<b>'+euros(n)+'</b>'+(detail?'<br><small class="mu">'+esc(detail)+'</small>':''):'<span class="mu">—</span>';
    const rows=personas.map(p=>{
      const cuotaDetalle=p.detalleCuotas.join(' · ');
      const cuaresmaDetalle=p.notas.cuaresma.join(' · ');
      const semanaDetalle=p.notas.semana.join(' · ');
      const otrosDetalle=p.notas.otros.join(' · ');
      return '<tr class="'+(p.total?'':'tes-debt-paid')+'"><td><b>'+esc(p.nombre)+'</b></td>'+
        '<td class="r">'+eurCell(p.cuotas,cuotaDetalle)+'</td>'+
        '<td class="r">'+eurCell(p.cuaresma,cuaresmaDetalle)+'</td>'+
        '<td class="r">'+eurCell(p.semana,semanaDetalle)+'</td>'+
        '<td class="r">'+eurCell(p.otros,otrosDetalle)+'</td>'+
        '<td class="r"><b>'+euros(p.total)+'</b></td></tr>';
    }).join('');
    contenido=`<div class="kp tes-debt-kp"><div class="card"><span class="mu">Hermanas con deuda</span><b>${conDeuda.length}</b></div><div class="card"><span class="mu">Al día</span><b>${alDia.length}</b></div><div class="card"><span class="mu">Total pendiente</span><b>${euros(suma('total'))}</b></div></div>
    <div class="card wrap tes-debt-table"><div class="pr tes-debt-brand"><img src="/logo.png" alt="" style="height:42px"><div><h2>Las Tribulaciones de Sara</h2><p>Relación de cuotas y conceptos pendientes · ${new Date().toLocaleDateString('es-ES')}</p></div></div>
    <div class="row tes-debt-table-head"><div><div class="tag">Tesorería</div><h3 style="margin:0">Estado de cuentas por hermana</h3><p class="mu" style="margin:3px 0 0">Se incluyen cuotas mensuales y todos los cargos extraordinarios pendientes.</p></div><div class="wr noprint"><button class="btn" data-a="tes-export">Exportar PDF</button></div></div>
    <table class="rt"><thead><tr><th>Hermana</th><th class="r">Cuotas mensuales</th><th class="r">Cuaresma</th><th class="r">Semana Santa</th><th class="r">Otros conceptos</th><th class="r">Total</th></tr></thead>
    <tbody>${rows||'<tr><td colspan="6">No hay hermanas registradas.</td></tr>'}</tbody>
    <tfoot><tr><td>Total pendiente</td><td class="r">${euros(suma('cuotas'))}</td><td class="r">${euros(suma('cuaresma'))}</td><td class="r">${euros(suma('semana'))}</td><td class="r">${euros(suma('otros'))}</td><td class="r">${euros(suma('total'))}</td></tr></tfoot></table>
    <p class="mu tes-debt-foot">Los importes reflejan únicamente cantidades pendientes. Los pagos pendientes de validar no se descuentan hasta su confirmación.</p></div>`;
  }
  if(TES_TAB==='inf') {
    const desde=TES_REPORT_FROM, hasta=TES_REPORT_TO, anchor=d.saldo_inicial?.fecha||'2026-01-01';
    const todos=d.movimientos||[];
    const movimientosPeriodo=todos.filter(x=>x.fecha>=desde&&x.fecha<=hasta);
    const contabilizados=movimientosPeriodo.filter(x=>!x.traspaso_id&&(x.tipo==='ingreso'||x.tipo==='gasto'));
    const totalIngresos=contabilizados.filter(x=>x.tipo==='ingreso').reduce((n,x)=>n+Number(x.importe_centimos||0),0);
    const totalGastos=contabilizados.filter(x=>x.tipo==='gasto').reduce((n,x)=>n+Number(x.importe_centimos||0),0);
    const netoCuenta=(lista,cuenta)=>lista.filter(x=>x.cuenta===cuenta).reduce((n,x)=>n+(x.tipo==='ingreso'?1:-1)*Number(x.importe_centimos||0),0);
    const saldoEnFecha=(cuenta,fecha)=>{
      const inicial=Number(cuenta==='Banco'?d.saldo_inicial?.banco_centimos:d.saldo_inicial?.caja_centimos)||0;
      if(fecha>=anchor) return inicial+netoCuenta(todos.filter(x=>x.fecha>=anchor&&x.fecha<fecha),cuenta);
      return inicial-netoCuenta(todos.filter(x=>x.fecha>=fecha&&x.fecha<anchor),cuenta);
    };
    const saldoBancoInicio=saldoEnFecha('Banco',desde), saldoCajaInicio=saldoEnFecha('Caja fuerte',desde);
    const saldoBancoFin=saldoBancoInicio+netoCuenta(movimientosPeriodo,'Banco');
    const saldoCajaFin=saldoCajaInicio+netoCuenta(movimientosPeriodo,'Caja fuerte');
    const agrupar=(tipo)=>{const mapa={};contabilizados.filter(x=>x.tipo===tipo).forEach(x=>{const k=x.categoria||'Sin categoría';mapa[k]=(mapa[k]||0)+Number(x.importe_centimos||0);});return Object.entries(mapa).sort((a,b)=>b[1]-a[1]);};
    const filasCategorias=(arr,total)=>arr.map(x=>'<tr><td>'+esc(x[0])+'</td><td class="r">'+euros(x[1])+'</td><td class="r">'+(total?Math.round(x[1]/total*100)+' %':'—')+'</td></tr>').join('');
    const tabla=(titulo,cabeceras,filas,pie='')=>'<div class="card wrap"><h3>'+titulo+'</h3><table class="rt"><thead><tr>'+cabeceras.map((x,i)=>'<th class="'+(i?'r':'')+'">'+x+'</th>').join('')+'</tr></thead><tbody>'+(filas||'<tr><td colspan="'+cabeceras.length+'">Sin movimientos en este periodo.</td></tr>')+'</tbody>'+(pie?'<tfoot><tr>'+pie+'</tr></tfoot>':'')+'</table></div>';
    const ingresosCats=agrupar('ingreso'), gastosCats=agrupar('gasto');
    const detalle=contabilizados.slice().sort((a,b)=>a.fecha.localeCompare(b.fecha)||Number(a.id||0)-Number(b.id||0)).map(x=>'<tr><td>'+fechaBonita(x.fecha)+'</td><td>'+(x.tipo==='ingreso'?'Ingreso':'Gasto')+'</td><td>'+esc(x.concepto)+'</td><td>'+esc(x.categoria||'Sin categoría')+'</td><td>'+esc(x.cuenta||'—')+'</td><td class="r">'+(x.tipo==='ingreso'?'+':'−')+euros(x.importe_centimos)+'</td></tr>').join('');
    const saldos='<tr><td>Banco</td><td class="r">'+euros(saldoBancoInicio)+'</td><td class="r">'+euros(saldoBancoFin)+'</td></tr><tr><td>Caja fuerte</td><td class="r">'+euros(saldoCajaInicio)+'</td><td class="r">'+euros(saldoCajaFin)+'</td></tr><tr><td><b>Total disponible</b></td><td class="r"><b>'+euros(saldoBancoInicio+saldoCajaInicio)+'</b></td><td class="r"><b>'+euros(saldoBancoFin+saldoCajaFin)+'</b></td></tr>';
    contenido='<div class="pr tes-report-brand"><img src="/logo.png" style="height:48px"><h2 style="margin:6px 0 0">Las Tribulaciones de Sara</h2><p>Informe de Tesorería · '+fechaBonita(desde)+' – '+fechaBonita(hasta)+'</p></div>'+
      '<div class="tes-report-heading"><div><div class="tag">Tesorería · Presentación en junta</div><h2>Informe económico</h2><p>Consulta los ingresos, gastos y saldos correspondientes al periodo seleccionado.</p></div><div class="tes-report-period"><span>Periodo del informe</span><b>'+fechaBonita(desde)+' – '+fechaBonita(hasta)+'</b></div></div>'+
      '<form data-f="tes-report-range" class="card tes-report-range noprint"><div><div class="tag">Personalizar consulta</div><h3>Selecciona el rango de fechas</h3><p class="mu">Solo se incluirán los movimientos confirmados entre ambas fechas.</p></div><div class="tes-report-date"><label class="fl">Desde</label><input class="t" type="date" name="desde" required value="'+esc(desde)+'"></div><div class="tes-report-date"><label class="fl">Hasta</label><input class="t" type="date" name="hasta" required value="'+esc(hasta)+'"></div><div class="tes-report-actions"><button class="btn">Actualizar informe</button><button type="button" class="chip" data-a="tes-report-export">Generar PDF</button></div></form>'+
      '<div class="kp report-kp tes-report-kp"><div class="card"><span class="mu">Ingresos del periodo</span><b style="color:var(--ok)">'+euros(totalIngresos)+'</b></div><div class="card"><span class="mu">Gastos del periodo</span><b style="color:var(--ko)">'+euros(totalGastos)+'</b></div><div class="card"><span class="mu">Resultado</span><b>'+euros(totalIngresos-totalGastos)+'</b></div></div>'+
      '<div class="g2 tes-report-tables">'+
      tabla('Saldos de banco y caja',['Cuenta','Saldo inicial','Saldo final'],saldos)+
      tabla('Ingresos por categoría',['Categoría','Importe','%'],filasCategorias(ingresosCats,totalIngresos),'<td>Total ingresos</td><td class="r">'+euros(totalIngresos)+'</td><td class="r">100 %</td>')+
      tabla('Gastos por categoría',['Categoría','Importe','%'],filasCategorias(gastosCats,totalGastos),'<td>Total gastos</td><td class="r">'+euros(totalGastos)+'</td><td class="r">100 %</td>')+
      tabla('Detalle de movimientos',['Fecha','Tipo','Concepto','Categoría','Cuenta','Importe'],detalle)+'</div>'+
      '<p class="mu tes-report-note">El informe recoge ingresos y gastos confirmados. Los traspasos entre Banco y Caja no se consideran ingresos ni gastos, aunque sí se reflejan en los saldos de cada cuenta. El saldo inicial se calcula con los saldos de partida configurados y los movimientos anteriores al periodo.</p>';
  }
  const tabs=[['res','Estadísticas'],['mov','Movimientos'],['rec','Gastos fijos'],['pun','Por validar ('+(d.pagos_pendientes.length+(d.movimientos_pendientes||[]).length+d.tickets.filter(t=>t.estado==='pendiente'||(!t.estado&&!t.movimiento_id)).length)+')'],['gp','Gastos pendientes'],['pen','Cuotas pendientes'],['inf','Informe'],['cfg','Precios y cuota'],['imp','Importar']];
  return shell(`<div class="tesoreria"><div class="top tes-heading"><div><div class="tag">Gestión económica</div><h2>Tesorería</h2><p class="mu" style="margin:0">Control económico del cuartel · movimientos, pagos e informes.</p></div><div class="tes-pending-summary"><b>${d.pagos_pendientes.length+(d.movimientos_pendientes||[]).length+d.tickets.filter(t=>t.estado==='pendiente'||(!t.estado&&!t.movimiento_id)).length}</b><span>elementos por revisar</span></div></div>
  <section class="hero2 tes-balance"><div class="tes-balance-total"><span>Total disponible</span><b>${euros(saldo)}</b></div><div class="tes-balance-accounts"><div><small>Banco</small><b>${euros(d.totales.banco_centimos)}</b></div><div><small>Caja fuerte</small><b>${euros(d.totales.caja_centimos)}</b></div></div></section>
  ${subnav('tesoreria',TES_TAB,tabs)}
  <div class="tes-content">${contenido}</div></div>`);
}


function vPerfil() {
  const foto = ME.foto_id ? `<img src="/media/${Number(ME.foto_id)}" alt="Mi fotografía">` : `<span>${iniciales(ME.nombre)}</span>`;
  shell(`<div class="top"><div class="tag">Mi espacio</div><h2>Mi perfil</h2><p class="mu" style="margin:0">Mantén actualizados tus datos de contacto y tu fotografía.</p></div>
  <div class="profile-layout">
    <section class="card profile-card">
      <div class="profile-photo">${foto}</div>
      <div class="profile-heading"><h3>${esc(ME.nombre)}</h3><p class="mu">${esc(ME.cargo || 'Hermana')} · ${esc(ME.email || '')}</p></div>
      <form data-f="perfil-save">
        <label class="fl">Nombre y apellidos</label><input class="t" name="nombre" required maxlength="80" value="${esc(ME.nombre)}">
        <label class="fl">Teléfono de contacto</label><input class="t" name="telefono" type="tel" autocomplete="tel" placeholder="+34 600 000 000" value="${esc(ME.telefono || '')}">
        <label class="fl">Correo electrónico</label><input class="t" value="${esc(ME.email || '')}" disabled><small class="mu profile-help">El correo de acceso solo puede modificarlo la administración.</small>
        <label class="fl">Fotografía de perfil</label><input class="t profile-file" type="file" name="foto" accept="image/jpeg,image/png,image/webp">
        ${ME.foto_id ? '<label class="profile-remove"><input type="checkbox" name="quitar_foto"> Quitar mi fotografía actual</label>' : ''}
        <div class="profile-allergies">
          <div class="tag">Información para cocina</div><h3 style="margin:4px 0 5px">Mis alergias y preferencias</h3>
          <p class="mu profile-help">Se utilizarán como referencia en los próximos sábados. Si tienes una necesidad puntual, podrás modificarla al confirmar tu asistencia.</p>
          <div class="wr profile-allergy-tags">${ALERGIAS_TAGS.map(t=>`<label class="chip ${String(ME.alergias||'').split(/[,;\n]/).map(x=>x.trim()).includes(t)?'on':''}"><input type="checkbox" name="alergia_perfil" value="${esc(t)}" ${String(ME.alergias||'').split(/[,;\n]/).map(x=>x.trim()).includes(t)?'checked':''}> ${esc(t)}</label>`).join('')}</div>
          <p class="profile-allergy-feedback" data-profile-allergy-feedback role="status" aria-live="polite">${String(ME.alergias||'').split(/[,;\\n]/).map(x=>x.trim()).filter(Boolean).length ? String(ME.alergias||'').split(/[,;\\n]/).map(x=>x.trim()).filter(Boolean).length+' preferencias seleccionadas' : 'No has seleccionado ninguna alergia o preferencia.'}</p>
          <label class="fl">Otras alergias, intolerancias o indicaciones</label><textarea class="t" name="alergias_observaciones" rows="3" maxlength="1000" placeholder="Indica cualquier detalle importante para el turno de cocina">${esc(ME.alergias_observaciones||'')}</textarea>
        </div>
        <button class="btn" style="margin-top:16px">Guardar mis datos</button>
      </form>
    </section>
    <section class="card profile-security"><div class="tag">Seguridad</div><h3>Cambiar contraseña</h3><p class="mu">Utiliza una contraseña de al menos 8 caracteres.</p><form data-f="perfil">${campo('actual', 'Contraseña actual', 'type="password" autocomplete="current-password"')}${campo('nueva', 'Contraseña nueva', 'type="password" required minlength="8" autocomplete="new-password"')}<button class="btn" style="margin-top:16px">Actualizar contraseña</button></form></section>
  </div>`);
}

/* ---------- administración ---------- */
const PERM = { none: 'Solo zona hermana', tes: 'Tesorería', actas: 'Actas' };
const CUENTA = { sin: 'Sin invitar', invitada: 'Invitación preparada', activa: 'Cuenta activa' };
const TABS = [['noticias', 'Publicaciones'], ['historia', 'Historia'], ['actas', 'Actas'], ['eventos', 'Otros eventos'], ['cocina', 'Sorteo de turnos'], ['hermanas', 'Hermanas y cargos']];
const adm = (tab, html) => `<div class="admin-page-head"><a class="admin-back" href="#/admin">← Panel de administración</a><div class="tag">Gestión del cuartel</div><h2>${TABS.find(x=>x[0]===tab)?.[1] || 'Administración'}</h2></div><div class="sub admin-subnav">${TABS.map(([k,t])=>`<a class="${k===tab?'on':''}" href="#/admin/${k}">${t}</a>`).join('')}</div>${html}`;
function vAdminInicio() {
 const cards = [ ['Personas','Hermanas y cargos','Altas, bajas, fichas, cargos y permisos.','#/admin/hermanas'], ['Economía','Tesorería','Cuotas, pagos, ingresos, gastos e informes.','#/tesoreria'], ['Secretaría','Actas y convocatorias','Prepara juntas y consulta la documentación.','#/admin/actas'], ['Gestión','Sábados y cocina','Organiza los sábados, la asistencia y los turnos de cocina.','#/sabados'], ['Agenda','Otros eventos','Publica actos, cultos, Cruz de Mayo y convivencias.','#/admin/eventos'], ['Comunicación','Publicaciones','Publica noticias y crónicas.','#/admin/noticias'], ['Web','Historia','Edita los hitos históricos del cuartel.','#/admin/historia'] ];
 return shell(`<section class="admin-hub"><div class="tag">Panel privado</div><h2>Administración</h2><p class="mu admin-hub-intro">¿Qué necesitas gestionar hoy? Accede directamente a cada área del cuartel.</p><div class="admin-hub-grid">${cards.map(x=>`<a class="admin-hub-card" href="${x[3]}"><span>${x[0]}</span><strong>${x[1]}</strong><small>${x[2]}</small><b>Acceder →</b></a>`).join('')}</div><div class="admin-hub-footer"><button type="button" class="chip" data-a="cambiar-vista">Ver como hermana</button><a href="#/perfil">Mi perfil</a></div></section>`);
}
let EVENTO_EDITANDO=null;
async function vAdminEventos(){
  const lista=await api('GET','/modulos/eventos'), ed=EVENTO_EDITANDO;
  const tipos=[['cofradia','Acto de cofradía'],['cruz_mayo','Cruz de Mayo'],['cultos','Cultos'],['convivencia','Convivencia'],['otros','Otros']];
  const opciones=tipos.map(([k,v])=>`<option value="${k}" ${(ed?.tipo||'otros')===k?'selected':''}>${v}</option>`).join('');
  const form=`<div class="card"><div class="tag">Agenda general</div><h3>${ed?'Editar evento':'Añadir un evento'}</h3><p class="mu">Los eventos aparecerán en el calendario y en el inicio de la zona hermana. No generan cuotas, asistencias ni turnos de cocina.</p><form data-f="evento-save" ${ed?'data-id="'+ed.id+'"':''}>
    <div class="grid"><div>${campo('titulo','Nombre del evento','required maxlength="150" value="'+esc(ed?.titulo||'')+'"')}</div><div><label class="fl">Tipo de evento</label><select class="t" name="tipo">${opciones}</select></div>
    <div><label class="fl">Fecha</label><input class="t" type="date" name="fecha" required value="${esc(ed?.fecha||'')}" /></div><div>${campo('hora','Hora (opcional)','type="time" value="'+esc(ed?.hora||'')+'"')}</div>
    <div>${campo('lugar','Lugar (opcional)','maxlength="180" value="'+esc(ed?.lugar||'')+'"')}</div><div><label class="fl">Estado</label><select class="t" name="estado"><option value="publicado" ${ed?.estado!=='cancelado'?'selected':''}>Publicado</option><option value="cancelado" ${ed?.estado==='cancelado'?'selected':''}>Cancelado</option></select></div></div>
    <label class="fl">Descripción (opcional)</label><textarea class="t" name="descripcion" rows="3" maxlength="3000">${esc(ed?.descripcion||'')}</textarea><p style="margin-top:14px"><button class="btn">${ed?'Guardar cambios':'Publicar evento'}</button> ${ed?'<button type="button" class="chip" data-a="evento-edit-cancel">Cancelar edición</button>':''}</p></form></div>`;
  const rows=lista.length?lista.map(ev=>`<article class="mv"><div class="x"><b>${esc(ev.titulo)}</b><small class="mu">${esc(fechaBonita(ev.fecha))}${ev.hora?' · '+esc(ev.hora):''} · ${esc(tipos.find(t=>t[0]===ev.tipo)?.[1]||'Otros')}</small><small class="mu">${esc([ev.lugar,ev.descripcion].filter(Boolean).join(' · '))}</small></div><span class="pill ${ev.estado==='publicado'?'ok':''}">${ev.estado==='cancelado'?'Cancelado':'Publicado'}</span><button type="button" class="chip" data-a="evento-edit" data-id="${ev.id}">Editar</button>${ev.estado==='publicado'?`<button type="button" class="chip" data-a="evento-cancel" data-id="${ev.id}">Cancelar</button>`:''}</article>`).join(''):'<p class="mu">Todavía no hay eventos. Añade el primero desde el formulario.</p>';
  return shell(adm('eventos',form+`<div class="card" style="margin-top:15px"><h3>Eventos registrados</h3>${rows}</div>`));
}
async function vAdmin(tab) {
 if(tab==='') return vAdminInicio();
  if(tab==='eventos') return await vAdminEventos();
  if(tab==='actas') return await vActas();
  if(tab==='cocina') {
    const d=await api('GET','/modulos/cocina');
    const sabados=await api('GET','/modulos/sabados');
    const futuras=sabados.filter(x=>x.fecha>=new Date().toISOString().slice(0,10)&&x.estado!=='cancelado');
    const turnos=d.turnos.filter(t=>t.fecha>=new Date().toISOString().slice(0,10));
    const turnosAsignados=turnos.filter(t=>d.asignaciones.some(a=>Number(a.turno_id)===Number(t.id)));
    const turnosPendientes=turnos.filter(t=>!d.asignaciones.some(a=>Number(a.turno_id)===Number(t.id)));
    return shell(adm(tab,`<div class="card"><h3>Sorteo de turnos de cocina</h3><p class="mu">Reparte las hermanas activas entre los próximos sábados de forma equilibrada. Puedes elegir dos o tres personas por turno y ajustar las asignaciones después.</p><form data-f="cocina-sorteo"><div class="row" style="align-items:center"><span class="mu">Personas por turno</span><select class="t" name="personas_por_turno" style="max-width:180px"><option value="2" ${Number(d.personas_por_turno||2)===2?'selected':''}>2 personas</option><option value="3" ${Number(d.personas_por_turno||2)===3?'selected':''}>3 personas</option></select><button class="btn">Hacer sorteo</button></div></form><small class="mu">${futuras.length} sábados futuros disponibles.</small></div>
     ${turnosAsignados.length?`<div class="card cocina-draw-results" style="margin-top:14px"><div class="tag">${COCINA_SORTEO_RESULTADO.length?'Resultado del sorteo':'Asignaciones guardadas'}</div><h3>Turnos asignados</h3><p class="mu">${turnosAsignados.length} sábado(s) con hermanas asignadas. Las selecciones se conservan aunque salgas de esta pantalla.</p>${turnosAsignados.map(t=>{const asignadas=d.asignaciones.filter(a=>Number(a.turno_id)===Number(t.id));return '<div class="cocina-draw-row"><div><b>'+esc(t.titulo||t.turno||'Sábado')+'</b><small class="mu">'+fechaBonita(t.fecha)+'</small></div><form data-f="cocina-asignar" data-id="'+t.id+'" class="cocina-draw-selects">'+selectsAsignacionCocina(d,asignadas)+'<button class="chip on">Guardar</button></form></div>';}).join('')}</div>`:'<div class="card cocina-draw-results" style="margin-top:14px"><h3>Resultado del sorteo</h3><p class="mu">Todavía no hay turnos asignados. Realiza el sorteo para ver aquí el resultado.</p></div>'}
     <div class="card" style="margin-top:14px"><h3>Turnos pendientes de asignación</h3>${turnosPendientes.length?turnosPendientes.map(t=>{const asignadas=d.asignaciones.filter(a=>Number(a.turno_id)===Number(t.id));return '<div class="mv" style="flex-wrap:wrap"><div class="x"><b>'+esc(t.titulo||t.turno||'Sábado')+'</b><br><small class="mu">'+fechaBonita(t.fecha)+'</small></div><form data-f="cocina-asignar" data-id="'+t.id+'" style="flex:1 1 100%"><div class="grid">'+selectsAsignacionCocina(d,asignadas)+'</div><button class="chip on" style="margin-top:10px">Guardar asignación</button></form></div>';}).join(''):'<p class="mu">Todos los sábados futuros tienen asignación.</p>'}</div>`));
  }
  if(tab==='cargos') { ADMIN_HERM_TAB='car'; tab='hermanas'; }
  if(tab==='hermanas') {
    const [hs,cs]=await Promise.all([api('GET','/admin/hermanas'),api('GET','/admin/cargos')]);
    const activas=hs.filter(h=>h.estado==='Activa').length,pasivas=hs.filter(h=>h.estado==='Pasiva').length,bajas=hs.filter(h=>h.estado==='Baja').length,visibles=hs.filter(h=>h.visible_web&&h.estado!=='Baja').length;
    let cuerpo='';
    if(ADMIN_HERM_TAB==='her') cuerpo=`<div class="kp"><div class="card"><span class="mu">Activas</span><b>${activas}</b></div><div class="card"><span class="mu">Pasivas</span><b>${pasivas}</b></div><div class="card"><span class="mu">Bajas</span><b>${bajas}</b></div><div class="card"><span class="mu">Visibles en la web</span><b>${visibles}</b></div></div><div class="card" style="margin-top:14px"><p class="mu">Cada hermana entra con su correo y una contraseña que crea ella misma. Las bajas pierden el acceso, pero su historial se conserva. Para que aparezcan en la web, activa «Aparece en la web» en su ficha.</p><p><button type="button" class="chip" data-a="her-publicar-activas">Mostrar todas las hermanas activas en la web</button></p><h3>Nueva hermana</h3><form data-f="her-new"><div class="row" style="align-items:flex-end"><div style="flex:2 1 200px">${campo('nombre','Nombre y apellidos','required')}</div><div style="flex:2 1 220px">${campo('email','Correo electrónico','type="email"')}</div><div style="flex:1 1 150px"><label class="fl">Cargo</label><select class="t" name="cargo_id">${cs.map(c=>`<option value="${c.id}" ${c.nombre==='Hermana'?'selected':''}>${esc(c.nombre)}</option>`).join('')}</select></div><div style="flex:0 0 110px">${campo('anio_entrada','Año de entrada','type="number" min="1900" max="2100"')}</div><label class="mu" style="font-size:13px"><input type="checkbox" name="visible_web" checked> Mostrar en la web</label><button class="btn">Añadir</button></div></form></div><div style="height:14px"></div>${hs.map(h=>rowHer(h,cs)).join('')}`;
    if(ADMIN_HERM_TAB==='car') cuerpo=`<div class="card"><p class="mu">Cada junta puede crear los cargos que necesite y decidir qué puede hacer cada uno.</p>${cs.map(c=>`<form class="mv" data-f="cargo-save" data-id="${c.id}" style="flex-wrap:wrap;gap:8px"><input class="t" name="nombre" value="${esc(c.nombre)}" style="flex:1 1 160px" required><select class="t" name="permiso" style="width:200px">${Object.entries(PERM).map(([k,v])=>`<option value="${k}" ${c.permiso===k?'selected':''}>${v}</option>`).join('')}</select><span class="mu" style="font-size:13px;width:90px">${c.usos} hermanas</span><button class="chip on">Guardar</button>${c.nombre==='Hermana'?'':`<button type="button" class="chip" data-a="cargo-del" data-id="${c.id}">Borrar</button>`}</form>`).join('')}</div><div class="card" style="margin-top:14px"><h3>Nuevo cargo</h3><form data-f="cargo-new"><div class="row"><div style="flex:2 1 200px">${campo('nombre','Nuevo cargo','required placeholder="Ej.: Camarera"')}</div><div style="flex:1 1 200px"><label class="fl">Permisos</label><select class="t" name="permiso">${Object.entries(PERM).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div><button class="btn">Añadir cargo</button></div></form></div>`;
    if(ADMIN_HERM_TAB==='mail') {
      const pendientes=hs.filter(h=>h.estado!=='Baja'&&h.telefono&&h.cuenta!=='activa');
      cuerpo=`<div class="card"><h3>Bienvenida por WhatsApp</h3><p class="mu">Prepara un mensaje individual con el enlace personal para crear la contraseña. Se abrirá WhatsApp para que puedas revisarlo y pulsar Enviar. El enlace caduca a los siete días.</p>${pendientes.length?pendientes.map(h=>`<div class="mv"><div class="x"><b>${esc(h.nombre)}</b><br><small class="mu">${esc(h.telefono)}</small></div><span class="pill">${h.cuenta==='invitada'?'Bienvenida preparada':'Sin invitar'}</span><button class="chip on" data-a="her-invitar" data-id="${h.id}">${h.cuenta==='invitada'?'Reenviar bienvenida':'Enviar por WhatsApp'}</button></div>`).join(''):'<p class="mu">Todas las hermanas con teléfono tienen su cuenta activa.</p>'}</div>`;
    }
    return shell(adm('hermanas',subnav('adminher',ADMIN_HERM_TAB,[['her','Hermanas y estado'],['car','Cargos y permisos'],['mail','WhatsApp']])+cuerpo));
  }
  if(tab==='noticias') {
    const d=await api('GET','/admin/noticias');
    const ed=NOTICIA_EDITANDO;
    const formId=ed ? 'noticia-save' : 'noticia-new';
    return shell(adm(tab,`<div class="card"><h3>${ed?'Editar publicación':'Publicar contenido'}</h3><form data-f="${formId}" ${ed?'data-id="'+ed.id+'"':''}>
      <label class="fl">Tipo de publicación</label><select class="t" name="tipo"><option value="noticia" ${ed?.tipo!=='cronica'?'selected':''}>Noticia</option><option value="cronica" ${ed?.tipo==='cronica'?'selected':''}>Crónica de un sábado</option></select>
      ${campo('titulo','Título','required maxlength="150" value="'+esc(ed?.titulo||'')+'"')}
      <label class="fl">Fecha de publicación</label><input class="t" type="date" name="fecha" required value="${esc(ed?.fecha||fechaHoyLocal())}">
      <label class="fl">Texto</label><textarea class="t" name="texto" rows="6" required maxlength="6000">${esc(ed?.texto||'')}</textarea>
      ${campo('url','Enlace a Instagram o Facebook','type="url" placeholder="https://www.instagram.com/p/… o https://www.facebook.com/…" value="'+esc(ed?.url||'')+'"')}
      <small class="mu" style="display:block;margin-top:-8px;margin-bottom:12px">Opcional. La publicación aparecerá en la sección correspondiente.</small>
      ${ed?.imagen?`<div class="row" style="align-items:center;margin:10px 0"><img src="/media/${ed.imagen}" alt="" style="width:76px;height:76px;object-fit:cover;border-radius:10px"><label class="mu"><input type="checkbox" name="quitar_imagen"> Quitar fotografía actual</label></div>`:''}
      <label class="fl">${ed?.imagen?'Cambiar fotografía':'Fotografía (opcional)'}</label><input type="file" name="foto" accept="image/*">
      <p style="margin:18px 0 0"><button class="btn">${ed?'Guardar cambios':'Publicar en la web'}</button> ${ed?'<button type="button" class="chip" data-a="noticia-edit-cancel">Cancelar</button>':''}</p>
    </form></div><div class="card" style="margin-top:16px"><h3>Publicaciones realizadas</h3>${d.map(n=>`<div class="mv">${n.imagen?`<img src="/media/${n.imagen}" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:10px">`:''}<div class="x"><b>${n.tipo==='cronica'?'CRÓNICA':'NOTICIA'} · ${esc(n.titulo)}</b><br><small class="mu">${esc(n.fecha)}</small><br><a href="/${n.tipo==='cronica'?'cronicas':'noticias'}/${n.id}/" target="_blank" rel="noopener noreferrer" class="mu">Ver en la web ↗</a>${n.url?`<br><a href="${esc(n.url)}" target="_blank" rel="noopener noreferrer" class="mu">Abrir publicación ↗</a>`:''}</div><button class="chip" data-a="noticia-edit" data-id="${n.id}">Editar</button><button class="chip" data-a="noticia-del" data-id="${n.id}">Eliminar</button></div>`).join('')||'<p class="mu">Todavía no hay publicaciones.</p>'}</div>`));
  }
  if(tab==='historia') {
    const d=await api('GET','/public');
    return shell(adm(tab,`<div class="card"><h3>Línea de tiempo de la historia</h3><p class="mu">Cada hito aparece en la web pública, junto a la historia del cuartel.</p><form data-f="historia"><div id="hitos">${d.hitos.map(hitoRow).join('')}</div><p style="margin:14px 0 0"><button type="button" class="chip" data-a="hito-add">Añadir hito</button> <button class="btn">Guardar</button></p></form></div>`));
  }
  location.hash='#/admin/hermanas';
}
const hitoRow = h => `<div class="row" style="margin-bottom:12px;align-items:flex-start"><input class="t" name="anio" style="width:90px" value="${esc(h.anio)}" placeholder="Año"><textarea class="t" name="texto" rows="2" style="flex:1;min-width:200px" placeholder="Qué pasó">${esc(h.texto)}</textarea><button type="button" class="chip" data-a="hito-del">✕</button></div>`;
function rowHer(h, cs) {
  const puedeInvitar=h.estado!=='Baja'&&!!h.telefono;
  return `<form class="card" data-f="her-save" data-id="${h.id}" style="margin-bottom:12px${h.estado==='Baja'?';opacity:.65':''}">
  <div class="row" style="align-items:flex-end"><div style="flex:2 1 190px">${campo('nombre','Nombre','required value="'+esc(h.nombre)+'"')}</div><div style="flex:2 1 200px">${campo('email','Correo','type="email" value="'+esc(h.email||'')+'"')}</div><div style="flex:2 1 190px">${campo('telefono','WhatsApp','type="tel" placeholder="+34 600 000 000" value="'+esc(h.telefono||'')+'"')}</div><div style="flex:1 1 145px"><label class="fl">Cargo</label><select class="t" name="cargo_id">${cs.map(c=>`<option value="${c.id}" ${c.id===h.cargo_id?'selected':''}>${esc(c.nombre)}</option>`).join('')}</select></div><div style="flex:1 1 115px"><label class="fl">Estado</label><select class="t" name="estado">${['Activa','Pasiva','Baja'].map(e=>`<option ${e===h.estado?'selected':''}>${e}</option>`).join('')}</select></div><div style="flex:0 0 110px">${campo('anio_entrada','Año de entrada','type="number" min="1900" max="2100" value="'+(h.anio_entrada||'')+'"')}</div></div>
  <div class="row" style="align-items:center;margin-top:12px"><div class="av" style="margin:0;width:56px;height:56px;font-size:18px">${h.foto?`<img src="/media/${h.foto}" alt="">`:iniciales(h.nombre)}</div><div style="flex:1 1 200px"><label class="fl">Foto</label><input type="file" name="foto" accept="image/*" style="font-size:13px"></div>${h.foto?`<button type="button" class="chip" data-a="her-quitar-foto" data-id="${h.id}">Quitar foto</button>`:''}<label class="mu" style="font-size:13px"><input type="checkbox" name="visible_web" ${h.visible_web?'checked':''}> Aparece en la web</label><label class="mu" style="font-size:13px"><input type="checkbox" name="es_admin" ${h.es_admin?'checked':''}> Administradora</label></div>
  <div class="row" style="align-items:center;margin-top:14px"><button class="btn" style="padding:9px 20px">Guardar</button><span class="pill ${h.cuenta==='activa'?'ok':''}">${CUENTA[h.cuenta]}</span>${puedeInvitar?(h.cuenta==='activa'?`<button type="button" class="chip" data-a="her-reset" data-id="${h.id}">Restablecer contraseña por correo</button>`:`<button type="button" class="chip" data-a="her-invitar" data-id="${h.id}">${h.cuenta==='invitada'?'Reenviar bienvenida por WhatsApp':'Enviar bienvenida por WhatsApp'}</button>`):''}</div></form>`;
}

/* ---------- acciones ---------- */
const FORM = {
  async login(f, d) { await api('POST', '/auth/login', { email: d.get('email'), password: d.get('password') }); await entrar(); },
  async clave(f, d) { if (d.get('p1') !== d.get('p2')) throw new Error('Las contraseñas no coinciden'); await api('POST', '/auth/password/set', { token: f.dataset.t, password: d.get('p1') }); await entrar(); },
  async setup(f, d) { await api('POST', '/setup', { key: d.get('key'), password: d.get('p1') }); await entrar(); },
  async perfil(f, d) { await api('POST', '/auth/password/change', { actual: d.get('actual'), nueva: d.get('nueva') }); f.reset(); toast('Contraseña cambiada'); },
  async 'perfil-save'(f, d) {
    const b = { nombre:d.get('nombre'), telefono:d.get('telefono'), quitar_foto:d.get('quitar_foto')==='on',
      alergias:d.getAll('alergia_perfil').join(', '), alergias_observaciones:d.get('alergias_observaciones') };
    const file=d.get('foto'); if(file && file.size) b.foto=await reducir(file,480,0.84);
    await api('POST','/perfil',b);
    ME_REAL=await api('GET','/me'); aplicarVista(); toast('Perfil actualizado'); render();
  },
  async 'her-new'(f, d) { await api('POST', '/admin/hermanas', { nombre: d.get('nombre'), email: d.get('email'), cargo_id: +d.get('cargo_id'), anio_entrada: d.get('anio_entrada') || null, visible_web: d.get('visible_web')==='on' }); toast('Hermana añadida'); render(); },
  async 'her-save'(f, d) {
    const b = { nombre: d.get('nombre'), email: d.get('email'), telefono: d.get('telefono'), cargo_id: +d.get('cargo_id'), estado: d.get('estado'), anio_entrada: d.get('anio_entrada') ? +d.get('anio_entrada') : null, visible_web: !!d.get('visible_web'), es_admin: !!d.get('es_admin') };
    const fl = d.get('foto'); if (fl && fl.size) b.foto = await reducir(fl, 480);
    await api('PUT', '/admin/hermanas/' + f.dataset.id, b); toast('Guardado'); render();
  },
  async 'cargo-new'(f, d) { await api('POST', '/admin/cargos', { nombre: d.get('nombre'), permiso: d.get('permiso') }); toast('Cargo creado'); render(); },
  async 'cargo-save'(f, d) { await api('PUT', '/admin/cargos/' + f.dataset.id, { nombre: d.get('nombre'), permiso: d.get('permiso') }); toast('Guardado'); render(); },
  async 'evento-save'(f,d) { const b={titulo:d.get('titulo'),tipo:d.get('tipo'),fecha:d.get('fecha'),hora:d.get('hora'),lugar:d.get('lugar'),descripcion:d.get('descripcion'),estado:d.get('estado')}; if(f.dataset.id) await api('PUT','/modulos/eventos/'+f.dataset.id,b); else await api('POST','/modulos/eventos',b); EVENTO_EDITANDO=null; toast(f.dataset.id?'Evento actualizado':'Evento publicado'); render(); },
  async 'noticia-new'(f, d) { const b = { tipo:d.get('tipo'), titulo:d.get('titulo'), texto:d.get('texto'), fecha:d.get('fecha'), url:d.get('url') }; const fl=d.get('foto'); if(fl&&fl.size)b.imagen=await reducir(fl,1400,0.8); await api('POST','/admin/noticias',b); toast(b.tipo==='cronica'?'Crónica publicada.':'Noticia publicada.'); render(); },
  async 'noticia-save'(f,d) { const b={tipo:d.get('tipo'),titulo:d.get('titulo'),texto:d.get('texto'),fecha:d.get('fecha'),url:d.get('url'),quitar_imagen:d.get('quitar_imagen')==='on'}; const fl=d.get('foto'); if(fl&&fl.size)b.imagen=await reducir(fl,1400,0.8); await api('PUT','/admin/noticias/'+f.dataset.id,b); NOTICIA_EDITANDO=null; toast('Publicación actualizada'); render(); },
  async 'sabado-new'(f,d) { await api('POST','/modulos/sabados',{fecha:d.get('fecha'),hora:d.get('hora'),titulo:d.get('titulo'),categoria:d.get('categoria'),descripcion:d.get('descripcion')}); toast('Sábado creado'); render(); },
  async 'sabado-rsvp'(f,d) {
    if(d.get('asiste')!=='1' && d.get('asiste')!=='0') throw new Error('Selecciona si vas a asistir o no antes de guardar.');
    const personas=[];
    const propias=d.getAll('alergia_hermana_0');
    const notaPropia=d.get('alergia_extra_hermana_0')||'';
    personas.push({tipo:'hermana',numero:0,alergias:propias.join(', '),observaciones:notaPropia});
    const invitadas=Math.max(0,Math.min(20,Number(d.get('acompanantes')||0)));
    for(let i=1;i<=invitadas;i++){
      const alergias=d.getAll('alergia_invitada_'+i),observaciones=d.get('alergia_extra_invitada_'+i)||'';
      if(alergias.length||observaciones.trim()) personas.push({tipo:'invitada',numero:i,alergias:alergias.join(', '),observaciones});
    }
    await api('POST','/modulos/sabados/'+f.dataset.id+'/asistencia',{asiste:d.get('asiste')==='1',acompanantes:invitadas,personas,observaciones:d.get('observaciones')});
    toast('Asistencia guardada'); render();
  },
  async 'sabado-consumos'(f,d) { await api('POST','/modulos/sabados/'+f.dataset.id+'/consumos',{copas:d.get('copas'),refrescos:d.get('refrescos')}); toast('Consumiciones guardadas'); render(); },
  async 'cuenta-pago'(f,d) { await api('POST','/modulos/cuenta/pagos',{categoria:d.get('categoria'),importe:d.get('importe'),fecha_pago:d.get('fecha_pago'),metodo:d.get('metodo'),concepto:d.get('concepto')}); PAGO_MODAL=false; toast('Pago registrado y pendiente de revisión'); render(); },
  async 'cocina-new'(f,d) { await api('POST','/modulos/cocina',{fecha:d.get('fecha'),turno:d.get('turno'),responsable:d.get('responsable'),presupuesto:d.get('presupuesto'),menu:d.get('menu'),observaciones:d.get('observaciones')}); toast('Turno añadido'); render(); },
  async 'cocina-cambio'(f,d) { const id=f.dataset.id; const hermana_id=d.get('hermana_id'); if(!hermana_id) throw new Error('Selecciona la hermana que te sustituye'); if(!await confirmarAccion('La otra hermana quedará asignada en tu lugar. ¿Confirmas el cambio de turno?','Confirmar cambio')) return; await api('POST','/modulos/cocina/'+id+'/cambio',{hermana_id:Number(hermana_id)}); toast('Cambio de turno registrado'); render(); },
  async 'cocina-intercambio'(f,d) { const partes=String(d.get('destino')||'').split(':').map(Number); if(partes.length!==2||!partes[0]||!partes[1]) throw new Error('Selecciona el sábado y la hermana con quien intercambiar'); if(!await confirmarAccion('Se intercambiarán las asignaciones de los dos sábados. ¿Quieres continuar?','Confirmar intercambio')) return; await api('POST','/modulos/cocina/'+f.dataset.id+'/intercambio',{turno_destino_id:partes[0],hermana_destino_id:partes[1]}); toast('Intercambio de sábados registrado'); render(); },
  async 'cocina-asignar'(f,d) { await api('PUT','/modulos/cocina/'+f.dataset.id+'/asignacion',{hermanas:d.getAll('hermana')}); toast('Asignación de cocina guardada'); render(); },
  async 'cocina-edit'(f,d) { await api('PUT','/modulos/cocina/'+f.dataset.id,{fecha:d.get('fecha'),turno:d.get('turno'),responsable:d.get('responsable'),presupuesto:d.get('presupuesto'),menu:d.get('menu'),observaciones:d.get('observaciones')}); toast('Turno actualizado'); render(); },
  async 'cocina-ticket'(f,d) { const file=d.get('ticket'); if(!file || !file.size) throw new Error('Selecciona un ticket'); if(file.size>1024*1024) throw new Error('El archivo no puede superar 1 MB'); const datos=await readFileData(file); await api('POST','/modulos/cocina/tickets',{turno_cocina_id:d.get('turno_cocina_id')||null,nombre_archivo:file.name,comercio:d.get('comercio'),importe:d.get('importe'),forma_pago:d.get('forma_pago'),datos}); toast('Ticket enviado a Tesorería'); render(); },
  async alergias(f,d) { await api('PUT','/modulos/alergias',{alergias:d.getAll('alergia').concat(d.get('alergias')||'').filter(Boolean).join(', '),observaciones:d.get('observaciones')}); toast('Información guardada'); render(); },
  async 'junta-new'(f,d) { const r=await api('POST','/modulos/actas/juntas',{fecha:d.get('fecha'),hora:d.get('hora'),lugar:d.get('lugar'),convocatoria:d.get('convocatoria'),orden_dia:d.get('orden_dia')}); toast(r.correo_aviso||('Junta convocada · '+r.correos_enviados+' correos enviados'),!!r.correo_aviso); render(); },
  async 'junta-edit'(f,d) { await api('PUT','/modulos/actas/juntas/'+f.dataset.id,{fecha:d.get('fecha'),hora:d.get('hora'),lugar:d.get('lugar'),estado:d.get('estado'),convocatoria:d.get('convocatoria'),orden_dia:d.get('orden_dia')}); toast('Convocatoria actualizada'); render(); },
  async 'acta-historica'(f,d) { await api('POST','/modulos/actas/juntas/historica',{fecha:d.get('fecha'),lugar:d.get('lugar'),orden_dia:d.get('orden_dia')}); toast('Acta anterior incorporada al archivo'); render(); },
  async 'acta-pdf'(f,d) { const file=d.get('archivo'); if(!file||!file.size) throw new Error('Selecciona el PDF del acta'); if(file.size>1024*1024) throw new Error('El PDF no puede superar 1 MB'); const datos=await readFileData(file); await api('PUT','/modulos/actas/juntas/'+f.dataset.id+'/archivo',{nombre:file.name,datos}); toast('PDF del acta guardado'); render(); },
  async 'acta-save'(f,d) { await api('PUT','/modulos/actas/juntas/'+f.dataset.id+'/acta',{texto:d.get('texto'),acuerdos:d.get('acuerdos')}); toast('Acta guardada'); render(); },
  async estatutos(f,d) { const file=d.get('archivo'); if(!file||!file.size) throw new Error('Selecciona el PDF de los estatutos'); if(file.size>1024*1024) throw new Error('El PDF no puede superar 1 MB'); const datos=await readFileData(file); await api('PUT','/modulos/actas/estatutos',{nombre:file.name,datos}); toast('Estatutos publicados'); render(); },
  async 'junta-asistencia'(f,d) { await api('PUT','/modulos/actas/juntas/'+f.dataset.id+'/asistencia',{hermanas:d.getAll('hermana')}); toast('Asistencia actualizada'); render(); },
  async 'tes-config'(f,d) { await api('PUT','/modulos/tesoreria/config',{cuota_mensual:d.get('cuota_mensual'),sabado_precio:d.get('sabado_precio'),invitada_precio:d.get('invitada_precio'),copa_precio:d.get('copa_precio'),refresco_precio:d.get('refresco_precio'),cocina_precio_persona:d.get('cocina_precio_persona'),personas_por_turno:d.get('personas_por_turno')}); toast('Parámetros guardados'); render(); },
  async 'tes-extras'(f) { const cuotas_extraordinarias=[...f.querySelectorAll('.extra-row')].map(r=>({nombre:r.querySelector('[name=nombre]').value,categoria:r.querySelector('[name=categoria]').value,importe:r.querySelector('[name=importe]').value,tipo:r.querySelector('[name=tipo]').value})); await api('PUT','/modulos/tesoreria/config',{cuotas_extraordinarias}); toast('Cuotas extraordinarias guardadas'); render(); },
  async 'cocina-sorteo'(f,d) { const r=await api('POST','/modulos/cocina/sorteo',{personas_por_turno:d.get('personas_por_turno')}); COCINA_SORTEO_RESULTADO=r.asignaciones||[]; toast('Sorteo realizado: '+r.turnos_sorteados+' turnos'+(r.turnos_omitidos?' · '+r.turnos_omitidos+' ya tenían asignación y se han conservado':'')); render(); },
  async 'cocina-sorteo-del'(el) { if(!await confirmarAccion('Se borrarán las asignaciones de todos los turnos de cocina futuros. Los sábados, los turnos y los tickets se conservarán. Esta acción no se puede deshacer.','Sí, eliminar sorteo')) return; const r=await api('DELETE','/modulos/cocina/sorteo'); COCINA_SORTEO_RESULTADO=[]; toast('Sorteo eliminado · '+r.asignaciones_eliminadas+' asignaciones borradas'); render(); },
  async 'tes-report-range'(f,d) { const desde=String(d.get('desde')||''),hasta=String(d.get('hasta')||''); if(!/^\d{4}-\d{2}-\d{2}$/.test(desde)||!/^\d{4}-\d{2}-\d{2}$/.test(hasta)||desde>hasta) throw new Error('Revisa las fechas: la fecha inicial no puede ser posterior a la final.'); TES_REPORT_FROM=desde; TES_REPORT_TO=hasta; render(); },
  async 'tes-filtro'(f,d) { TES_FILTRO={tipo:d.get('tipo')||'todos',texto:d.get('texto')||'',desde:d.get('desde')||'',hasta:d.get('hasta')||'',cuenta:d.get('cuenta')||'',hermana:d.get('hermana')||'',anio:d.get('anio')||'',categoria:d.get('categoria')||''}; if(TES_FILTRO.desde && TES_FILTRO.hasta && TES_FILTRO.desde>TES_FILTRO.hasta) throw new Error('La fecha inicial no puede ser posterior a la final'); render(); },
  async 'tes-movimiento'(f,d) { await api('POST','/modulos/tesoreria/movimientos',{tipo:d.get('tipo'),fecha:d.get('fecha'),concepto:d.get('concepto'),categoria:d.get('categoria'),cuenta:d.get('cuenta'),importe:d.get('importe')}); TES_MOV_MODAL=false; toast('Movimiento registrado'); render(); },
  async 'tes-traspaso'(f,d) { await api('POST','/modulos/tesoreria/traspasos',{fecha:d.get('fecha'),importe:d.get('importe'),origen:d.get('origen'),destino:d.get('destino')}); TES_TRANSFER_MODAL=false; toast('Traspaso registrado'); render(); },
  async 'tes-saldos'(f,d) { await api('PUT','/modulos/tesoreria/config',{saldo_inicial:{fecha:d.get('fecha'),banco:d.get('banco'),caja:d.get('caja')}}); toast('Saldos iniciales guardados'); render(); },
  async 'tes-fijo'(f,d) { await api('POST','/modulos/tesoreria/gastos-fijos',{concepto:d.get('concepto'),categoria:d.get('categoria'),importe:d.get('importe'),periodicidad:d.get('periodicidad'),dia:d.get('dia'),mes:d.get('mes'),cuenta:d.get('cuenta'),variable:d.has('variable')}); TES_NEW_FIXED_MODAL=false; toast('Gasto fijo añadido'); render(); },
  async 'tes-fijo-edit'(f,d) { await api('PUT','/modulos/tesoreria/gastos-fijos/'+f.dataset.id,{concepto:d.get('concepto'),categoria:d.get('categoria'),importe:d.get('importe'),periodicidad:d.get('periodicidad'),dia:d.get('dia'),mes:d.get('mes'),cuenta:d.get('cuenta'),variable:d.has('variable'),activo:d.has('activo')}); toast('Gasto fijo actualizado'); render(); },
  async 'tes-fijo-registrar'(f,d) { await api('POST','/modulos/tesoreria/gastos-fijos/'+f.dataset.id+'/registrar',{periodo:d.get('periodo'),importe:d.get('importe')}); toast('Gasto fijo enviado a validación'); render(); },
  async 'tes-ticket'(f,d) { const file=d.get('ticket'); if(!file || !file.size) throw new Error('Selecciona un ticket'); if(file.size>1024*1024) throw new Error('El archivo no puede superar 1 MB'); const datos=await readFileData(file); await api('POST','/modulos/tesoreria/tickets',{movimiento_id:d.get('movimiento_id')||null,sabado_id:d.get('sabado_id')||null,nombre_archivo:file.name,datos}); toast('Ticket guardado'); render(); },
  async 'tes-ticket-link'(f,d) { await api('PUT','/modulos/tesoreria/tickets/'+f.dataset.id,{movimiento_id:d.get('movimiento_id')||null}); toast('Ticket vinculado al movimiento'); render(); },
  async 'tes-ticket-review'(f,d) { await api('PUT','/modulos/tesoreria/tickets/'+f.dataset.id,{incluir:true,categoria:d.get('categoria'),cuenta:d.get('cuenta'),importe:d.get('importe')}); toast('Gasto incluido en contabilidad'); render(); },
  async historia(f) { const hitos = [...f.querySelectorAll('#hitos .row')].map(r => ({ anio: r.querySelector('[name=anio]').value, texto: r.querySelector('[name=texto]').value })); const r = await api('PUT', '/admin/hitos', { hitos }); toast(`Guardado (${r.total} hitos)`); render(); },
};

function actualizarResumenRSVP(form) {
  const cantidad=Number(form.querySelector('[name=acompanantes]').value||0);
  const respuesta=form.querySelector('[name=asiste]').value;
  const asiste=respuesta==='1';
  const respondida=respuesta==='1'||respuesta==='0';
  const precioSabado=Number(form.dataset.precioSabado||0);
  const precioInvitada=Number(form.dataset.precioInvitada||0);
  const plazasOtras=Number(form.dataset.plazasOtras||0);
  const total=(asiste?precioSabado:0)+cantidad*precioInvitada;
  const plazas=plazasOtras+(asiste?1:0)+cantidad;
  const resumen=form.querySelector('[data-rsvp-summary]');
  const importe=form.querySelector('[data-rsvp-total]');
  const barra=form.querySelector('[data-rsvp-seats-bar]');
  const etiqueta=form.querySelector('[data-rsvp-seats-label]');
  if(resumen) resumen.textContent=!respondida?'Selecciona si vas a asistir':(asiste?'Asistencia confirmada':'Has indicado que no vas')+(cantidad?' · '+cantidad+' invitada(s) × '+euros(precioInvitada):'');
  if(importe) importe.textContent=!respondida&&!cantidad?'—':euros(total);
  if(barra) barra.style.width=Math.min(100,plazas/40*100)+'%';
  if(etiqueta) etiqueta.textContent=plazas+' de 40 plazas ocupadas';
}

const ACT = {
  'tes-mov-open'() { TES_MOV_MODAL=true; TES_TRANSFER_MODAL=false; render(); },
  'tes-transfer-open'() { TES_TRANSFER_MODAL=true; TES_MOV_MODAL=false; render(); },
  'tes-mov-close'() { TES_MOV_MODAL=false; TES_TRANSFER_MODAL=false; render(); },
  'tes-fixed-open'() { TES_NEW_FIXED_MODAL=true; render(); },
  'tes-fixed-close'() { TES_NEW_FIXED_MODAL=false; render(); },
  async 'her-publicar-activas'() { if(!await confirmarAccion('Se mostrarán en la web los nombres de todas las hermanas cuyo estado sea Activa. ¿Quieres continuar?','Publicar hermanas'))return; await api('POST','/admin/hermanas/publicar-activas',{}); toast('Hermanas activas visibles en la web'); render(); },
  'cal-prev'() { CAL_MES=new Date(CAL_MES.getFullYear(),CAL_MES.getMonth()-1,1); render(); },
  'cal-next'() { CAL_MES=new Date(CAL_MES.getFullYear(),CAL_MES.getMonth()+1,1); render(); },
  'cal-hoy'() { CAL_MES=new Date(new Date().getFullYear(),new Date().getMonth(),1); CAL_SELECCION=fechaISOlocal(new Date()); render(); },
  'cal-dia'(el) { CAL_SELECCION=el.dataset.fecha; shell(vCalendarioHTML(CAL_EVENTOS)); },
  async 'resumen-pdf'() {
    if (!RESUMEN_DATA) return;
    const d = RESUMEN_DATA, p = d.periodo;
    const titulo = new Date(p + '-01T12:00:00').toLocaleDateString('es-ES',{month:'long',year:'numeric'});
    const movimientos = d.movimientos || [];
    const ingresos = movimientos.filter(x => x.tipo === 'ingreso').reduce((n,x) => n + Number(x.importe_centimos || 0),0);
    const gastos = movimientos.filter(x => x.tipo === 'gasto').reduce((n,x) => n + Number(x.importe_centimos || 0),0);
    const cuotas = d.cuotas || {};
    const lineas = [
      'LAS TRIBULACIONES DE SARA','RESUMEN MENSUAL · ' + titulo,'',
      'SITUACIÓN ECONÓMICA','Ingresos: ' + euros(ingresos),'Gastos: ' + euros(gastos),
      'Resultado: ' + euros(ingresos-gastos),'Movimientos contabilizados: ' + movimientos.length,'',
      'CUOTAS DEL PERIODO','Cuotas generadas: ' + Number(cuotas.cantidad || 0) + ' · ' + euros(cuotas.generado),
      'Cobrado: ' + euros(cuotas.cobrado),'Pendiente actual: ' + euros(cuotas.pendiente),'',
      'ACTIVIDAD DEL CUARTEL','Sábados del mes: ' + d.sabados_programados,
      'Asistencia: ' + d.asistencia + ' (' + d.hermanas_asistentes + ' hermanas, ' + d.invitadas + ' invitadas)',
      'Juntas celebradas: ' + d.juntas_celebradas,'','MOVIMIENTOS'
    ];
    movimientos.slice(0,14).forEach(x => {
      lineas.push(x.fecha + ' · ' + String(x.concepto || '').slice(0,38) + ' · ' + (x.tipo === 'gasto' ? '-' : '+') + euros(x.importe_centimos));
    });
    if (movimientos.length > 14) lineas.push('... y ' + (movimientos.length - 14) + ' movimientos más (consulta la web).');
    lineas.push('','SÁBADOS');
    (d.sabados || []).slice(0,6).forEach(x => {
      lineas.push(x.fecha + ' · ' + String(x.titulo || 'Sábado').slice(0,34) + ' · ' + x.asistentes + ' hermanas / ' + x.invitadas + ' invitadas');
    });
    if (d.juntas?.length) {
      lineas.push('','JUNTAS');
      d.juntas.slice(0,4).forEach(x => {
        lineas.push(x.fecha + ' · ' + String(x.lugar || 'Junta').slice(0,35) + ' · ' + x.estado);
      });
    }
    if (d.eventos?.length) {
      lineas.push('','OTROS EVENTOS');
      d.eventos.slice(0,4).forEach(x => {
        lineas.push(x.fecha + ' · ' + String(x.titulo || '').slice(0,38) + ' · ' + (x.estado === 'cancelado' ? 'Cancelado' : 'Publicado'));
      });
    }
    await entregarPDF(await crearPDFSimple(lineas),'resumen-mensual-' + p + '.pdf','Resumen mensual · ' + titulo,'Informe mensual de Las Tribulaciones de Sara');
  },
  'module-tab'(el) { const k=el.dataset.tab; if(el.dataset.module==='cuenta') CUENTA_TAB=k; if(el.dataset.module==='cocina') COCINA_TAB=k; if(el.dataset.module==='tesoreria') TES_TAB=k; if(el.dataset.module==='tesrec') TES_REC_TAB=k; if(el.dataset.module==='tescfg') TES_CFG_TAB=k; if(el.dataset.module==='adminher') ADMIN_HERM_TAB=k; if(el.dataset.module==='actas') ACTAS_TAB=k; render(); },
  'extra-add'() { $('#tes-extras-rows').insertAdjacentHTML('beforeend',extraRow({})); },
  'extra-del'(el) { el.closest('.extra-row').remove(); },

  'cuenta-pago-open'() { PAGO_MODAL=true; render(); },
  'cuenta-pago-close'() { PAGO_MODAL=false; render(); },
  'cuenta-pago-stop'() {},
  'rsvp-choice'(el) { const f = el.closest('form'); f.querySelector('[name=asiste]').value = el.dataset.value; f.querySelectorAll('[data-a=\"rsvp-choice\"]').forEach(b => { b.classList.remove('y','n'); b.setAttribute('aria-pressed',String(b===el)); }); el.classList.add(el.dataset.value === '1' ? 'y' : 'n'); actualizarResumenRSVP(f); },
  'rsvp-invitadas-step'(el) {
    const f=el.closest('form'), input=f.querySelector('[name=acompanantes]');
    const cantidad=Math.max(0,Math.min(20,Number(input.value||0)+Number(el.dataset.delta||0)));
    input.value=String(cantidad);
    f.querySelector('[data-invitadas-count]').textContent=String(cantidad);
    f.querySelectorAll('[data-guest-index]').forEach(x=>{x.style.display=Number(x.dataset.guestIndex)<=cantidad?'block':'none';});
    actualizarResumenRSVP(f);
  },
  menu() { MENU = !MENU; shell(LAST); },
  async 'cambiar-vista'() { if (!ME_REAL?.admin) return; VISTA_HERMANA = !VISTA_HERMANA; aplicarVista(); location.hash = '#/'; render(); toast(VISTA_HERMANA ? 'Estás viendo la zona con tu perfil de hermana.' : 'Has vuelto a la vista de administradora.'); },
  async salir() { await api('POST', '/auth/logout').catch(() => {}); ME = null; ME_REAL = null; location.hash = '#/'; render(); },
  async 'her-invitar'(el) { const w=window.open('about:blank','_blank'); try { const r=await api('POST','/admin/hermanas/'+el.dataset.id+'/invitar'); if(!r.whatsapp) { if(w) w.close(); throw new Error(r.error||'No se ha podido preparar la bienvenida'); } if(w) w.location.href=r.whatsapp; else location.href=r.whatsapp; toast('Mensaje preparado. Revísalo y pulsa Enviar en WhatsApp.'); render(); } catch(e) { if(w) w.close(); throw e; } },
  async 'her-reset'(el) { const r=await api('POST','/admin/hermanas/'+el.dataset.id+'/reset'); toast(r.enviado?'Correo para restablecer contraseña enviado':'No se ha podido enviar el correo',!r.enviado); render(); },
  async 'her-quitar-foto'(el) { await api('PUT', '/admin/hermanas/' + el.dataset.id, { quitar_foto: true }); toast('Foto quitada'); render(); },
  async 'cargo-del'(el) { if (!await confirmarAccion('Se eliminará este cargo. ¿Quieres continuar?','Sí, borrar cargo')) return; await api('DELETE', '/admin/cargos/' + el.dataset.id); render(); },
  async 'evento-edit'(el) { const d=await api('GET','/modulos/eventos'); EVENTO_EDITANDO=d.find(x=>Number(x.id)===Number(el.dataset.id))||null; if(!EVENTO_EDITANDO) throw new Error('No se ha encontrado el evento'); render(); },
  async 'evento-cancel'(el) { if(!await confirmarAccion('El evento dejará de mostrarse en la agenda de las hermanas. ¿Quieres cancelarlo?','Cancelar evento')) return; await api('PUT','/modulos/eventos/'+el.dataset.id,{estado:'cancelado'}); toast('Evento cancelado'); render(); },
  'evento-edit-cancel'() { EVENTO_EDITANDO=null; render(); },
  async 'noticia-del'(el) { if (!await confirmarAccion('La publicación se eliminará de la web. ¿Quieres continuar?','Sí, eliminar')) return; await api('DELETE','/admin/noticias/'+el.dataset.id); if(NOTICIA_EDITANDO?.id===Number(el.dataset.id))NOTICIA_EDITANDO=null; toast('Publicación eliminada'); render(); },
  async 'noticia-edit'(el) { const d=await api('GET','/admin/noticias'); NOTICIA_EDITANDO=d.find(n=>n.id===Number(el.dataset.id))||null; if(!NOTICIA_EDITANDO)throw new Error('No se ha encontrado la publicación'); render(); },
  'noticia-edit-cancel'() { NOTICIA_EDITANDO=null; render(); },
  async 'sabado-asistentes'(el) { const a=await api('GET','/modulos/sabados/'+el.dataset.id+'/asistencias'); const contenido=a.length ? '<div class="lts-attendance-list">'+a.map(x=>'<article class="lts-attendance-row"><div><b>'+esc(x.nombre)+'</b><span class="lts-attendance-status '+(x.asiste?'yes':'no')+'">'+(x.asiste?'Asiste':'No asiste')+'</span></div>'+(x.acompanantes?'<p>'+Number(x.acompanantes)+' acompañante(s)</p>':'')+(x.alergias?'<p><b>Alergias:</b> '+esc(x.alergias)+'</p>':'')+'</article>').join('')+'</div>' : '<p class="mu">Todavía no hay confirmaciones.</p>'; mostrarPopup('Asistencia del sábado',contenido); },
  'sabados-tab'(el) { SAB_TAB=el.dataset.tab==='ant'?'ant':'prox'; render(); },
  async 'pago-confirm'(el) { if(!await confirmarAccion('El pago quedará confirmado en Tesorería. ¿Has comprobado que es correcto?','Confirmar pago')) return; await api('POST','/modulos/tesoreria/pagos/'+el.dataset.id+'/confirmar'); toast('Pago confirmado'); render(); },
  async 'pago-reject'(el) { if(!await confirmarAccion('El pago quedará rechazado y no se descontará de la deuda. ¿Quieres continuar?','Rechazar pago')) return; await api('POST','/modulos/tesoreria/pagos/'+el.dataset.id+'/rechazar'); toast('Pago rechazado'); render(); },
  async 'mov-confirm'(el) { if(!await confirmarAccion('El movimiento quedará validado en la contabilidad. ¿Has comprobado que se ha realizado?','Validar movimiento')) return; await api('POST','/modulos/tesoreria/movimientos/'+el.dataset.id+'/revisar',{estado:'confirmado'}); toast('Movimiento confirmado'); render(); },
  async 'mov-reject'(el) { if(!await confirmarAccion('El movimiento quedará rechazado y no se incluirá en los informes. ¿Quieres continuar?','Rechazar movimiento')) return; await api('POST','/modulos/tesoreria/movimientos/'+el.dataset.id+'/revisar',{estado:'rechazado'}); toast('Movimiento rechazado'); render(); },
  async 'tes-filtro-reset'() { TES_FILTRO={tipo:'todos',texto:'',desde:'',hasta:'',cuenta:'',hermana:'',anio:'',categoria:''}; render(); },
  async 'fijo-del'(el) { if(!await confirmarAccion('El gasto fijo dejará de generar nuevos cargos, pero se conservará su historial. ¿Quieres continuar?','Desactivar gasto')) return; await api('DELETE','/modulos/tesoreria/gastos-fijos/'+el.dataset.id); render(); },
  async 'fijo-registrar-todos'() { const forms=[...document.querySelectorAll('form[data-f=tes-fijo-registrar]')]; let n=0; for(const f of forms){if(!f.reportValidity()) return; const d=new FormData(f); await api('POST','/modulos/tesoreria/gastos-fijos/'+f.dataset.id+'/registrar',{periodo:d.get('periodo'),importe:d.get('importe')}); n++;} toast(n+' gasto(s) fijo(s) enviados a validación'); render(); },

  async 'tes-ticket-reject'(el) { if(!await confirmarAccion('El ticket será rechazado y no se incluirá en la contabilidad. ¿Quieres continuar?','Rechazar ticket')) return; await api('PUT','/modulos/tesoreria/tickets/'+el.dataset.id,{estado:'rechazado'}); toast('Ticket rechazado'); render(); },
  async 'tes-report-export'() {
    if(!window.jspdf?.jsPDF) throw new Error('No se ha podido cargar el generador de PDF.');
    const {jsPDF}=window.jspdf,doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
    if(typeof doc.autoTable!=='function') throw new Error('No se ha podido cargar el complemento de tablas PDF. Recarga la página y vuelve a intentarlo.');
    const form=document.querySelector('form[data-f="tes-report-range"]');
    const desde=String(form?.querySelector('[name=desde]')?.value||TES_REPORT_FROM),hasta=String(form?.querySelector('[name=hasta]')?.value||TES_REPORT_TO);
    if(!desde||!hasta||desde>hasta) throw new Error('Selecciona un rango de fechas válido antes de generar el informe.');
    if(desde!==TES_REPORT_FROM||hasta!==TES_REPORT_TO){TES_REPORT_FROM=desde;TES_REPORT_TO=hasta;await vTesoreria();}
    const fecha=new Date().toLocaleDateString('es-ES'),periodo=fechaBonita(desde)+' – '+fechaBonita(hasta),margen=12,ancho=273;
    const color=[65,55,43],oro=[173,133,49],gris=[112,105,95];
    const cabecera=(subtitulo)=>{
      doc.setFont('helvetica','bold');doc.setFontSize(17);doc.setTextColor(...color);doc.text('LAS TRIBULACIONES DE SARA',margen,15);
      doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(...gris);doc.text('INFORME DE TESORERÍA · '+periodo+' · '+fecha,margen,21);
      if(subtitulo){doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(...color);doc.text(subtitulo,margen,31);}
      doc.setDrawColor(...oro);doc.setLineWidth(.6);doc.line(margen,25,ancho+margen,25);
    };
    cabecera('Resumen económico');let y=34;
    const kpis=[...document.querySelectorAll('.tes-report-kp>.card')].map(c=>[c.querySelector('span')?.innerText||'',c.querySelector('b')?.innerText||'']);
    const kw=ancho/Math.max(kpis.length,1);
    kpis.forEach((k,i)=>{const x=margen+i*kw;doc.setFillColor(246,242,234);doc.roundedRect(x,y,kw-3,17,2,2,'F');doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(...gris);doc.text(k[0],x+4,y+6);doc.setFont('helvetica','bold');doc.setFontSize(13);doc.setTextColor(...color);doc.text(k[1],x+4,y+13);});
    y+=25;
    const tablas=[...document.querySelectorAll('.tes-report-tables table')];
    if(!tablas.length) throw new Error('El informe no contiene tablas para exportar.');
    for(const tabla of tablas){
      const card=tabla.closest('.card')||tabla.parentElement,titulo=card.querySelector('h3')?.innerText.trim()||'Detalle';
      const head=[...tabla.querySelectorAll('thead tr:first-child th')].map(x=>x.innerText.trim());
      const body=[...tabla.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.innerText.replace(/\s+/g,' ').trim()));
      const foot=[...tabla.querySelectorAll('tfoot tr:last-child td')].map(x=>x.innerText.trim());
      if(y>170){doc.addPage();cabecera(titulo);y=37;}else{doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(...color);doc.text(titulo,margen,y);y+=3;}
      doc.autoTable({startY:y,head:[head],body,foot:foot.length?[foot]:undefined,theme:'grid',styles:{font:'helvetica',fontSize:8,cellPadding:2.2,textColor:gris,lineColor:[224,216,202],lineWidth:.15},headStyles:{fillColor:[65,55,43],textColor:[255,255,255],fontStyle:'bold'},footStyles:{fillColor:[246,242,234],textColor:color,fontStyle:'bold'},alternateRowStyles:{fillColor:[250,248,244]},margin:{left:margen,right:margen},didDrawPage:()=>{if(doc.internal.getNumberOfPages()>1){doc.setFontSize(7);doc.setTextColor(...gris);doc.text('Las Tribulaciones de Sara · Informe de Tesorería · '+periodo,margen,202);}}});
      y=doc.lastAutoTable.finalY+11;
    }
    const blob=doc.output('blob');await entregarPDF(blob,'Informe_Tesoreria_'+desde+'_a_'+hasta+'.pdf','Informe de tesorería','Informe de tesorería para junta · '+periodo);
  },
  async 'tes-export'() {
    const tabla=document.querySelector('.tes-debt-table table');
    if(!tabla) throw new Error('No se encuentra la tabla de cuotas pendientes.');
    if(!window.jspdf?.jsPDF) throw new Error('No se ha podido cargar el generador de PDF. Comprueba tu conexión y vuelve a intentarlo.');
    const {jsPDF}=window.jspdf;
    const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
    const fecha=new Date().toLocaleDateString('es-ES');
    const nombre='Estado_de_cuentas_Las_Tribulaciones_'+new Date().toISOString().slice(0,10)+'.pdf';
    const azul=[65,55,43], oro=[173,133,49], gris=[112,105,95], linea=[224,216,202];
    const margen=12, ancho=273;
    const columnas=[63,47,38,43,43,39];
    const titulos=['Hermana','Cuotas mensuales','Cuaresma','Semana Santa','Otros conceptos','Total'];
    const filas=[...tabla.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.innerText.replace(/\s+/g,' ').trim()));
    const totales=[...tabla.querySelectorAll('tfoot td')].map(td=>td.innerText.replace(/\s+/g,' ').trim());
    let y=15;
    const cabecera=()=>{
      doc.setFont('helvetica','bold');doc.setFontSize(17);doc.setTextColor(...azul);
      doc.text('LAS TRIBULACIONES DE SARA',margen,y);
      doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(...gris);
      doc.text('Relación de cuotas y conceptos pendientes · '+fecha,margen,y+6);
      doc.setDrawColor(...oro);doc.setLineWidth(.6);doc.line(margen,y+10,ancho+margen,y+10);
      y+=16;
      doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(...azul);
      doc.setFillColor(246,242,234);doc.rect(margen,y,ancho,9,'F');
      let x=margen;titulos.forEach((t,i)=>{doc.text(t,x+2,y+5.7);x+=columnas[i];});
      y+=9;
    };
    cabecera();
    doc.setFontSize(8.5);
    filas.forEach((fila,idx)=>{
      if(fila.length<6)return;
      const celdas=fila.map((v,i)=>doc.splitTextToSize(v||'—',columnas[i]-4));
      const alto=Math.max(9,...celdas.map(c=>c.length*3.7+3));
      if(y+alto>190){doc.addPage();y=15;cabecera();}
      if(idx%2===1){doc.setFillColor(250,248,244);doc.rect(margen,y,ancho,alto,'F');}
      doc.setDrawColor(...linea);doc.setLineWidth(.15);doc.line(margen,y+alto,ancho+margen,y+alto);
      let x=margen;
      celdas.forEach((c,i)=>{
        doc.setFont('helvetica',i===0||i===5?'bold':'normal');
        doc.setTextColor(...(i===5?azul:gris));
        doc.text(c,x+2,y+4.5,{baseline:'top'});
        x+=columnas[i];
      });
      y+=alto;
    });
    if(y+13>190){doc.addPage();y=15;}
    doc.setFillColor(246,242,234);doc.rect(margen,y,ancho,10,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(...azul);
    let x=margen;totales.slice(0,6).forEach((v,i)=>{doc.text(v||'',x+2,y+6.3);x+=columnas[i];});
    y+=16;
    doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(...gris);
    doc.text('Este documento refleja las cantidades pendientes. Los pagos pendientes de validar no se descuentan hasta su confirmación.',margen,y);
    const blob=doc.output('blob');
    await entregarPDF(blob,nombre,'Estado de cuentas','Relación de cuotas y conceptos pendientes de Las Tribulaciones de Sara.');
  },

  async 'cocina-del'(el) { if(!await confirmarAccion('Se eliminará este turno de cocina. ¿Quieres continuar?','Sí, eliminar turno')) return; await api('DELETE','/modulos/cocina/'+el.dataset.id); render(); },
  async 'junta-del'(el) { if(!await confirmarAccion('Se eliminarán la convocatoria y el acta asociada. ¿Quieres continuar?','Sí, eliminar junta')) return; await api('DELETE','/modulos/actas/juntas/'+el.dataset.id); render(); },
  'hito-add'() { $('#hitos').insertAdjacentHTML('beforeend', hitoRow({ anio: '', texto: '' })); },
  'hito-del'(el) { el.closest('.row').remove(); },
};
document.addEventListener('change', e => {
  const alergia=e.target.closest('input[name="alergia_perfil"]');
  if(alergia) {
    const chip=alergia.closest('.chip');
    if(chip) {
      chip.classList.toggle('on',alergia.checked);
      chip.classList.remove('just-changed');
      void chip.offsetWidth;
      if(alergia.checked) chip.classList.add('just-changed');
    }
    const form=alergia.closest('form');
    const seleccionadas=form ? Array.from(form.querySelectorAll('input[name="alergia_perfil"]:checked')) : [];
    const feedback=form?.querySelector('[data-profile-allergy-feedback]');
    if(feedback) feedback.textContent=seleccionadas.length ? seleccionadas.length+' preferencias seleccionadas' : 'No has seleccionado ninguna alergia o preferencia.';
  }
  const input=e.target.closest('[data-import-file]'); if(!input) return;
  const file=input.files?.[0]; if(!file) return;
  TES_IMPORT_FILE=file.name;
  toast('Informe seleccionado. Para preparar una vista previa fiel necesito adaptar el lector al formato real del archivo.');
  render();
});
document.addEventListener('submit', async e => {
  const f = e.target.closest('form[data-f]'); if (!f) return;
  e.preventDefault();
  const b = f.querySelector('button:not([type=button])'); if (b) b.disabled = true;
  try { await FORM[f.dataset.f](f, new FormData(f)); } catch (er) { toast(er.message, true); } finally { if (b) b.disabled = false; }
});
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-a]'); if (!el || !ACT[el.dataset.a]) return;
  if (el.tagName === 'A' && el.dataset.a !== 'salir') return;
  e.preventDefault();
  try { await ACT[el.dataset.a](el); } catch (er) { toast(er.message, true); }
});
async function entrar() { ME_REAL = await api('GET', '/me'); VISTA_HERMANA = false; aplicarVista(); location.hash = '#/'; render(); }

/* ---------- arranque ---------- */
async function render() {
  MENU = false;
  const h = location.hash || '#/'; let m;
  try {
    if ((m = h.match(/^#\/clave\/([\w-]+)$/))) return vClave(m[1]);
    if (h === '#/olvido') return vOlvido();
    if (h === '#/setup') return vSetup();
    if ((m = h.match(/^#\/error\/([\w-]+)$/))) return vLogin(m[1]);
    if (!ME) return vLogin();
    if (h === '#/perfil') return vPerfil();
    if (h === '#/calendario') return await vCalendario();
    if (h === '#/resumen-mensual') return await vInicio();
    if (h === '#/admin/eventos') return ME.admin ? await vAdminEventos() : await vInicio();
    if (h === '#/sabados') return await vSabados();
    if (h === '#/cuenta') return await vCuenta();
    if (h === '#/cocina') return await vCocina();
    if (h === '#/actas') return await vActas();
    if (h === '#/tesoreria') return ME.admin || ME.tes ? await vTesoreria() : await vInicio();
    if (h === '#/admin') return ME.admin ? vAdminInicio() : await vInicio();
    if (h.startsWith('#/admin/')) return ME.admin ? await vAdmin(h.slice(8)) : await vInicio();
    return await vInicio();
  } catch (er) {
    if (er.status === 401) { ME = null; return vLogin(); }
    shell(`<div class="card"><p>${esc(er.message)}</p></div>`);
  }
}
addEventListener('hashchange', render);
(async () => { try { ME_REAL = await api('GET', '/me'); VISTA_HERMANA = false; aplicarVista(); } catch { ME = null; ME_REAL = null; } render(); })();
