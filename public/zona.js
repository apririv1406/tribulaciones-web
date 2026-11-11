'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const iniciales = n => esc(String(n).split(' ').map(w => w[0]).slice(0, 2).join(''));
const GSVG = '<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.600 2.400 30.200 0 24 0 14.600 0 6.500 5.400 2.600 13.200l7.800 6.100C12.300 13.600 17.700 9.500 24 9.500z"/><path fill="#4285F4" d="M46.500 24.500c0-1.600-.1-3.100-.4-4.500H24v9h12.700c-.6 3-2.300 5.500-4.800 7.200l7.500 5.800c4.400-4.100 7.100-10.100 7.100-17.500z"/><path fill="#FBBC05" d="M10.400 28.700A14.500 14.500 0 0 1 9.500 24c0-1.600.3-3.200.9-4.700l-7.800-6.100A24 24 0 0 0 0 24c0 3.900.9 7.500 2.600 10.800l7.800-6.100z"/><path fill="#34A853" d="M24 48c6.500 0 11.900-2.100 15.900-5.800l-7.500-5.800c-2.100 1.400-4.800 2.300-8.400 2.300-6.300 0-11.700-4.100-13.600-9.800l-7.800 6.100C6.500 42.600 14.600 48 24 48z"/></svg>';
let ME = null, MENU = false, LAST = '';

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

/* ---------- estructura ---------- */
const items = () => !ME ? [] : [['#/', 'Inicio'], ...(ME.admin ? [['#/admin/hermanas', 'Administración']] : []), ['#/perfil', 'Mi perfil']];
function shell(html) {
  LAST = html;
  const cur = location.hash || '#/', its = items();
  const on = h => (h === '#/' ? cur === '#/' || cur === '' : cur.startsWith(h.slice(0, 8)));
  $('#nav').innerHTML = `<a class="logo" href="/"><img src="/logo.png" alt="Las Tribulaciones de Sara"></a>` + its.map(([h, t]) => `<a class="dk ${on(h) ? 'on' : ''}" href="${h}">${t}</a>`).join('') + `<a class="dk" href="/">Web pública</a>` + (ME ? `<a class="cta dk" href="#/" data-a="salir">Salir</a>` : '') + `<button class="hb" data-a="menu" aria-label="Menú"><i></i><i></i><i></i></button>`;
  $('#mn').innerHTML = MENU ? `<div class="sc" data-a="menu"></div><div class="mn"><button class="x" data-a="menu" aria-label="Cerrar">✕</button>${its.map(([h, t]) => `<a href="${h}">${t}</a>`).join('')}<hr><a href="/">Web pública</a>${ME ? '<a href="#/" data-a="salir">Salir</a>' : ''}</div>` : '';
  $('#app').innerHTML = html;
}
const campo = (n, t, extra = '') => `<label class="fl" style="text-align:left">${t}</label><input class="t" name="${n}" ${extra}>`;

/* ---------- acceso ---------- */
const ERR = { google: 'No se ha podido entrar con Google. Inténtalo de nuevo o usa tu correo y contraseña.', 'no-registrada': 'Ese correo de Google no está registrado en el cuartel. Pide a la administradora que lo añada.' };
function vLogin(err) {
  shell(`<div class="login"><div class="card"><img src="/logo.png" alt="" style="height:110px"><h2 style="margin-top:6px">Zona hermana</h2>${err ? `<p style="color:var(--ko);font-size:14px">${esc(ERR[err] || 'No se ha podido entrar.')}</p>` : ''}
<form data-f="login">${campo('email', 'Correo', 'type="email" required autocomplete="username"')}${campo('password', 'Contraseña', 'type="password" required autocomplete="current-password"')}<button class="btn" style="width:100%;margin-top:16px">Entrar</button></form>
<p style="margin:12px 0 0"><a href="#/olvido" style="color:var(--br);font-size:14px">He olvidado mi contraseña</a></p><div class="or">o</div><a class="g" href="/api/auth/google">${GSVG}Continuar con Google</a>
<p class="mu" style="font-size:13px;margin:16px 0 0">¿Primer acceso? Usa el enlace del correo de bienvenida.</p></div></div>`);
}
function vOlvido() {
  shell(`<div class="login"><div class="card"><img src="/logo.png" alt="" style="height:90px"><h2 style="margin-top:6px">¿Olvidaste tu contraseña?</h2><p class="mu">Escribe tu correo y te enviaremos un enlace para crear una nueva.</p><form data-f="olvido">${campo('email', 'Correo', 'type="email" required')}<button class="btn" style="width:100%;margin-top:16px">Enviar enlace</button></form><div id="ok"></div><p style="margin:14px 0 0"><a href="#/" style="color:var(--br);font-size:14px">Volver a entrar</a></p></div></div>`);
}
function vClave(tok) {
  shell(`<div class="login"><div class="card"><img src="/logo.png" alt="" style="height:90px"><div class="tag" style="margin-top:6px">Contraseña</div><h2>Crea tu contraseña</h2><p class="mu">Elige una contraseña para entrar a la Zona hermana. Mínimo 8 caracteres.</p><form data-f="clave" data-t="${esc(tok)}">${campo('p1', 'Contraseña', 'type="password" required minlength="8" autocomplete="new-password"')}${campo('p2', 'Repite la contraseña', 'type="password" required minlength="8" autocomplete="new-password"')}<button class="btn" style="width:100%;margin-top:16px">Guardar y entrar</button></form></div></div>`);
}
function vSetup() {
  shell(`<div class="login"><div class="card"><img src="/logo.png" alt="" style="height:90px"><div class="tag" style="margin-top:6px">Instalación</div><h2>Primer acceso de la administradora</h2><p class="mu">Escribe la clave de instalación (SETUP_KEY) y elige tu contraseña.</p><form data-f="setup">${campo('key', 'Clave de instalación', 'type="password" required')}${campo('p1', 'Tu contraseña', 'type="password" required minlength="8" autocomplete="new-password"')}<button class="btn" style="width:100%;margin-top:16px">Crear mi cuenta</button></form></div></div>`);
}

/* ---------- zona ---------- */
function vInicio() {
  const mod = (t, d) => `<div class="card"><span class="pill">Próximamente</span><h3 style="margin-top:10px">${t}</h3><p class="mu" style="margin:0">${d}</p></div>`;
  shell(`<div class="top"><div class="tag">Zona hermana</div><h2>Hola, ${esc(ME.nombre.split(' ')[0])}</h2><p class="mu" style="margin:0">${esc(ME.cargo || 'Hermana')}</p></div>
${ME.admin ? `<div class="card" style="margin:18px 0"><h3>Administración</h3><p class="mu">Gestiona las hermanas, sus cargos, el correo de bienvenida, las noticias y la historia de la web.</p><a class="btn" href="#/admin/hermanas">Ir a la administración</a></div>` : ''}
<h3 style="margin:22px 0 12px">Lo que vamos a ir abriendo</h3><div class="grid">${mod('Sábados y asistencia', 'Confirmar asistencia, invitadas y avisos de alergias.')}${mod('Mi cuenta', 'Lo que debes, tus pagos y registrar un pago.')}${mod('Cocina', 'Turnos, presupuesto de compra y tickets.')}${mod('Actas y juntas', 'Convocatorias, orden del día y actas.')}${ME.tes ? mod('Tesorería', 'Movimientos, gastos fijos, informes y puntear pagos.') : ''}</div>`);
}
function vPerfil() {
  shell(`<div class="top"><div class="tag">Mi perfil</div><h2>${esc(ME.nombre)}</h2><p class="mu" style="margin:0">${esc(ME.email || '')} · ${esc(ME.cargo || 'Hermana')}</p></div>
<div class="card" style="margin-top:18px;max-width:520px"><h3>Cambiar mi contraseña</h3><form data-f="perfil">${campo('actual', 'Contraseña actual (si ya tenías una)', 'type="password" autocomplete="current-password"')}${campo('nueva', 'Contraseña nueva', 'type="password" required minlength="8" autocomplete="new-password"')}<button class="btn" style="margin-top:16px">Guardar contraseña</button></form></div>`);
}

/* ---------- administración ---------- */
const PERM = { none: 'Solo zona hermana', tes: 'Tesorería', actas: 'Actas' };
const CUENTA = { sin: 'Sin invitar', invitada: 'Invitación enviada', activa: 'Cuenta activa' };
const TABS = [['hermanas', 'Hermanas'], ['cargos', 'Cargos y permisos'], ['correo', 'Correo de bienvenida'], ['noticias', 'Noticias'], ['historia', 'Historia']];
const adm = (tab, html) => `<div class="top"><div class="tag">Panel privado</div><h2>Administración</h2></div><div class="sub" style="margin-top:14px">${TABS.map(([k, t]) => `<a class="${k === tab ? 'on' : ''}" href="#/admin/${k}">${t}</a>`).join('')}</div>${html}`;
async function vAdmin(tab) {
  if (tab === 'hermanas') {
    const [hs, cs] = await Promise.all([api('GET', '/admin/hermanas'), api('GET', '/admin/cargos')]);
    const pend = hs.filter(h => h.estado !== 'Baja' && h.email && h.cuenta === 'sin').length;
    return shell(adm(tab, `<div class="card"><h3>Nueva hermana</h3><form data-f="her-new"><div class="row" style="align-items:flex-end"><div style="flex:2 1 200px">${campo('nombre', 'Nombre y apellidos', 'required')}</div><div style="flex:2 1 220px">${campo('email', 'Correo (el que usará para entrar)', 'type="email"')}</div><div style="flex:1 1 150px"><label class="fl">Cargo</label><select class="t" name="cargo_id">${cs.map(c => `<option value="${c.id}" ${c.nombre === 'Hermana' ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></div><div style="flex:0 0 110px">${campo('anio_entrada', 'Año de entrada', 'type="number" min="2000" max="2100"')}</div><button class="btn" style="padding:10px 20px">Añadir</button></div></form>
<p style="margin:14px 0 0"><button class="chip on" data-a="invitar-todas" ${pend ? '' : 'disabled'}>Enviar bienvenida a las ${pend} que faltan</button></p></div><div style="height:16px"></div>${hs.map(h => rowHer(h, cs)).join('')}`));
  }
  if (tab === 'cargos') {
    const cs = await api('GET', '/admin/cargos');
    return shell(adm(tab, `<div class="card"><p class="mu" style="margin-top:0">Cada junta puede crear los cargos que necesite y decidir qué puede hacer cada uno. La administradora se marca aparte, en cada hermana.</p>${cs.map(c => `<form class="mv" data-f="cargo-save" data-id="${c.id}" style="flex-wrap:wrap;gap:8px"><input class="t" name="nombre" value="${esc(c.nombre)}" style="flex:1 1 160px" required><select class="t" name="permiso" style="width:200px">${Object.entries(PERM).map(([k, v]) => `<option value="${k}" ${c.permiso === k ? 'selected' : ''}>${v}</option>`).join('')}</select><span class="mu" style="font-size:13px;width:90px">${c.usos} hermana${c.usos === 1 ? '' : 's'}</span><button class="chip on">Guardar</button>${c.nombre === 'Hermana' ? '' : `<button type="button" class="chip" data-a="cargo-del" data-id="${c.id}">Borrar</button>`}</form>`).join('')}</div>
<div class="card" style="margin-top:16px"><h3>Nuevo cargo</h3><form data-f="cargo-new"><div class="row" style="align-items:flex-end"><div style="flex:2 1 200px">${campo('nombre', 'Nombre del cargo', 'required placeholder="Ej.: Camarera"')}</div><div style="flex:1 1 200px"><label class="fl">Permisos</label><select class="t" name="permiso">${Object.entries(PERM).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div><button class="btn" style="padding:10px 20px">Añadir cargo</button></div></form></div>`));
  }
  if (tab === 'correo') {
    const c = await api('GET', '/admin/correo');
    return shell(adm(tab, `<div class="card" style="max-width:720px"><h3>Correo de bienvenida</h3><p class="mu">Se envía con un enlace personal. La primera vez que accede, cada hermana crea su contraseña. Después puede entrar con su correo y contraseña, o con Google si usa el mismo correo.</p><form data-f="correo">${campo('mail_asunto', 'Asunto', `value="${esc(c.mail_asunto)}" maxlength="150"`)}<label class="fl" style="text-align:left">Mensaje personal (opcional)</label><textarea class="t" name="mail_mensaje" rows="3" maxlength="600">${esc(c.mail_mensaje)}</textarea><p style="margin:16px 0 0"><button class="btn">Guardar</button> <button type="button" class="chip" data-a="correo-prueba">Enviarme una prueba</button></p></form></div>`));
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
  return `<form class="card" data-f="her-save" data-id="${h.id}" style="margin-bottom:12px${h.estado === 'Baja' ? ';opacity:.65' : ''}">
<div class="row" style="align-items:flex-end"><div style="flex:2 1 200px"><label class="fl">Nombre</label><input class="t" name="nombre" value="${esc(h.nombre)}" required></div><div style="flex:2 1 220px"><label class="fl">Correo</label><input class="t" type="email" name="email" value="${esc(h.email || '')}"></div><div style="flex:1 1 150px"><label class="fl">Cargo</label><select class="t" name="cargo_id">${cs.map(c => `<option value="${c.id}" ${c.id === h.cargo_id ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></div><div style="flex:1 1 120px"><label class="fl">Estado</label><select class="t" name="estado">${['Activa', 'Pasiva', 'Baja'].map(e => `<option ${e === h.estado ? 'selected' : ''}>${e}</option>`).join('')}</select></div></div>
<div class="row" style="align-items:center;margin-top:12px"><div style="flex:0 0 110px"><label class="fl">Año de entrada</label><input class="t" type="number" name="anio_entrada" min="2000" max="2100" value="${h.anio_entrada || ''}"></div><div class="av" style="margin:0;width:56px;height:56px;font-size:18px">${h.foto ? `<img src="/media/${h.foto}" alt="">` : iniciales(h.nombre)}</div><div style="flex:1 1 200px"><label class="fl">Foto</label><input type="file" name="foto" accept="image/*" style="font-size:13px"></div>${h.foto ? `<button type="button" class="chip" data-a="her-quitar-foto" data-id="${h.id}">Quitar foto</button>` : ''}<label class="mu" style="font-size:13px"><input type="checkbox" name="visible_web" ${h.visible_web ? 'checked' : ''}> Aparece en la web</label><label class="mu" style="font-size:13px"><input type="checkbox" name="es_admin" ${h.es_admin ? 'checked' : ''}> Administradora</label></div>
<div class="row" style="align-items:center;margin-top:14px"><button class="btn" style="padding:9px 20px">Guardar</button><span class="pill ${h.cuenta === 'activa' ? 'ok' : ''}">${CUENTA[h.cuenta]}</span>${h.estado !== 'Baja' && h.email ? (h.cuenta === 'activa' ? `<button type="button" class="chip" data-a="her-reset" data-id="${h.id}">Restablecer contraseña</button>` : `<button type="button" class="chip" data-a="her-invitar" data-id="${h.id}">${h.cuenta === 'invitada' ? 'Reenviar bienvenida' : 'Enviar bienvenida'}</button>`) : ''}</div></form>`;
}

/* ---------- acciones ---------- */
const avisoEnvio = (r, ok) => toast(r.enviado ? ok : r.aviso || 'No se pudo enviar', !r.enviado);
const FORM = {
  async login(f, d) { await api('POST', '/auth/login', { email: d.get('email'), password: d.get('password') }); await entrar(); },
  async olvido(f, d) { await api('POST', '/auth/forgot', { email: d.get('email') }); $('#ok').innerHTML = '<p class="mu" style="margin:14px 0 0">Si el correo está registrado, recibirás el enlace en unos minutos. Mira también la carpeta de spam.</p>'; },
  async clave(f, d) { if (d.get('p1') !== d.get('p2')) throw new Error('Las contraseñas no coinciden'); await api('POST', '/auth/password/set', { token: f.dataset.t, password: d.get('p1') }); await entrar(); },
  async setup(f, d) { await api('POST', '/setup', { key: d.get('key'), password: d.get('p1') }); await entrar(); },
  async perfil(f, d) { await api('POST', '/auth/password/change', { actual: d.get('actual'), nueva: d.get('nueva') }); f.reset(); toast('Contraseña cambiada'); },
  async 'her-new'(f, d) { await api('POST', '/admin/hermanas', { nombre: d.get('nombre'), email: d.get('email'), cargo_id: +d.get('cargo_id'), anio_entrada: d.get('anio_entrada') || null }); toast('Hermana añadida'); render(); },
  async 'her-save'(f, d) {
    const b = { nombre: d.get('nombre'), email: d.get('email'), cargo_id: +d.get('cargo_id'), estado: d.get('estado'), anio_entrada: d.get('anio_entrada') ? +d.get('anio_entrada') : null, visible_web: !!d.get('visible_web'), es_admin: !!d.get('es_admin') };
    const fl = d.get('foto'); if (fl && fl.size) b.foto = await reducir(fl, 480);
    await api('PUT', '/admin/hermanas/' + f.dataset.id, b); toast('Guardado'); render();
  },
  async 'cargo-new'(f, d) { await api('POST', '/admin/cargos', { nombre: d.get('nombre'), permiso: d.get('permiso') }); toast('Cargo creado'); render(); },
  async 'cargo-save'(f, d) { await api('PUT', '/admin/cargos/' + f.dataset.id, { nombre: d.get('nombre'), permiso: d.get('permiso') }); toast('Guardado'); render(); },
  async correo(f, d) { await api('PUT', '/admin/correo', { mail_asunto: d.get('mail_asunto'), mail_mensaje: d.get('mail_mensaje') }); toast('Guardado'); },
  async 'noticia-new'(f, d) { const b = { titulo: d.get('titulo'), texto: d.get('texto') }; const fl = d.get('foto'); if (fl && fl.size) b.imagen = await reducir(fl, 1400, 0.8); await api('POST', '/admin/noticias', b); toast('Noticia publicada. Ya aparece en la web.'); render(); },
  async historia(f) { const hitos = [...f.querySelectorAll('#hitos .row')].map(r => ({ anio: r.querySelector('[name=anio]').value, texto: r.querySelector('[name=texto]').value })); const r = await api('PUT', '/admin/hitos', { hitos }); toast(`Guardado (${r.total} hitos)`); render(); },
};
const ACT = {
  menu() { MENU = !MENU; shell(LAST); },
  async salir() { await api('POST', '/auth/logout').catch(() => {}); ME = null; location.hash = '#/'; render(); },
  async 'her-invitar'(el) { avisoEnvio(await api('POST', `/admin/hermanas/${el.dataset.id}/invitar`), 'Correo de bienvenida enviado'); render(); },
  async 'her-reset'(el) { avisoEnvio(await api('POST', `/admin/hermanas/${el.dataset.id}/reset`), 'Enviado el enlace para crear una contraseña nueva'); },
  async 'invitar-todas'() { const r = await api('POST', '/admin/invitar-pendientes'); toast(r.fallidos ? r.aviso || 'Algunos correos no se enviaron' : `Bienvenida enviada a ${r.enviados} hermanas`, !!r.fallidos); render(); },
  async 'her-quitar-foto'(el) { await api('PUT', '/admin/hermanas/' + el.dataset.id, { quitar_foto: true }); toast('Foto quitada'); render(); },
  async 'cargo-del'(el) { if (!confirm('¿Borrar este cargo?')) return; await api('DELETE', '/admin/cargos/' + el.dataset.id); render(); },
  async 'correo-prueba'() { avisoEnvio(await api('POST', '/admin/correo/prueba'), 'Te hemos enviado una prueba a tu correo'); },
  async 'noticia-del'(el) { if (!confirm('¿Eliminar esta noticia?')) return; await api('DELETE', '/admin/noticias/' + el.dataset.id); render(); },
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
    if (h.startsWith('#/admin/')) return ME.admin ? await vAdmin(h.slice(8)) : vInicio();
    return vInicio();
  } catch (er) {
    if (er.status === 401) { ME = null; return vLogin(); }
    shell(`<div class="card"><p>${esc(er.message)}</p></div>`);
  }
}
addEventListener('hashchange', render);
(async () => { try { ME = await api('GET', '/me'); } catch { ME = null; } render(); })();
