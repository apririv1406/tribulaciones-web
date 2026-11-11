'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const iniciales = n => esc(String(n).split(' ').map(w => w[0]).slice(0, 2).join(''));
const GSVG = '<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.600 2.400 30.200 0 24 0 14.600 0 6.500 5.400 2.600 13.200l7.800 6.100C12.300 13.600 17.700 9.500 24 9.500z"/><path fill="#4285F4" d="M46.500 24.500c0-1.600-.1-3.100-.4-4.500H24v9h12.700c-.6 3-2.300 5.500-4.800 7.200l7.500 5.800c4.400-4.100 7.100-10.100 7.100-17.500z"/><path fill="#FBBC05" d="M10.400 28.700A14.500 14.500 0 0 1 9.500 24c0-1.600.3-3.200.9-4.700l-7.800-6.100A24 24 0 0 0 0 24c0 3.900.9 7.500 2.600 10.800l7.800-6.100z"/><path fill="#34A853" d="M24 48c6.500 0 11.900-2.100 15.900-5.800l-7.500-5.800c-2.100 1.400-4.800 2.300-8.400 2.300-6.300 0-11.700-4.100-13.600-9.800l-7.800 6.100C6.500 42.600 14.600 48 24 48z"/></svg>';
let ME = null, MENU = false, LAST = '', PAGO_MODAL = false, SAB_TAB = 'prox', CUENTA_TAB = 'deb', COCINA_TAB = 'mis', TES_TAB = 'res', TES_CFG_TAB = 'pre', ACTAS_TAB = 'conv', TES_FILTRO = { tipo:'todos', desde:'', hasta:'', texto:'' };

async function api(method, path, body) {
  const r = await fetch('/api' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' }, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || 'Ha ocurrido un error'), { status: r.status });
  return d;
}
function toast(msg, err) { const t = $('#toast'); t.innerHTML = `<div class="toast ${err ? 'err' : ''}">${esc(msg)}</div>`; clearTimeout(toast.t); toast.t = setTimeout(() => (t.innerHTML = ''), 5000); }
function reducir(file, max, q = 0.82) {
  return new Promise((res, rej) => {
    const img = new Image(), u = URL.createObjectURL(file);
    img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u); res(c.toDataURL('image/jpeg', q)); };
    img.onerror = () => rej(new Error('No se puede leer esa imagen')); img.src = u;
  });
}
function telefonoWhatsApp(valor) {
  let n = String(valor || '').replace(/\D/g, '');
  if (n.startsWith('00')) n = n.slice(2);
  if (n.length === 9) n = '34' + n;
  return /^[1-9]\d{7,14}$/.test(n) ? n : '';
}

/* ---------- estructura ---------- */
const items = () => !ME ? [] : [['#/', 'Inicio'], ['#/sabados', 'Sábados'], ['#/cuenta', 'Mi cuenta'], ['#/cocina', 'Cocina'], ...(ME.actas ? [['#/actas', 'Actas y juntas']] : []), ...(ME.tes ? [['#/tesoreria', 'Tesorería']] : []), ...(ME.admin ? [['#/admin/hermanas', 'Administración']] : []), ['#/perfil', 'Mi perfil']];
function shell(html) {
  LAST = html;
  const cur = location.hash || '#/', its = items();
  const on = h => (h === '#/' ? cur === '#/' || cur === '' : cur.startsWith(h.slice(0, 8)));
  $('#nav').innerHTML = `<a class="logo" href="/"><img src="/logo.png" alt="Las Tribulaciones de Sara"></a>` + its.map(([h, t]) => `<a class="dk ${on(h) ? 'on' : ''}" href="${h}">${t}</a>`).join('') + `<a class="dk" href="/">Web pública</a>` + (ME ? `<a class="cta dk" href="#/" data-a="salir">Salir</a>` : '') + `<button class="hb" data-a="menu" aria-label="Menú"><i></i><i></i><i></i></button>`;
  $('#mn').innerHTML = MENU ? `<div class="sc" data-a="menu"></div><div class="mn"><button class="x" data-a="menu" aria-label="Cerrar">✕</button>${its.map(([h, t]) => `<a href="${h}">${t}</a>`).join('')}<hr><a href="/">Web pública</a>${ME ? '<a href="#/" data-a="salir">Salir</a>' : ''}</div>` : '';
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
<p class="mu" style="font-size:13px;margin:16px 0 0">¿Primer acceso? Usa el enlace de bienvenida que te ha enviado la administradora por WhatsApp.</p></div></div>`);
}
function vOlvido() {
  shell(`<div class="login"><div class="card"><img src="/logo.png" alt="" style="height:90px"><h2 style="margin-top:6px">¿Olvidaste tu contraseña?</h2><p class="mu">Para crear una contraseña nueva, ponte en contacto con la administradora del cuartel. Te enviará un enlace personal por WhatsApp.</p><p style="margin:18px 0 0"><a class="btn" href="#/">Volver a entrar</a></p></div></div>`);
}
function vClave(tok) {
  shell(`<div class="login"><div class="card"><img src="/logo.png" alt="" style="height:90px"><div class="tag" style="margin-top:6px">Contraseña</div><h2>Crea tu contraseña</h2><p class="mu">Elige una contraseña para entrar a la Zona hermana. Mínimo 8 caracteres.</p><form data-f="clave" data-t="${esc(tok)}">${campo('p1', 'Contraseña', 'type="password" required minlength="8" autocomplete="new-password"')}${campo('p2', 'Repite la contraseña', 'type="password" required minlength="8" autocomplete="new-password"')}<button class="btn" style="width:100%;margin-top:16px">Guardar y entrar</button></form></div></div>`);
}
function vSetup() {
  shell(`<div class="login"><div class="card"><img src="/logo.png" alt="" style="height:90px"><div class="tag" style="margin-top:6px">Instalación</div><h2>Primer acceso de la administradora</h2><p class="mu">Escribe la clave de instalación (SETUP_KEY) y elige tu contraseña.</p><form data-f="setup">${campo('key', 'Clave de instalación', 'type="password" required')}${campo('p1', 'Tu contraseña', 'type="password" required minlength="8" autocomplete="new-password"')}<button class="btn" style="width:100%;margin-top:16px">Crear mi cuenta</button></form></div></div>`);
}

/* ---------- zona ---------- */
function vInicio() {
  const nombre = esc((ME.nombre || '').split(' ')[0] || 'hermana');
  const mod = (t, d, href, etiqueta) => `<a class="card" href="${href}" style="display:block;color:inherit;text-decoration:none">
    <div class="tag">${etiqueta}</div><h3 style="margin:5px 0 8px">${t}</h3><p class="mu" style="margin:0">${d}</p><div style="margin-top:16px;color:var(--gd);font-weight:600;font-size:13px">Entrar <span aria-hidden="true">→</span></div></a>`;
  shell(`<section class="hero2">
    <div class="tag" style="color:var(--go)">Zona hermana</div>
    <h2 style="color:#fff;margin:7px 0 4px">¡Hola, ${nombre}!</h2>
    <p style="margin:0;color:rgba(255,255,255,.78)">${esc(ME.cargo || 'Hermana')} · Las Tribulaciones de Sara</p>
    <p style="margin:18px 0 0;color:rgba(255,255,255,.78);font-size:14px">Aquí tienes a mano la información y las gestiones del cuartel.</p>
  </section>
  ${ME.admin ? `<section class="sec" style="padding-bottom:12px"><div class="cta2"><div><b>Administración del cuartel</b><span>Hermanas, cargos, bienvenida, noticias e historia.</span></div><a class="btn" href="#/admin/hermanas">Acceder</a></div></section>` : ''}
  <section class="sec" style="padding-top:28px"><div class="tag">Tu espacio</div><h2 style="margin:4px 0 18px">Zona hermana</h2>
    <div class="g2">
      ${mod('Sábados y asistencia','Confirma si vas a asistir, añade acompañantes y comunica alergias.','#/sabados','Organización')}
      ${mod('Mi cuenta','Consulta tus cuotas, pagos e historial de movimientos.','#/cuenta','Tesorería personal')}
      ${mod('Cocina','Consulta los turnos, menús, presupuestos y alergias.','#/cocina','Cuartel')}
      ${ME.actas ? mod('Actas y juntas','Consulta convocatorias, órdenes del día, asistentes y actas.','#/actas','Documentación') : ''}
      ${ME.tes ? mod('Tesorería','Gestiona cuotas, ingresos, gastos, tickets e informes.','#/tesoreria','Gestión económica') : ''}
    </div>
  </section>`);
}

const ALERGIAS_TAGS = ['Sin gluten (celiaquía)','Sin lactosa','Frutos secos','Marisco y pescado','Huevo','Vegetariana'];
const euros = n => (Number(n || 0) / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const fechaBonita = f => f ? new Date(`${f}T12:00:00`).toLocaleDateString('es-ES') : '—';
const readFileData = file => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(new Error('No se ha podido leer el archivo')); r.readAsDataURL(file); });

async function vSabados() {
  const ss = await api('GET', '/modulos/sabados');
  const fechaActual = new Date(); fechaActual.setHours(0,0,0,0);
  const proximos = ss.filter(s => new Date(`${s.fecha}T12:00:00`) >= fechaActual);
  const celebrados = ss.filter(s => new Date(`${s.fecha}T12:00:00`) < fechaActual);
  const tarjetas = lista => lista.map(s => {
    const fecha = new Date(`${s.fecha}T12:00:00`);
    const pasado = fecha < fechaActual;
    const abierto = s.estado === 'abierto';
    const partes = String(s.fecha || '').split('-');
    const dia = partes.length === 3 ? partes[2] : '—';
    const mes = partes.length === 3 ? new Date(`${s.fecha}T12:00:00`).toLocaleDateString('es-ES',{month:'short'}).replace('.','') : '';
    return `<article class="card sab ${pasado ? 'past' : abierto ? 'next' : ''}">
      <div class="date"><b>${esc(dia)}</b><span>${esc(mes)}</span></div>
      <div class="bd">
        <div class="row" style="justify-content:space-between;align-items:center;gap:8px"><span class="pill ${abierto ? 'ok' : ''}">${pasado ? 'Celebrado' : abierto ? 'Confirmación abierta' : s.estado === 'cancelado' ? 'Cancelado' : 'Cerrado'}</span><span class="mu" style="font-size:13px">${esc(s.hora || '')}</span></div>
        <h3 style="margin:8px 0 4px">${esc(s.titulo)}</h3><p class="mu" style="margin:0 0 8px">${esc(s.descripcion || '')}</p>
        <div class="menu">${s.confirmadas || 0} confirmaciones · ${fechaBonita(s.fecha)}</div>
        ${!pasado && abierto ? `<form data-f="sabado-rsvp" data-id="${s.id}" style="margin-top:14px"><label class="fl">¿Vas a asistir?</label><div class="seg"><button type="button" class="${s.mi_asistencia === 1 ? 'y' : ''}" data-a="rsvp-choice" data-value="1">Sí, asistiré</button><button type="button" class="${s.mi_asistencia === 0 ? 'n' : ''}" data-a="rsvp-choice" data-value="0">No podré asistir</button></div><input type="hidden" name="asiste" value="${s.mi_asistencia === 0 ? '0' : '1'}"><div class="row"><div style="flex:0 0 120px">${campo('acompanantes','Invitadas','type="number" min="0" max="20" value="'+(s.mis_acompanantes || 0)+'"')}</div></div><label class="fl">Alergias o dietas</label><div class="wr">${ALERGIAS_TAGS.map(t=>`<label class="chip" style="display:inline-flex;align-items:center;gap:7px"><input type="checkbox" name="alergia" value="${esc(t)}" ${String(s.mis_alergias||'').split(/[,;\\n]/).map(x=>x.trim()).includes(t)?'checked':''}> ${esc(t)}</label>`).join('')}</div><label class="fl">Otras alergias o aclaraciones</label><textarea class="t" name="alergias_extra" rows="2">${esc(s.mi_observaciones || '')}</textarea><label class="fl">Observaciones</label><textarea class="t" name="observaciones" rows="2">${esc(s.mi_observaciones || '')}</textarea><button class="btn" style="margin-top:12px">Guardar asistencia</button></form>` : ''}
        ${pasado && s.mi_asistencia === 1 ? `<p class="mu" style="margin:12px 0 6px">Apunta las consumiciones que tomaste en este encuentro.</p><form data-f="sabado-consumos" data-id="${s.id}"><div class="row"><div style="flex:1 1 130px">${campo('copas','Copas','type="number" min="0" max="50" value="'+(s.mis_copas || 0)+'"')}</div><div style="flex:1 1 130px">${campo('refrescos','Refrescos','type="number" min="0" max="50" value="'+(s.mis_refrescos || 0)+'"')}</div></div><button class="btn" style="margin-top:10px">Guardar consumiciones</button></form>` : pasado ? '<p class="mu" style="margin:12px 0 0">No confirmaste asistencia a este sábado.</p>' : '<p class="mu" style="margin:14px 0 0">Este sábado ya no admite cambios.</p>'}
        ${ME.admin || ME.tes ? `<p style="margin:12px 0 0"><button class="chip" type="button" data-a="sabado-asistentes" data-id="${s.id}">Ver asistentes</button></p>` : ''}
      </div></article>`;
  }).join('');
  return shell(`<div class="top"><div class="tag">Organización del cuartel</div><h2>Sábados y asistencia</h2><p class="mu" style="margin:0">Consulta los próximos encuentros, confirma tu asistencia y registra tus consumiciones después de cada sábado.</p></div>
  ${ME.admin || ME.tes ? `<section class="card" style="margin:18px 0"><div class="tag">Agenda</div><h3>Organizar un sábado</h3><form data-f="sabado-new"><div class="row" style="align-items:flex-end"><div style="flex:1 1 150px">${campo('fecha','Fecha','type="date" required')}</div><div style="flex:1 1 120px">${campo('hora','Hora','type="time"')}</div><div style="flex:2 1 220px">${campo('titulo','Actividad','required maxlength="120"')}</div><button class="btn">Publicar sábado</button></div><label class="fl">Información del encuentro</label><textarea class="t" name="descripcion" rows="2"></textarea></form></section>` : ''}
  <div class="sub s2"><button type="button" class="${SAB_TAB === 'prox' ? 'on' : ''}" data-a="sabados-tab" data-tab="prox">Próximos sábados (${proximos.length})</button><button type="button" class="${SAB_TAB === 'ant' ? 'on' : ''}" data-a="sabados-tab" data-tab="ant">Ya celebrados (${celebrados.length})</button></div>
  <section class="sec" style="padding-top:12px"><div style="margin-top:14px">${SAB_TAB === 'prox' ? (tarjetas(proximos) || '<div class="card"><p class="mu" style="margin:0">No hay próximos sábados publicados.</p></div>') : (tarjetas(celebrados) || '<div class="card"><p class="mu" style="margin:0">Todavía no hay sábados celebrados.</p></div>')}</div></section>`);
}

async function vCuenta() {
  const d = await api('GET', '/modulos/cuenta');
  const pendientes = d.cuotas.filter(c => c.estado !== 'pagada');
  const totalPendiente = pendientes.reduce((a,c)=>a+c.restante_centimos,0);
  const pagado = d.pagos.filter(p=>p.estado==='confirmado').reduce((a,p)=>a+Number(p.importe_centimos||0),0);
  const pendienteRevision = d.pagos.filter(p=>p.estado==='pendiente').reduce((a,p)=>a+Number(p.importe_centimos||0),0);
  const TAGS = ['Sin gluten (celiaquía)','Sin lactosa','Frutos secos','Marisco y pescado','Huevo','Vegetariana'];
  const alergiasActuales = String(d.alergias?.alergias || '').split(/[,;\n]/).map(x=>x.trim()).filter(Boolean);
  const estado = c => c.estado === 'pagada' ? '<span class="pill ok">Pagada</span>' : c.estado === 'parcial' ? '<span class="pill">Pago parcial</span>' : '<span class="pill">Pendiente</span>';
  let contenido = '';
  if (CUENTA_TAB === 'deb') contenido = `<section class="sec" style="padding-top:0"><div class="tag">Desglose</div><h3>Lo que debo</h3><div class="card">${d.cuotas.length ? d.cuotas.map(c=>`<div class="mv"><div class="x"><b>${esc(c.periodo)}</b><br><small class="mu">Importe: ${euros(c.importe_centimos)} · Pagado: ${euros(c.pagado_centimos)} · Restante: ${euros(c.restante_centimos)}</small></div><div style="text-align:right"><b class="amt">${euros(c.restante_centimos)}</b><br>${estado(c)}</div></div>`).join('') : '<p class="mu">Todavía no hay cuotas generadas.</p>'}</div><p class="mu">Las cuotas y los cargos extraordinarios aparecerán aquí cuando Tesorería los genere.</p></section>`;
  if (CUENTA_TAB === 'pag') contenido = `<section class="sec" style="padding-top:0"><div class="row" style="justify-content:space-between;align-items:center"><div><div class="tag">Historial</div><h3>Mis pagos</h3></div><button class="btn" type="button" data-a="cuenta-pago-open">Registrar un pago</button></div><div class="card">${d.pagos.length ? d.pagos.map(p=>`<div class="mv"><div class="ic" style="background:${p.estado==='confirmado'?'var(--ok)':p.estado==='rechazado'?'var(--ko)':'var(--go)'}"></div><div class="x"><b>${esc(p.concepto || p.periodo || 'Pago')}</b><br><small class="mu">${esc(p.metodo || 'Método no indicado')} · ${fechaBonita(p.fecha_pago)}</small></div><div style="text-align:right"><b class="amt">${euros(p.importe_centimos)}</b><br><span class="pill ${p.estado==='confirmado'?'ok':p.estado==='rechazado'?'':'warn'}">${p.estado==='confirmado'?'Confirmado':p.estado==='rechazado'?'Rechazado':'Pendiente de revisión'}</span></div></div>`).join('') : '<p class="mu">Todavía no has registrado ningún pago.</p>'}</div><p class="mu">Los pagos pendientes se descuentan de tu deuda cuando Tesorería los confirma.</p></section>`;
  if (CUENTA_TAB === 'al') contenido = `<section class="sec" style="padding-top:0"><div class="tag">Información alimentaria</div><h3>Mis alergias o dietas</h3><div class="card"><p class="mu" style="margin-top:0">Son el punto de partida cada vez que confirmas un sábado. Puedes cambiarlas en cada uno.</p><form data-f="alergias"><div class="wr">${TAGS.map(t=>`<label class="chip ${alergiasActuales.includes(t)?'on':''}" style="display:inline-flex;align-items:center;gap:7px"><input type="checkbox" name="alergia" value="${esc(t)}" ${alergiasActuales.includes(t)?'checked':''}> ${esc(t)}</label>`).join('')}</div><label class="fl">Otras alergias o aclaraciones</label><textarea class="t" name="observaciones" rows="3">${esc(d.alergias?.observaciones || '')}</textarea><button class="btn" style="margin-top:14px">Guardar mis alergias</button></form><p class="mu" style="margin:14px 0 0">Son datos de salud: solo los ve el turno de cocina de cada sábado y la junta.</p></div></section>`;
  return shell(`<div class="top"><div class="tag">Tu situación</div><h2>Mi cuenta</h2></div>
  <section class="hero2" style="padding:22px"><span style="opacity:.75">Pendiente de pago</span><div class="big">${euros(totalPendiente)}</div><div class="two"><div><small>Pagos confirmados</small><b>${euros(pagado)}</b></div><div><small>Pendiente de revisión</small><b>${euros(pendienteRevision)}</b></div></div></section>
  ${subnav('cuenta',CUENTA_TAB,[['deb','Lo que debo'],['pag','Mis pagos ('+d.pagos.length+')'],['al','Mis alergias']])}
  ${contenido}
  ${PAGO_MODAL ? `<div class="ov" data-a="cuenta-pago-close"><div class="sheet" data-a="cuenta-pago-stop" role="dialog" aria-modal="true" aria-labelledby="pago-titulo"><div class="row" style="justify-content:space-between;align-items:center"><h3 id="pago-titulo">Registrar un pago</h3><button class="chip" type="button" data-a="cuenta-pago-close">✕</button></div><p class="mu" style="margin:0">Indica el pago que has realizado. Tesorería lo comprobará antes de confirmarlo.</p><form data-f="cuenta-pago"><label class="fl">Cuota a la que corresponde</label><select class="t" name="cuota_id"><option value="">Otro pago / varias cuotas</option>${pendientes.map(c=>`<option value="${c.id}">${esc(c.periodo)} · ${euros(c.restante_centimos)} pendiente</option>`).join('')}</select>${campo('importe','Importe (€)','type="number" min="0.01" step="0.01" required')}${campo('fecha_pago','Fecha de pago','type="date" required value="'+new Date().toISOString().slice(0,10)+'"')}<label class="fl">¿Cómo has pagado?</label><select class="t" name="metodo"><option>Bizum</option><option>Transferencia</option><option>Efectivo</option></select>${campo('concepto','Nota (opcional)','maxlength="300"')}<button class="btn" style="width:100%;margin-top:18px">Enviar a tesorería</button></form></div></div>` : ''}`);
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
    const alergiasTurno=d.alergias.filter(a=>!a.fecha || a.fecha===t.fecha);
    return `<article class="card"><div class="row" style="justify-content:space-between;align-items:center"><span class="tag">${esc(t.turno || 'Encuentro')}</span><span class="pill">${fechaBonita(t.fecha)}</span></div><h3 style="margin-top:10px">${esc(t.responsable || 'Turno de cocina')}</h3><div class="hero2" style="margin-top:12px;padding:18px"><div class="tag" style="color:var(--go)">Menú previsto</div><p style="margin:5px 0 0;white-space:pre-line">${esc(t.menu || 'Menú pendiente de definir')}</p></div><div class="kp" style="margin-top:12px"><div class="card"><small class="mu">Comensales confirmados</small><b>${comensales}</b><small class="mu">${t.confirmadas||0} hermanas · ${t.invitadas||0} invitadas</small></div><div class="card"><small class="mu">Presupuesto automático</small><b>${euros(presupuesto)}</b><small class="mu">${euros(Number(t.precio_persona_centimos||0))} por comensal</small></div></div>${t.observaciones ? `<p class="mu" style="margin:12px 0 0">${esc(t.observaciones)}</p>` : ''}${asignadas.length ? `<p class="mu" style="margin-top:12px"><b>Hermanas asignadas:</b> ${asignadas.map(a=>esc(a.nombre)).join(', ')}</p>` : '<p class="mu" style="margin-top:12px">Turno pendiente de asignación.</p>'}
    ${alergiasTurno.length && (admin || asignadas.some(a=>a.hermana_id===ME.id)) ? `<div class="sec"><div class="tag">Información alimentaria · uso exclusivo del turno</div>${alergiasTurno.map(a=>`<div class="mv"><div class="x"><b>${esc(a.nombre)}</b><br><small>${esc(a.alergias||'Sin alergias indicadas')} ${esc(a.observaciones||'')}</small></div></div>`).join('')}</div>` : ''}
    ${admin ? `<div class="sec" style="padding:14px 0 0"><b>Gestionar asignación</b><form data-f="cocina-asignar" data-id="${t.id}" style="margin-top:8px"><div class="grid">${d.hermanas.map(h=>`<label class="mu"><input type="checkbox" name="hermana" value="${h.id}" ${asignadas.some(a=>a.hermana_id===h.id)?'checked':''}> ${esc(h.nombre)}</label>`).join('')}</div><button class="chip on" style="margin-top:10px">Guardar asignación</button></form>
    <details style="margin-top:14px"><summary class="chip">Editar turno</summary><form data-f="cocina-edit" data-id="${t.id}" style="margin-top:12px"><div class="row"><div style="flex:1 1 140px">${campo('fecha','Fecha','type="date" required value="'+esc(t.fecha)+'"')}</div><div style="flex:1 1 130px">${campo('turno','Turno','value="'+esc(t.turno || '')+'"')}</div><div style="flex:1 1 180px">${campo('responsable','Responsable','value="'+esc(t.responsable || '')+'"')}</div></div><label class="fl">Menú</label><textarea class="t" name="menu" rows="3">${esc(t.menu || '')}</textarea><label class="fl">Observaciones</label><textarea class="t" name="observaciones" rows="2">${esc(t.observaciones || '')}</textarea><button class="chip on" style="margin-top:10px">Guardar cambios</button></form></details><p style="margin:14px 0 0"><button class="chip" data-a="cocina-del" data-id="${t.id}">Eliminar turno</button></p></div>` : ''}
    <section class="sec"><div class="tag">Compras</div><h3>Tickets del turno</h3>${gastos.length ? gastos.map(x=>`<div class="mv"><div class="x"><b>${esc(x.nombre_archivo)}</b><br><small class="mu">${fechaBonita((x.creado||'').slice(0,10))}</small></div><a class="chip" target="_blank" href="/api/modulos/cocina/tickets/${x.id}">Abrir</a></div>`).join('') : '<p class="mu">No hay tickets asociados.</p>'}
    ${(d.asignaciones.some(a=>a.turno_id===t.id && a.hermana_id===ME.id)||admin) ? `<form data-f="cocina-ticket" style="margin-top:12px"><input type="hidden" name="turno_cocina_id" value="${t.id}"><label class="fl">Subir ticket (máx. 1 MB)</label><input class="t" type="file" name="ticket" accept="image/jpeg,image/png,image/webp,application/pdf" required><button class="btn" style="margin-top:10px">Guardar ticket</button></form>` : ''}
    </section></article>`;
  }).join('');
  let contenido = '';
  if (COCINA_TAB === 'sorteo') contenido = admin ? `<div class="card"><div class="tag">Organización de turnos</div><h3>Sorteo de cocina</h3><p class="mu">Reparte los próximos sábados entre las hermanas activas, equilibrando el número de turnos asignados. Puedes elegir dos o tres personas por sábado.</p><form data-f="cocina-sorteo"><label class="fl">Personas por turno</label><select class="t" name="personas_por_turno"><option value="2" ${Number(d.personas_por_turno||2)===2?'selected':''}>2 personas</option><option value="3" ${Number(d.personas_por_turno||2)===3?'selected':''}>3 personas</option></select><button class="btn" style="margin-top:14px">Realizar sorteo de los próximos sábados</button></form><p class="mu" style="margin-bottom:0">El sorteo sustituye las asignaciones de los turnos futuros incluidos. Los sábados ya celebrados no se modifican.</p></div>` : '';
  else if (COCINA_TAB === 'tickets') contenido = `<div class="card"><h3>Tickets de compra</h3>${d.tickets.length ? d.tickets.map(t=>`<div class="mv"><div class="x"><b>${esc(t.nombre_archivo)}</b><br><small class="mu">${fechaBonita((t.creado||'').slice(0,10))}</small></div><a class="chip" target="_blank" href="/api/modulos/cocina/tickets/${t.id}">Abrir</a></div>`).join('') : '<p class="mu">Todavía no hay tickets guardados.</p>'}</div>`;
  else contenido = `<section class="sec" style="padding-top:0"><div class="g2">${tarjetas || '<div class="card"><p class="mu">No hay turnos para mostrar.</p></div>'}</div></section>`;
  const opciones=[['mis','Mis turnos'],['cal','Todos los turnos'],...(admin?[['sorteo','Sorteo de turnos']]:[]),['tickets','Tickets']];
  return shell(`<div class="top"><div class="tag">Organización del cuartel</div><h2>Cocina</h2><p class="mu" style="margin:0">Turnos, menús, presupuesto calculado según las confirmaciones y compras.</p></div>
  ${subnav('cocina',COCINA_TAB,opciones)}
  ${admin && COCINA_TAB==='cal' ? `<section class="card" style="margin-bottom:16px"><div class="tag">Planificación</div><h3>Nuevo turno de cocina</h3><form data-f="cocina-new"><div class="row" style="align-items:flex-end"><div style="flex:1 1 140px">${campo('fecha','Fecha','type="date" required')}</div><div style="flex:1 1 130px">${campo('turno','Turno','placeholder="Comida / cena"')}</div><div style="flex:1 1 180px">${campo('responsable','Responsable')}</div><button class="btn">Añadir turno</button></div><label class="fl">Menú</label><textarea class="t" name="menu" rows="3"></textarea><label class="fl">Observaciones</label><textarea class="t" name="observaciones" rows="2"></textarea></form></section>` : ''}
  ${contenido}`);
}


async function vActas() {
  const d = await api('GET', '/modulos/actas');
  let contenido='';
  if(ACTAS_TAB==='conv') contenido=`<section class="card"><div class="tag">Secretaría</div><h3>Convocar junta</h3><form data-f="junta-new"><div class="row"><div style="flex:1 1 140px">${campo('fecha','Fecha','type="date" required')}</div><div style="flex:1 1 120px">${campo('hora','Hora','type="time"')}</div><div style="flex:1 1 180px">${campo('lugar','Lugar')}</div></div><label class="fl">Convocatoria</label><textarea class="t" name="convocatoria" rows="2"></textarea><label class="fl">Orden del día</label><textarea class="t" name="orden_dia" rows="4"></textarea><button class="btn" style="margin-top:12px">Crear convocatoria</button></form></section>
  <section class="sec"><div class="tag">Juntas</div><h3>Convocatorias registradas</h3>${d.juntas.length?d.juntas.map(j=>`<div class="card" style="margin-bottom:12px"><div class="row" style="justify-content:space-between"><span class="pill">${esc(j.estado)}</span><span class="mu">${fechaBonita(j.fecha)} · ${esc(j.hora||'')}</span></div><h3>${esc(j.lugar||'Junta')}</h3><p>${esc(j.convocatoria||'')}</p><p class="mu"><b>Orden del día</b><br>${esc(j.orden_dia||'Sin definir')}</p><details><summary class="chip">Editar convocatoria</summary><form data-f="junta-edit" data-id="${j.id}" style="margin-top:10px"><div class="two formgrid"><div>${campo('fecha','Fecha','type="date" required value="'+esc(j.fecha)+'"')}</div><div>${campo('hora','Hora','type="time" value="'+esc(j.hora||'')+'"')}</div><div>${campo('lugar','Lugar','value="'+esc(j.lugar||'')+'"')}</div><div><label class="fl">Estado</label><select class="t" name="estado"><option value="convocada" ${j.estado==='convocada'?'selected':''}>Convocada</option><option value="celebrada" ${j.estado==='celebrada'?'selected':''}>Celebrada</option><option value="cancelada" ${j.estado==='cancelada'?'selected':''}>Cancelada</option></select></div></div><label class="fl">Convocatoria</label><textarea class="t" name="convocatoria" rows="2">${esc(j.convocatoria||'')}</textarea><label class="fl">Orden del día</label><textarea class="t" name="orden_dia" rows="3">${esc(j.orden_dia||'')}</textarea><button class="chip on">Guardar cambios</button></form></details><p style="margin:12px 0 0"><button class="chip" data-a="junta-del" data-id="${j.id}">Eliminar convocatoria</button></p></div>`).join(''):'<div class="card"><p class="mu">No hay juntas convocadas.</p></div>'}</section>`;
  if(ACTAS_TAB==='act') contenido=`<section class="sec" style="padding-top:0"><div class="tag">Archivo de secretaría</div><h3>Actas</h3>${d.juntas.filter(j=>d.actas.some(a=>a.junta_id===j.id)).map(j=>{const a=d.actas.find(x=>x.junta_id===j.id);return `<article class="card" style="margin-bottom:12px"><div class="row" style="justify-content:space-between"><b>${esc(j.lugar||'Junta')}</b><span class="mu">${fechaBonita(j.fecha)}</span></div><p class="mu">Orden del día: ${esc(j.orden_dia||'—')}</p><form data-f="acta-save" data-id="${j.id}"><label class="fl">Texto del acta</label><textarea class="t" name="texto" rows="6" required>${esc(a.texto||'')}</textarea><label class="fl">Acuerdos</label><textarea class="t" name="acuerdos" rows="3">${esc(a.acuerdos||'')}</textarea><button class="btn" style="margin-top:10px">Guardar acta</button></form></article>`;}).join('')||'<div class="card"><p class="mu">Todavía no hay actas redactadas.</p></div>'}</section>`;
  if(ACTAS_TAB==='est') contenido=`<div class="card"><div class="tag">Documentación</div><h3>Estatutos</h3><p class="mu">La maqueta contempla este apartado. El documento de estatutos todavía no está guardado en el sistema, así que no mostraré un enlace de descarga que no funcione.</p></div>`;
  return shell(`<div class="top"><div class="tag">Secretaría</div><h2>Juntas y actas</h2><p class="mu" style="margin:0">Convocatorias, orden del día, asistencia y acuerdos.</p></div>
  ${subnav('actas',ACTAS_TAB,[['conv','Convocatoria'],['act','Actas'],['est','Estatutos']])}
  ${contenido}`);
}


function extraRow(x={}) { return `<div class="extra-row card" style="margin:10px 0;padding:12px"><div class="two formgrid"><div>${campo('nombre','Concepto','required value="'+esc(x.nombre||'')+'"')}</div><div><label class="fl">Categoría</label><select class="t" name="categoria"><option ${x.categoria==='Cuaresma'?'selected':''}>Cuaresma</option><option ${x.categoria==='Semana Santa'?'selected':''}>Semana Santa</option><option ${!x.categoria||x.categoria==='Otros'?'selected':''}>Otros</option></select></div><div>${campo('importe','Importe (€)','type="number" min="0" step="0.01" value="'+(Number(x.importe_centimos||0)/100)+'"')}</div><div><label class="fl">Aplicación</label><select class="t" name="tipo"><option value="una_vez" ${x.tipo==='una_vez'?'selected':''}>Una sola vez</option><option value="por_sabado" ${x.tipo==='por_sabado'?'selected':''}>Cada sábado que asista</option></select></div></div><button type="button" class="chip" data-a="extra-del" style="margin-top:8px">Eliminar concepto</button></div>`; }
async function vTesoreria() {
  const d = await api('GET', '/modulos/tesoreria');
  const ingresos=d.totales.ingresos, gastos=d.totales.gastos, saldo=ingresos-gastos;
  const totalPendiente=d.cuotas_pendientes.reduce((a,c)=>a+Number(c.restante_centimos||0),0);
  const movimientosVisibles=d.movimientos.filter(x=>(TES_FILTRO.tipo==='todos'||x.tipo===TES_FILTRO.tipo)&&(!TES_FILTRO.desde||x.fecha>=TES_FILTRO.desde)&&(!TES_FILTRO.hasta||x.fecha<=TES_FILTRO.hasta)&&(!TES_FILTRO.texto||(x.concepto+' '+(x.categoria||'')+' '+(x.hermana||'')).toLowerCase().includes(TES_FILTRO.texto.toLowerCase())));
  const moneyParam=k=>Number(d.parametros?.[k]||0)/100;
  const mensual=d.estadisticas?.mensuales||[], maxMes=Math.max(1,...mensual.flatMap(x=>[Number(x.ingresos||0),Number(x.gastos||0)]));
  const pal=['#e8c23a','#c9971a','#8b6b45','#b8956a','#6b4f2f','#f0d878','#a07f4f','#d7b98c','#3b2c1c'];
  const donut=tipo=>{
    const arr=(d.estadisticas?.categorias||[]).filter(x=>x.tipo===tipo&&Number(x.total)>0);
    const total=arr.reduce((a,x)=>a+Number(x.total),0);
    if(!total)return '<p class="mu">Todavía no hay datos para este gráfico.</p>';
    let acum=0;const stops=arr.map((x,i)=>{const ini=acum;acum+=Number(x.total)/total*100;return `${pal[i%pal.length]} ${ini}% ${acum}%`;}).join(',');
    return `<div class="row" style="align-items:center;gap:18px"><div class="donut" style="width:140px;height:140px;flex:0 0 140px;border-radius:50%;background:conic-gradient(${stops});position:relative"></div><div style="flex:1;min-width:150px">${arr.map((x,i)=>`<div class="lg"><i style="background:${pal[i%pal.length]}"></i><span>${esc(x.categoria||'Sin categoría')}</span><b>${Math.round(Number(x.total)/total*100)}%</b></div>`).join('')}</div></div>`;
  };
  let contenido='';
  if(TES_TAB==='res') contenido=`<section class="kp"><div class="card"><span class="tag">Ingresos</span><b style="color:var(--ok)">${euros(ingresos)}</b></div><div class="card"><span class="tag">Gastos</span><b style="color:var(--ko)">${euros(gastos)}</b></div><div class="card"><span class="tag">Resultado</span><b>${euros(saldo)}</b></div></section>
  <div class="card" style="margin-top:14px"><h3>Ingresos y gastos por mes</h3>${mensual.length?`<div class="cols">${mensual.map(x=>{const i=Number(x.ingresos||0),g=Number(x.gastos||0);return `<div class="col"><small><b>${euros(i-g)}</b></small><div class="pair"><i style="height:${Math.max(2,i/maxMes*100)}%;background:var(--go)"></i><i style="height:${Math.max(2,g/maxMes*100)}%;background:var(--br)"></i></div><span class="mu">${esc(x.periodo)}</span></div>`;}).join('')}</div><p class="mu">Dorado: ingresos · Marrón: gastos · Cifra: resultado del mes</p>`:'<p class="mu">Todavía no hay movimientos registrados.</p>'}</div>
  <div class="grid" style="margin-top:14px"><div class="card"><h3>¿En qué gastamos?</h3>${donut('gasto')}</div><div class="card"><h3>¿De dónde ingresamos?</h3>${donut('ingreso')}</div></div>`;
  if(TES_TAB==='mov') contenido=`<div class="card"><div class="tag">Contabilidad</div><h3>Movimientos</h3><form data-f="tes-movimiento"><div class="two formgrid"><div><label class="fl">Tipo</label><select class="t" name="tipo"><option value="ingreso">Ingreso</option><option value="gasto">Gasto</option></select></div><div>${campo('fecha','Fecha','type="date" required value="'+new Date().toISOString().slice(0,10)+'"')}</div><div>${campo('concepto','Concepto','required')}</div><div>${campo('categoria','Categoría')}</div><div>${campo('importe','Importe (€)','type="number" min="0.01" step="0.01" required')}</div></div><button class="btn" style="margin-top:12px">Guardar movimiento</button></form></div>
  <div class="card" style="margin-top:14px"><form data-f="tes-filtro" class="two formgrid"><div><label class="fl">Tipo</label><select class="t" name="tipo"><option value="todos" ${TES_FILTRO.tipo==='todos'?'selected':''}>Todos</option><option value="ingreso" ${TES_FILTRO.tipo==='ingreso'?'selected':''}>Ingresos</option><option value="gasto" ${TES_FILTRO.tipo==='gasto'?'selected':''}>Gastos</option></select></div><div>${campo('texto','Buscar','value="'+esc(TES_FILTRO.texto)+'" placeholder="Concepto, categoría o hermana"')}</div><div>${campo('desde','Desde','type="date" value="'+TES_FILTRO.desde+'"')}</div><div>${campo('hasta','Hasta','type="date" value="'+TES_FILTRO.hasta+'"')}</div><div class="row"><button class="btn">Filtrar</button><button type="button" class="chip" data-a="tes-filtro-reset">Limpiar</button></div></form><small class="mu">${movimientosVisibles.length} de ${d.movimientos.length} movimientos cargados</small>${movimientosVisibles.map(x=>`<div class="mv"><div class="ic" style="background:${x.tipo==='gasto'?'var(--ko)':'var(--ok)'}"></div><div class="x"><b>${esc(x.concepto)}</b><br><small class="mu">${fechaBonita(x.fecha)} · ${esc(x.categoria||'')} · ${esc(x.hermana||'')}</small></div><b class="amt">${x.tipo==='gasto'?'−':'+'}${euros(x.importe_centimos)}</b>${x.tickets?x.tickets.split(',').map(id=>`<a class="chip" target="_blank" href="/api/modulos/tesoreria/tickets/${id}">Ticket</a>`).join(''):''}</div>`).join('')||'<p class="mu">No hay movimientos con esos filtros.</p>'}</div>`;
  if(TES_TAB==='rec') contenido=`<div class="card"><h3>Gastos fijos</h3><p class="mu">Se repiten cada mes, trimestre o año y quedan configurados para su control.</p>${d.gastos_fijos.map(g=>`<div class="mv"><div class="x"><b>${esc(g.concepto)}</b><br><small class="mu">${esc(g.categoria||'Sin categoría')} · ${esc(g.periodicidad)} · día ${g.dia} · ${g.activo?'Activo':'Inactivo'}</small></div><b class="amt">${euros(g.importe_centimos)}</b><button class="chip" data-a="fijo-del" data-id="${g.id}">Eliminar</button><details style="flex:1 1 100%"><summary class="chip">Editar</summary><form data-f="tes-fijo-edit" data-id="${g.id}" class="two formgrid"><div>${campo('concepto','Concepto','required value="'+esc(g.concepto)+'"')}</div><div>${campo('categoria','Categoría','value="'+esc(g.categoria||'')+'"')}</div><div>${campo('importe','Importe (€)','type="number" step="0.01" value="'+(g.importe_centimos/100)+'"')}</div><div><label class="fl">Periodicidad</label><select class="t" name="periodicidad"><option value="mensual" ${g.periodicidad==='mensual'?'selected':''}>Mensual</option><option value="trimestral" ${g.periodicidad==='trimestral'?'selected':''}>Trimestral</option><option value="anual" ${g.periodicidad==='anual'?'selected':''}>Anual</option></select></div><div>${campo('dia','Día','type="number" min="1" max="28" value="'+g.dia+'"')}</div><button class="chip on">Guardar</button></form></details></div>`).join('')||'<p class="mu">No hay gastos fijos configurados.</p>'}<form data-f="tes-fijo" class="two formgrid" style="margin-top:18px"><div>${campo('concepto','Concepto','required')}</div><div>${campo('categoria','Categoría')}</div><div>${campo('importe','Importe (€)','type="number" min="0.01" step="0.01" required')}</div><div><label class="fl">Periodicidad</label><select class="t" name="periodicidad"><option value="mensual">Mensual</option><option value="trimestral">Trimestral</option><option value="anual">Anual</option></select></div><div>${campo('dia','Día de cargo','type="number" min="1" max="28" value="1"')}</div><button class="btn">Añadir gasto fijo</button></form></div>`;
  if(TES_TAB==='pun') contenido=`<div class="card"><h3>Pagos por revisar</h3><p class="mu">Cada pago se confirma o rechaza después de comprobar el ingreso.</p>${d.pagos_pendientes.length?d.pagos_pendientes.map(p=>`<div class="mv"><div class="x"><b>${esc(p.hermana)}</b><br><small class="mu">${fechaBonita(p.fecha_pago)} · ${esc(p.metodo||'')} · ${esc(p.periodo||p.concepto||'Pago')}</small></div><b class="amt">${euros(p.importe_centimos)}</b><button class="chip on" data-a="pago-confirm" data-id="${p.id}">Confirmar</button><button class="chip" data-a="pago-reject" data-id="${p.id}">Rechazar</button></div>`).join(''):'<p class="mu">No hay pagos pendientes de revisión.</p>'}</div>`;
  if(TES_TAB==='gp') contenido=`<div class="card"><h3>Gastos pendientes de incluir</h3><p class="mu">Tickets de cocina pendientes de vincular a un movimiento contable.</p>${d.tickets.filter(t=>!t.movimiento_id).map(t=>`<div class="mv"><div class="x"><b>${esc(t.nombre_archivo)}</b><br><small class="mu">${fechaBonita((t.creado||'').slice(0,10))} · ${esc(t.turno_cocina||'Cocina')}</small></div><a class="chip" target="_blank" href="/api/modulos/tesoreria/tickets/${t.id}">Ver ticket</a><details style="flex:1 1 100%"><summary class="chip">Vincular a un movimiento</summary><form data-f="tes-ticket-link" data-id="${t.id}"><select class="t" name="movimiento_id"><option value="">Sin movimiento</option>${d.movimientos.map(m=>`<option value="${m.id}">${fechaBonita(m.fecha)} · ${esc(m.concepto)} · ${euros(m.importe_centimos)}</option>`).join('')}</select><button class="chip on">Guardar vínculo</button></form></details></div>`).join('')||'<p class="mu">No hay tickets pendientes de incluir.</p>'}</div>`;
  if(TES_TAB==='pen') contenido=`<div class="card"><h3>Cuotas pendientes</h3>${d.cuotas_pendientes.length?d.cuotas_pendientes.map(c=>`<div class="mv"><div class="x"><b>${esc(c.nombre)}</b><br><small class="mu">${esc(c.periodo)} · ${esc(c.estado)}</small></div><b class="amt">${euros(c.restante_centimos)}</b></div>`).join(''):'<p class="mu">No hay cuotas pendientes.</p>'}</div>`;
  if(TES_TAB==='inf') contenido=`<div class="card"><h3>Informe económico</h3>${d.informes.map(i=>`<div class="mv"><div class="x"><b>${esc(i.anio)}</b><br><small class="mu">Ingresos: ${euros(i.ingresos)} · Gastos: ${euros(i.gastos)}</small></div><b class="amt">${euros(i.ingresos-i.gastos)}</b></div>`).join('')||'<p class="mu">Todavía no hay movimientos para resumir.</p>'}</div><div class="card" style="margin-top:14px"><h3>Archivo de tickets</h3>${d.tickets.map(t=>`<div class="mv"><div class="x"><b>${esc(t.nombre_archivo)}</b><br><small class="mu">${fechaBonita((t.creado||'').slice(0,10))}</small></div><a class="chip" target="_blank" href="/api/modulos/tesoreria/tickets/${t.id}">Abrir</a></div>`).join('')||'<p class="mu">Sin tickets.</p>'}</div>`;
  if(TES_TAB==='cfg') {
    const extras=d.cuotas_extraordinarias||[];
    contenido=subnav('tescfg',TES_CFG_TAB,[['pre','Precios y cuota'],['ext','Cuotas extraordinarias']]);
    if(TES_CFG_TAB==='pre') contenido+=`<div class="card"><div class="tag">Parámetros económicos</div><h3>Precios y cuota</h3><p class="mu">Configura aquí los importes. La web los utiliza para calcular automáticamente los cargos y presupuestos; no hay cantidades fijas en el código.</p><form data-f="tes-config" class="two formgrid"><div>${campo('cuota_mensual','Cuota mensual (€)','type="number" min="0.01" step="0.01" required value="'+(d.cuota_mensual||'')+'"')}</div><div>${campo('sabado_precio','Sábado · asistencia (€)','type="number" min="0" step="0.01" value="'+moneyParam('sabado_precio_centimos')+'"')}</div><div>${campo('invitada_precio','Invitada (€)','type="number" min="0" step="0.01" value="'+moneyParam('invitada_precio_centimos')+'"')}</div><div>${campo('copa_precio','Copa (€)','type="number" min="0" step="0.01" value="'+moneyParam('copa_precio_centimos')+'"')}</div><div>${campo('refresco_precio','Refresco (€)','type="number" min="0" step="0.01" value="'+moneyParam('refresco_precio_centimos')+'"')}</div><div>${campo('cocina_precio_persona','Presupuesto de cocina por comensal (€)','type="number" min="0" step="0.01" value="'+moneyParam('cocina_precio_persona_centimos')+'"')}</div><div><label class="fl">Personas por turno en el sorteo</label><select class="t" name="personas_por_turno"><option value="2" ${Number(d.parametros?.cocina_personas_por_turno||2)===2?'selected':''}>2 personas</option><option value="3" ${Number(d.parametros?.cocina_personas_por_turno||2)===3?'selected':''}>3 personas</option></select></div><button class="btn">Guardar parámetros</button></form></div>`;
    else contenido+=`<div class="card"><div class="tag">Cargos configurables</div><h3>Cuotas extraordinarias de este año</h3><p class="mu">Puedes crear, editar o eliminar los conceptos y sus importes. Elige si se aplican una sola vez o en cada sábado que corresponda.</p><form data-f="tes-extras"><div id="tes-extras-rows">${extras.map(x=>extraRow(x)).join('')}</div><p><button type="button" class="chip" data-a="extra-add">Añadir cuota extraordinaria</button></p><button class="btn">Guardar cuotas extraordinarias</button></form></div>`;
  }
  if(TES_TAB==='imp') contenido=`<div class="card"><h3>Importar el último informe</h3><p class="mu">Esta sección de la maqueta necesita un formato de informe definido para poder importar movimientos sin duplicarlos. No voy a simular una importación ni inventar columnas.</p><h3 style="margin-top:22px">Saldos de partida</h3><p class="mu">Los saldos iniciales deben registrarse una sola vez antes de importar el histórico. Esta función queda pendiente de conectar al formato real del informe.</p></div>`;
  const tabs=[['res','Estadísticas'],['mov','Movimientos'],['rec','Gastos fijos'],['pun','Por puntear ('+d.pagos_pendientes.length+')'],['gp','Gastos pendientes'],['pen','Cuotas pendientes'],['inf','Informe'],['cfg','Precios y cuota'],['imp','Importar']];
  return shell(`<div class="top"><div class="tag">Gestión económica</div><h2>Tesorería</h2><p class="mu" style="margin:0">Contabilidad, parámetros, pagos e informes del cuartel.</p></div>
  <section class="hero2"><div class="tag" style="color:var(--go)">Total disponible</div><div class="big">${euros(saldo)}</div><div class="two"><div><small>Ingresos</small><b>${euros(ingresos)}</b></div><div><small>Gastos</small><b>${euros(gastos)}</b></div></div></section>
  ${subnav('tesoreria',TES_TAB,tabs)}
  ${contenido}`);
}


function vPerfil() {
  shell(`<div class="top"><div class="tag">Mi perfil</div><h2>${esc(ME.nombre)}</h2><p class="mu" style="margin:0">${esc(ME.email || '')} · ${esc(ME.cargo || 'Hermana')}</p></div>
<div class="card" style="margin-top:18px;max-width:520px"><h3>Cambiar mi contraseña</h3><form data-f="perfil">${campo('actual', 'Contraseña actual (si ya tenías una)', 'type="password" autocomplete="current-password"')}${campo('nueva', 'Contraseña nueva', 'type="password" required minlength="8" autocomplete="new-password"')}<button class="btn" style="margin-top:16px">Guardar contraseña</button></form></div>`);
}

/* ---------- administración ---------- */
const PERM = { none: 'Solo zona hermana', tes: 'Tesorería', actas: 'Actas' };
const CUENTA = { sin: 'Sin invitar', invitada: 'Invitación preparada', activa: 'Cuenta activa' };
const TABS = [['hermanas', 'Hermanas'], ['cargos', 'Cargos y permisos'], ['whatsapp', 'Bienvenida por WhatsApp'], ['noticias', 'Noticias'], ['historia', 'Historia']];
const adm = (tab, html) => `<div class="top"><div class="tag">Panel privado</div><h2>Administración</h2></div><div class="sub" style="margin-top:14px">${TABS.map(([k, t]) => `<a class="${k === tab ? 'on' : ''}" href="#/admin/${k}">${t}</a>`).join('')}</div>${html}`;
async function vAdmin(tab) {
  if (tab === 'hermanas') {
    const [hs, cs] = await Promise.all([api('GET', '/admin/hermanas'), api('GET', '/admin/cargos')]);
    const pend = hs.filter(h => h.estado !== 'Baja' && h.telefono && h.cuenta === 'sin').length;
    return shell(adm(tab, `<div class="card"><h3>Nueva hermana</h3><form data-f="her-new"><div class="row" style="align-items:flex-end"><div style="flex:2 1 200px">${campo('nombre', 'Nombre y apellidos', 'required')}</div><div style="flex:2 1 220px">${campo('email', 'Correo (para entrar en la zona)', 'type="email"')}</div><div style="flex:2 1 190px">${campo('telefono', 'Teléfono / WhatsApp', 'type="tel" placeholder="+34 600 000 000"')}</div><div style="flex:1 1 150px"><label class="fl">Cargo</label><select class="t" name="cargo_id">${cs.map(c => `<option value="${c.id}" ${c.nombre === 'Hermana' ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></div><div style="flex:0 0 110px">${campo('anio_entrada', 'Año de entrada', 'type="number" min="2000" max="2100"')}</div><button class="btn" style="padding:10px 20px">Añadir</button></div><p class="mu" style="font-size:12px;margin:10px 0 0">Puedes escribir un número español de 9 cifras o incluir el prefijo internacional (+34).</p></form>
<p class="mu" style="font-size:13px;margin:14px 0 0">${pend ? `Hay ${pend} hermana${pend === 1 ? '' : 's'} pendiente${pend === 1 ? '' : 's'} de recibir la bienvenida. Envíala individualmente desde su ficha.` : 'La bienvenida se prepara desde la ficha de cada hermana.'}</p></div><div style="height:16px"></div>${hs.map(h => rowHer(h, cs)).join('')}`));
  }
  if (tab === 'cargos') {
    const cs = await api('GET', '/admin/cargos');
    return shell(adm(tab, `<div class="card"><p class="mu" style="margin-top:0">Cada junta puede crear los cargos que necesite y decidir qué puede hacer cada uno. La administradora se marca aparte, en cada hermana.</p>${cs.map(c => `<form class="mv" data-f="cargo-save" data-id="${c.id}" style="flex-wrap:wrap;gap:8px"><input class="t" name="nombre" value="${esc(c.nombre)}" style="flex:1 1 160px" required><select class="t" name="permiso" style="width:200px">${Object.entries(PERM).map(([k, v]) => `<option value="${k}" ${c.permiso === k ? 'selected' : ''}>${v}</option>`).join('')}</select><span class="mu" style="font-size:13px;width:90px">${c.usos} hermana${c.usos === 1 ? '' : 's'}</span><button class="chip on">Guardar</button>${c.nombre === 'Hermana' ? '' : `<button type="button" class="chip" data-a="cargo-del" data-id="${c.id}">Borrar</button>`}</form>`).join('')}</div>
<div class="card" style="margin-top:16px"><h3>Nuevo cargo</h3><form data-f="cargo-new"><div class="row" style="align-items:flex-end"><div style="flex:2 1 200px">${campo('nombre', 'Nombre del cargo', 'required placeholder="Ej.: Camarera"')}</div><div style="flex:1 1 200px"><label class="fl">Permisos</label><select class="t" name="permiso">${Object.entries(PERM).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div><button class="btn" style="padding:10px 20px">Añadir cargo</button></div></form></div>`));
  }
  if (tab === 'whatsapp') {
    return shell(adm(tab, `<div class="card" style="max-width:720px"><h3>Bienvenida y contraseñas por WhatsApp</h3><p class="mu">Desde la ficha de cada hermana puedes preparar un mensaje de WhatsApp con su enlace personal para crear la contraseña.</p><ul class="mu" style="padding-left:20px;line-height:1.8"><li>Añade su número de teléfono, preferiblemente con prefijo internacional.</li><li>Pulsa <b>Enviar bienvenida por WhatsApp</b> para abrir la conversación con el mensaje preparado.</li><li>Revisa el mensaje y pulsa Enviar en WhatsApp. No se envía automáticamente.</li><li>Para una contraseña nueva, utiliza <b>Restablecer contraseña</b>. El enlace caduca en 24 horas.</li></ul><p class="mu" style="font-size:13px;margin-bottom:0">Los enlaces son personales y de un solo uso. La bienvenida caduca en 7 días. No compartas el enlace con otras personas.</p></div>`));
  }
  if (tab === 'noticias') {
    const d = await api('GET', '/public');
    return shell(adm(tab, `<div class="card"><h3>Nueva noticia</h3><form data-f="noticia-new">${campo('titulo', 'Título', 'required maxlength="150" placeholder="Ej.: Sábado de Pan y Peces"')}<label class="fl" style="text-align:left">Texto</label><textarea class="t" name="texto" rows="6" required maxlength="6000" placeholder="Cuenta cómo fue el sábado…"></textarea><label class="fl" style="text-align:left">Foto (opcional)</label><input type="file" name="foto" accept="image/*"><p style="margin:18px 0 0"><button class="btn">Publicar en la web</button></p></form></div>
<div class="card" style="margin-top:16px"><h3>Publicadas</h3>${d.noticias.length ? d.noticias.map(n => `<div class="mv">${n.imagen ? `<img src="/media/${n.imagen}" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:10px">` : ''}<div class="x"><b>${esc(n.titulo)}</b><br><small class="mu">${esc(n.fecha)} · ${esc(n.texto.slice(0, 70))}…</small></div><button class="chip" data-a="noticia-del" data-id="${n.id}">Eliminar</button></div>`).join('') : '<p class="mu" style="margin:0">Todavía no hay noticias.</p>'}</div>`));
  }
  if (tab === 'historia') {
    const d = await api('GET', '/public');
    return shell(adm(tab, `<div class="card"><h3>Línea de tiempo de la historia</h3><p class="mu">Cada hito aparece en la web pública, junto a la historia del cuartel.</p><form data-f="historia"><div id="hitos">${d.hitos.map(hitoRow).join('')}</div><p style="margin:14px 0 0"><button type="button" class="chip" data-a="hito-add">Añadir hito</button> <button class="btn">Guardar</button></p></form></div>`));
  }
  location.hash = '#/admin/hermanas';
}
const hitoRow = h => `<div class="row" style="margin-bottom:12px;align-items:flex-start"><input class="t" name="anio" style="width:90px" value="${esc(h.anio)}" placeholder="Año"><textarea class="t" name="texto" rows="2" style="flex:1;min-width:200px" placeholder="Qué pasó">${esc(h.texto)}</textarea><button type="button" class="chip" data-a="hito-del">✕</button></div>`;
function rowHer(h, cs) {
  const puedeInvitar = h.estado !== 'Baja' && !!h.telefono;
  return `<form class="card" data-f="her-save" data-id="${h.id}" style="margin-bottom:12px${h.estado === 'Baja' ? ';opacity:.65' : ''}">
<div class="row" style="align-items:flex-end"><div style="flex:2 1 190px"><label class="fl">Nombre</label><input class="t" name="nombre" value="${esc(h.nombre)}" required></div><div style="flex:2 1 200px"><label class="fl">Correo</label><input class="t" type="email" name="email" value="${esc(h.email || '')}"></div><div style="flex:2 1 180px"><label class="fl">Teléfono / WhatsApp</label><input class="t" type="tel" name="telefono" value="${esc(h.telefono || '')}" placeholder="+34 600 000 000"></div><div style="flex:1 1 145px"><label class="fl">Cargo</label><select class="t" name="cargo_id">${cs.map(c => `<option value="${c.id}" ${c.id === h.cargo_id ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></div><div style="flex:1 1 115px"><label class="fl">Estado</label><select class="t" name="estado">${['Activa', 'Pasiva', 'Baja'].map(e => `<option ${e === h.estado ? 'selected' : ''}>${e}</option>`).join('')}</select></div></div>
<div class="row" style="align-items:center;margin-top:12px"><div style="flex:0 0 110px"><label class="fl">Año de entrada</label><input class="t" type="number" name="anio_entrada" min="2000" max="2100" value="${h.anio_entrada || ''}"></div><div class="av" style="margin:0;width:56px;height:56px;font-size:18px">${h.foto ? `<img src="/media/${h.foto}" alt="">` : iniciales(h.nombre)}</div><div style="flex:1 1 200px"><label class="fl">Foto</label><input type="file" name="foto" accept="image/*" style="font-size:13px"></div>${h.foto ? `<button type="button" class="chip" data-a="her-quitar-foto" data-id="${h.id}">Quitar foto</button>` : ''}<label class="mu" style="font-size:13px"><input type="checkbox" name="visible_web" ${h.visible_web ? 'checked' : ''}> Aparece en la web</label><label class="mu" style="font-size:13px"><input type="checkbox" name="es_admin" ${h.es_admin ? 'checked' : ''}> Administradora</label></div>
<div class="row" style="align-items:center;margin-top:14px"><button class="btn" style="padding:9px 20px">Guardar</button><span class="pill ${h.cuenta === 'activa' ? 'ok' : ''}">${CUENTA[h.cuenta]}</span>${puedeInvitar ? (h.cuenta === 'activa' ? `<button type="button" class="chip" data-a="her-reset" data-id="${h.id}">Restablecer contraseña por WhatsApp</button>` : `<button type="button" class="chip" data-a="her-invitar" data-id="${h.id}">${h.cuenta === 'invitada' ? 'Reenviar bienvenida por WhatsApp' : 'Enviar bienvenida por WhatsApp'}</button>`) : (h.estado !== 'Baja' ? '<span class="mu" style="font-size:12px">Añade un teléfono para enviar la bienvenida.</span>' : '')}</div></form>`;
}

/* ---------- acciones ---------- */
const FORM = {
  async login(f, d) { await api('POST', '/auth/login', { email: d.get('email'), password: d.get('password') }); await entrar(); },
  async clave(f, d) { if (d.get('p1') !== d.get('p2')) throw new Error('Las contraseñas no coinciden'); await api('POST', '/auth/password/set', { token: f.dataset.t, password: d.get('p1') }); await entrar(); },
  async setup(f, d) { await api('POST', '/setup', { key: d.get('key'), password: d.get('p1') }); await entrar(); },
  async perfil(f, d) { await api('POST', '/auth/password/change', { actual: d.get('actual'), nueva: d.get('nueva') }); f.reset(); toast('Contraseña cambiada'); },
  async 'her-new'(f, d) { await api('POST', '/admin/hermanas', { nombre: d.get('nombre'), email: d.get('email'), telefono: d.get('telefono'), cargo_id: +d.get('cargo_id'), anio_entrada: d.get('anio_entrada') || null }); toast('Hermana añadida'); render(); },
  async 'her-save'(f, d) {
    const b = { nombre: d.get('nombre'), email: d.get('email'), telefono: d.get('telefono'), cargo_id: +d.get('cargo_id'), estado: d.get('estado'), anio_entrada: d.get('anio_entrada') ? +d.get('anio_entrada') : null, visible_web: !!d.get('visible_web'), es_admin: !!d.get('es_admin') };
    const fl = d.get('foto'); if (fl && fl.size) b.foto = await reducir(fl, 480);
    await api('PUT', '/admin/hermanas/' + f.dataset.id, b); toast('Guardado'); render();
  },
  async 'cargo-new'(f, d) { await api('POST', '/admin/cargos', { nombre: d.get('nombre'), permiso: d.get('permiso') }); toast('Cargo creado'); render(); },
  async 'cargo-save'(f, d) { await api('PUT', '/admin/cargos/' + f.dataset.id, { nombre: d.get('nombre'), permiso: d.get('permiso') }); toast('Guardado'); render(); },
  async 'noticia-new'(f, d) { const b = { titulo: d.get('titulo'), texto: d.get('texto') }; const fl = d.get('foto'); if (fl && fl.size) b.imagen = await reducir(fl, 1400, 0.8); await api('POST', '/admin/noticias', b); toast('Noticia publicada. Ya aparece en la web.'); render(); },
  async 'sabado-new'(f,d) { await api('POST','/modulos/sabados',{fecha:d.get('fecha'),hora:d.get('hora'),titulo:d.get('titulo'),descripcion:d.get('descripcion')}); toast('Sábado creado'); render(); },
  async 'sabado-rsvp'(f,d) { const alergias=d.getAll('alergia').concat(d.get('alergias_extra')||'').filter(Boolean).join(', '); await api('POST','/modulos/sabados/'+f.dataset.id+'/asistencia',{asiste:d.get('asiste')==='1',acompanantes:d.get('acompanantes'),detalle_acompanantes:'',alergias,observaciones:d.get('observaciones')}); toast('Asistencia guardada'); render(); },
  async 'sabado-consumos'(f,d) { await api('POST','/modulos/sabados/'+f.dataset.id+'/consumos',{copas:d.get('copas'),refrescos:d.get('refrescos')}); toast('Consumiciones guardadas'); render(); },
  async 'cuenta-pago'(f,d) { await api('POST','/modulos/cuenta/pagos',{cuota_id:d.get('cuota_id')||null,importe:d.get('importe'),fecha_pago:d.get('fecha_pago'),metodo:d.get('metodo'),concepto:d.get('concepto')}); PAGO_MODAL=false; toast('Pago registrado y pendiente de revisión'); render(); },
  async 'cocina-new'(f,d) { await api('POST','/modulos/cocina',{fecha:d.get('fecha'),turno:d.get('turno'),responsable:d.get('responsable'),presupuesto:d.get('presupuesto'),menu:d.get('menu'),observaciones:d.get('observaciones')}); toast('Turno añadido'); render(); },
  async 'cocina-asignar'(f,d) { await api('PUT','/modulos/cocina/'+f.dataset.id+'/asignacion',{hermanas:d.getAll('hermana')}); toast('Asignación de cocina guardada'); render(); },
  async 'cocina-edit'(f,d) { await api('PUT','/modulos/cocina/'+f.dataset.id,{fecha:d.get('fecha'),turno:d.get('turno'),responsable:d.get('responsable'),presupuesto:d.get('presupuesto'),menu:d.get('menu'),observaciones:d.get('observaciones')}); toast('Turno actualizado'); render(); },
  async 'cocina-ticket'(f,d) { const file=d.get('ticket'); if(!file || !file.size) throw new Error('Selecciona un ticket'); if(file.size>1024*1024) throw new Error('El archivo no puede superar 1 MB'); const datos=await readFileData(file); await api('POST','/modulos/cocina/tickets',{turno_cocina_id:d.get('turno_cocina_id')||null,nombre_archivo:file.name,datos}); toast('Ticket guardado'); render(); },
  async alergias(f,d) { await api('PUT','/modulos/alergias',{alergias:d.getAll('alergia').concat(d.get('alergias')||'').filter(Boolean).join(', '),observaciones:d.get('observaciones')}); toast('Información guardada'); render(); },
  async 'junta-new'(f,d) { await api('POST','/modulos/actas/juntas',{fecha:d.get('fecha'),hora:d.get('hora'),lugar:d.get('lugar'),convocatoria:d.get('convocatoria'),orden_dia:d.get('orden_dia')}); toast('Junta convocada'); render(); },
  async 'junta-edit'(f,d) { await api('PUT','/modulos/actas/juntas/'+f.dataset.id,{fecha:d.get('fecha'),hora:d.get('hora'),lugar:d.get('lugar'),estado:d.get('estado'),convocatoria:d.get('convocatoria'),orden_dia:d.get('orden_dia')}); toast('Convocatoria actualizada'); render(); },
  async 'acta-save'(f,d) { await api('PUT','/modulos/actas/juntas/'+f.dataset.id+'/acta',{texto:d.get('texto'),acuerdos:d.get('acuerdos')}); toast('Acta guardada'); render(); },
  async 'junta-asistencia'(f,d) { await api('PUT','/modulos/actas/juntas/'+f.dataset.id+'/asistencia',{hermanas:d.getAll('hermana')}); toast('Asistencia actualizada'); render(); },
  async 'tes-config'(f,d) { await api('PUT','/modulos/tesoreria/config',{cuota_mensual:d.get('cuota_mensual'),sabado_precio:d.get('sabado_precio'),invitada_precio:d.get('invitada_precio'),copa_precio:d.get('copa_precio'),refresco_precio:d.get('refresco_precio'),cocina_precio_persona:d.get('cocina_precio_persona'),personas_por_turno:d.get('personas_por_turno')}); toast('Parámetros guardados'); render(); },
  async 'cocina-sorteo'(f,d) { const r=await api('POST','/modulos/cocina/sorteo',{personas_por_turno:d.get('personas_por_turno')}); toast('Sorteo realizado: '+r.turnos_sorteados+' turnos'); COCINA_TAB='cal'; render(); },
  async 'tes-filtro'(f,d) { TES_FILTRO={tipo:d.get('tipo')||'todos',texto:d.get('texto')||'',desde:d.get('desde')||'',hasta:d.get('hasta')||''}; if(TES_FILTRO.desde && TES_FILTRO.hasta && TES_FILTRO.desde>TES_FILTRO.hasta) throw new Error('La fecha inicial no puede ser posterior a la final'); render(); },
  async 'tes-movimiento'(f,d) { await api('POST','/modulos/tesoreria/movimientos',{tipo:d.get('tipo'),fecha:d.get('fecha'),concepto:d.get('concepto'),categoria:d.get('categoria'),importe:d.get('importe')}); toast('Movimiento registrado'); render(); },
  async 'tes-fijo'(f,d) { await api('POST','/modulos/tesoreria/gastos-fijos',{concepto:d.get('concepto'),categoria:d.get('categoria'),importe:d.get('importe'),periodicidad:d.get('periodicidad'),dia:d.get('dia')}); toast('Gasto fijo añadido'); render(); },
  async 'tes-fijo-edit'(f,d) { await api('PUT','/modulos/tesoreria/gastos-fijos/'+f.dataset.id,{concepto:d.get('concepto'),categoria:d.get('categoria'),importe:d.get('importe'),periodicidad:d.get('periodicidad'),dia:d.get('dia'),activo:d.has('activo')}); toast('Gasto fijo actualizado'); render(); },
  async 'tes-ticket'(f,d) { const file=d.get('ticket'); if(!file || !file.size) throw new Error('Selecciona un ticket'); if(file.size>1024*1024) throw new Error('El archivo no puede superar 1 MB'); const datos=await readFileData(file); await api('POST','/modulos/tesoreria/tickets',{movimiento_id:d.get('movimiento_id')||null,sabado_id:d.get('sabado_id')||null,nombre_archivo:file.name,datos}); toast('Ticket guardado'); render(); },
  async 'tes-ticket-link'(f,d) { await api('PUT','/modulos/tesoreria/tickets/'+f.dataset.id,{movimiento_id:d.get('movimiento_id')||null}); toast('Ticket vinculado al movimiento'); render(); },
  async historia(f) { const hitos = [...f.querySelectorAll('#hitos .row')].map(r => ({ anio: r.querySelector('[name=anio]').value, texto: r.querySelector('[name=texto]').value })); const r = await api('PUT', '/admin/hitos', { hitos }); toast(`Guardado (${r.total} hitos)`); render(); },
};
async function abrirWhatsApp(el, tipo) {
  // Abrimos la pestaña durante el clic del usuario para evitar bloqueos del navegador.
  const w = window.open('about:blank', '_blank');
  if (!w) throw new Error('El navegador ha bloqueado la ventana. Permite las ventanas emergentes para esta web e inténtalo de nuevo.');
  try {
    const r = await api('POST', `/admin/hermanas/${el.dataset.id}/${tipo === 'reset' ? 'reset' : 'invitar'}`);
    const telefono = telefonoWhatsApp(r.telefono);
    if (!telefono) throw new Error('El teléfono guardado no es válido. Revísalo en la ficha de la hermana.');
    const msg = tipo === 'reset'
      ? `Hola, ${r.nombre}. Te envío el enlace para crear una contraseña nueva y acceder a la Zona hermana de Las Tribulaciones de Sara:\n\n${r.link}\n\nEste enlace es personal y caduca en 24 horas. Si no lo has solicitado, puedes ignorar este mensaje.`
      : `¡Hola, ${r.nombre}! Te damos la bienvenida a la Zona hermana de Las Tribulaciones de Sara.\n\nPara crear tu contraseña y acceder a tu cuenta, abre este enlace:\n\n${r.link}\n\nEl enlace es personal y caduca en 7 días. Cuando hayas creado tu contraseña, podrás entrar con tu correo y contraseña.`;
    w.location.href = `https://wa.me/${telefono}?text=${encodeURIComponent(msg)}`;
    toast(tipo === 'reset' ? 'Mensaje de restablecimiento preparado en WhatsApp' : 'Bienvenida preparada en WhatsApp');
  } catch (er) {
    w.close();
    throw er;
  }
}
const ACT = {
  'module-tab'(el) { const k=el.dataset.tab; if(el.dataset.module==='cuenta') CUENTA_TAB=k; if(el.dataset.module==='cocina') COCINA_TAB=k; if(el.dataset.module==='tesoreria') TES_TAB=k; if(el.dataset.module==='tescfg') TES_CFG_TAB=k; if(el.dataset.module==='actas') ACTAS_TAB=k; render(); },

  'cuenta-pago-open'() { PAGO_MODAL=true; render(); },
  'cuenta-pago-close'() { PAGO_MODAL=false; render(); },
  'cuenta-pago-stop'() {},
  'rsvp-choice'(el) { const f = el.closest('form'); f.querySelector('[name=asiste]').value = el.dataset.value; f.querySelectorAll('[data-a=\"rsvp-choice\"]').forEach(b => b.classList.remove('y','n')); el.classList.add(el.dataset.value === '1' ? 'y' : 'n'); },
  menu() { MENU = !MENU; shell(LAST); },
  async salir() { await api('POST', '/auth/logout').catch(() => {}); ME = null; location.hash = '#/'; render(); },
  async 'her-invitar'(el) { await abrirWhatsApp(el, 'invitacion'); render(); },
  async 'her-reset'(el) { await abrirWhatsApp(el, 'reset'); },
  async 'her-quitar-foto'(el) { await api('PUT', '/admin/hermanas/' + el.dataset.id, { quitar_foto: true }); toast('Foto quitada'); render(); },
  async 'cargo-del'(el) { if (!confirm('¿Borrar este cargo?')) return; await api('DELETE', '/admin/cargos/' + el.dataset.id); render(); },
  async 'noticia-del'(el) { if (!confirm('¿Eliminar esta noticia?')) return; await api('DELETE', '/admin/noticias/' + el.dataset.id); render(); },
  async 'sabado-asistentes'(el) { const a=await api('GET','/modulos/sabados/'+el.dataset.id+'/asistencias'); alert(a.length ? a.map(x=>`${x.nombre}: ${x.asiste?'Asiste':'No asiste'}${x.acompanantes?' + '+x.acompanantes+' acompañantes':''}${x.alergias?' · Alergias: '+x.alergias:''}`).join('\n') : 'Todavía no hay confirmaciones.'); },
  'sabados-tab'(el) { SAB_TAB=el.dataset.tab==='ant'?'ant':'prox'; render(); },
  async 'pago-confirm'(el) { if(!confirm('¿Confirmar este pago?')) return; await api('POST','/modulos/tesoreria/pagos/'+el.dataset.id+'/confirmar'); toast('Pago confirmado'); render(); },
  async 'pago-reject'(el) { if(!confirm('¿Rechazar este pago?')) return; await api('POST','/modulos/tesoreria/pagos/'+el.dataset.id+'/rechazar'); toast('Pago rechazado'); render(); },
  async 'tes-filtro-reset'() { TES_FILTRO={tipo:'todos',texto:'',desde:'',hasta:''}; render(); },
  async 'fijo-del'(el) { if(!confirm('¿Eliminar este gasto fijo?')) return; await api('DELETE','/modulos/tesoreria/gastos-fijos/'+el.dataset.id); render(); },
  async 'cocina-del'(el) { if(!confirm('¿Eliminar este turno?')) return; await api('DELETE','/modulos/cocina/'+el.dataset.id); render(); },
  async 'junta-del'(el) { if(!confirm('¿Eliminar esta junta y su acta?')) return; await api('DELETE','/modulos/actas/juntas/'+el.dataset.id); render(); },
  'hito-add'() { $('#hitos').insertAdjacentHTML('beforeend', hitoRow({ anio: '', texto: '' })); },
  'hito-del'(el) { el.closest('.row').remove(); },
};
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
async function entrar() { ME = await api('GET', '/me'); location.hash = '#/'; render(); }

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
    if (h === '#/sabados') return await vSabados();
    if (h === '#/cuenta') return await vCuenta();
    if (h === '#/cocina') return await vCocina();
    if (h === '#/actas') return ME.admin || ME.actas ? await vActas() : vInicio();
    if (h === '#/tesoreria') return ME.admin || ME.tes ? await vTesoreria() : vInicio();
    if (h.startsWith('#/admin/')) return ME.admin ? await vAdmin(h.slice(8)) : vInicio();
    return vInicio();
  } catch (er) {
    if (er.status === 401) { ME = null; return vLogin(); }
    shell(`<div class="card"><p>${esc(er.message)}</p></div>`);
  }
}
addEventListener('hashchange', render);
(async () => { try { ME = await api('GET', '/me'); } catch { ME = null; } render(); })();
