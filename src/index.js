import { ensureSchema } from './schema.js';
import { routeModulos, generarCuotasMensuales } from './modulos.js';

/* ---------- utilidades ---------- */
const te = new TextEncoder();
const b64 = buf => { let s = ''; new Uint8Array(buf).forEach(c => (s += String.fromCharCode(c))); return btoa(s); };
const b64u = buf => b64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const rand = (n = 32) => b64u(crypto.getRandomValues(new Uint8Array(n)));
const sha = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode(s)))].map(x => x.toString(16).padStart(2, '0')).join('');
const same = (a, b) => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };
const derive = async (pw, salt) => crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, await crypto.subtle.importKey('raw', te.encode(pw), 'PBKDF2', false, ['deriveBits']), 256);
const hashPw = async pw => { const salt = crypto.getRandomValues(new Uint8Array(16)); return 'p1$' + b64(salt) + '$' + b64(await derive(pw, salt)); };
const checkPw = async (pw, st) => { if (!st) return false; const [v, s, h] = st.split('$'); if (v !== 'p1') return false; return same(b64(await derive(pw, Uint8Array.from(atob(s), c => c.charCodeAt(0)))), h); };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const J = (d, status = 200, extra = {}) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra } });
const E = (msg, status = 400) => J({ error: msg }, status);
const getCookie = (req, n) => (req.headers.get('cookie') || '').split(/;\s*/).map(c => c.split('=')).find(c => c[0] === n)?.[1];
const setCookie = (req, n, v, maxAge, path = '/') => `${n}=${v}; HttpOnly; SameSite=Lax; Path=${path}; Max-Age=${maxAge}${new URL(req.url).protocol === 'https:' ? '; Secure' : ''}`;
const origin = (env, req) => (env.SITE_URL ? env.SITE_URL.replace(/\/$/, '') : new URL(req.url).origin);
const emailOk = e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && e.length <= 120;

// Acepta números internacionales. Si se introducen 9 cifras españolas,
// añade automáticamente el prefijo 34.
function normalizarTelefono(valor) {
  let n = String(valor || '').replace(/\D/g, '');
  if (n.startsWith('00')) n = n.slice(2);
  if (n.length === 9) n = '34' + n;
  return /^[1-9]\d{7,14}$/.test(n) ? n : null;
}

/* ---------- arranque ---------- */
let ready;
async function init(env) {
  ready ??= (async () => { await ensureSchema(env.DB); await bootstrap(env); })().catch(e => { ready = null; throw e; });
  await ready;
}
async function bootstrap(env) {
  const n = await env.DB.prepare('SELECT COUNT(*) n FROM hermanas').first();
  if (n.n === 0 && env.ADMIN_EMAIL) {
    const c = await env.DB.prepare("SELECT id FROM cargos WHERE nombre='Hermana'").first();
    await env.DB.prepare('INSERT INTO hermanas(nombre,email,cargo_id,es_admin) VALUES(?,?,?,1)').bind(env.ADMIN_NAME || 'Administradora', env.ADMIN_EMAIL.trim().toLowerCase(), c ? c.id : null).run();
  }
}

export default {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil((async () => {
      await init(env);
      const fecha = new Date(controller.scheduledTime);
      const cuotas = await generarCuotasMensuales(env.DB, fecha);
      console.log('Cuotas programadas:', cuotas);
    })());
  },
  async fetch(req, env) {
    const url = new URL(req.url), p = url.pathname;
    try {
      if (p === '/sitemap.xml' && (req.method === 'GET' || req.method === 'HEAD')) {
        await init(env); return await sitemapNoticias(env, url.origin);
      }
      const article = p.match(/^\/(noticias|cronicas)\/(\d+)\/?$/);
      if (article && (req.method === 'GET' || req.method === 'HEAD')) {
        await init(env); return await paginaContenido(env, +article[2], url.origin, article[1] === 'cronicas' ? 'cronica' : 'noticia');
      }
      if (!p.startsWith('/api/') && !p.startsWith('/media/')) return env.ASSETS.fetch(req);
      await init(env); return await route(req, env, url, p);
    } catch (e) { console.error(e); return E('Error interno', 500); }
  },
};

/* ---------- enrutado ---------- */
async function route(req, env, url, p) {
  const m = req.method;
  if (m !== 'GET' && m !== 'HEAD' && req.headers.get('x-requested-with') !== 'fetch') return E('Petición no válida', 403);
  let r;
  if (m === 'GET' && (r = p.match(/^\/media\/(\d+)$/))) return media(req, env, +r[1]);
  if (m === 'GET' && p === '/api/public') return publico(env);
  if (m === 'GET' && p === '/api/noticias') return noticiasPublicas(env, 'noticia');
  if (m === 'GET' && p === '/api/cronicas') return noticiasPublicas(env, 'cronica');
  if (m === 'GET' && p === '/api/auth/google') return gStart(req, env);
  if (m === 'GET' && p === '/api/auth/google/callback') return gCallback(req, env, url);
  const b = m === 'POST' || m === 'PUT' ? await req.json().catch(() => ({})) : {};
  if (m === 'POST' && p === '/api/auth/login') return login(req, env, b);
  if (m === 'POST' && p === '/api/auth/forgot') return forgot(req, env, b);
  if (m === 'POST' && p === '/api/auth/password/set') return passSet(req, env, b);
  if (m === 'POST' && p === '/api/setup') return setup(req, env, b);
  const me = await userOf(req, env);
  if (m === 'GET' && p === '/api/me') return me ? J(me) : E('No has iniciado sesión', 401);
  if (!me) return E('No has iniciado sesión', 401);
  if (p.startsWith('/api/modulos/')) return routeModulos(req, env, me, m, p, b);
  if (m === 'POST' && p === '/api/auth/logout') {
    await env.DB.prepare('DELETE FROM sesiones WHERE id=?').bind(await sha(getCookie(req, 'sid'))).run();
    return J({ ok: true }, 200, { 'Set-Cookie': setCookie(req, 'sid', '', 0) });
  }
  if (m === 'POST' && p === '/api/auth/password/change') return passChange(env, me, b);
  if (!p.startsWith('/api/admin/')) return E('No encontrado', 404);
  if (!me.admin) return E('No tienes permiso para esto', 403);
  return admin(req, env, me, m, p, b);
}

/* ---------- sesiones y límites ---------- */
async function userOf(req, env) {
  const sid = getCookie(req, 'sid');
  if (!sid) return null;
  const r = await env.DB.prepare(`SELECT h.id,h.nombre,h.email,h.estado,h.es_admin,c.nombre cargo,COALESCE(c.permiso,'none') permiso FROM sesiones s JOIN hermanas h ON h.id=s.hermana_id LEFT JOIN cargos c ON c.id=h.cargo_id WHERE s.id=? AND s.expira>? AND h.estado!='Baja'`).bind(await sha(sid), Date.now()).first();
  if (!r) return null;
  return { id: r.id, nombre: r.nombre, email: r.email, estado: r.estado, cargo: r.cargo, admin: !!r.es_admin, tes: !!(r.es_admin || r.permiso === 'tes'), actas: !!(r.es_admin || r.permiso === 'actas') };
}
async function session(req, env, hid, body = { ok: true }, redirect) {
  const raw = rand(32);
  await env.DB.prepare('DELETE FROM sesiones WHERE expira<?').bind(Date.now()).run();
  await env.DB.prepare('INSERT INTO sesiones VALUES(?,?,?)').bind(await sha(raw), hid, Date.now() + 30 * 864e5).run();
  await env.DB.prepare("UPDATE hermanas SET ultimo_acceso=datetime('now') WHERE id=?").bind(hid).run();
  const c = setCookie(req, 'sid', raw, 30 * 86400);
  if (redirect) return new Response(null, { status: 302, headers: { Location: redirect, 'Set-Cookie': c, 'Cache-Control': 'no-store' } });
  return J(body, 200, { 'Set-Cookie': c });
}
async function limited(env, clave, max, ventana) {
  const r = await env.DB.prepare('SELECT COUNT(*) n FROM intentos WHERE clave=? AND ts>?').bind(clave, Date.now() - ventana).first();
  return r.n >= max;
}
async function fail(env, clave) {
  await env.DB.prepare('INSERT INTO intentos VALUES(?,?)').bind(clave, Date.now()).run();
  await env.DB.prepare('DELETE FROM intentos WHERE ts<?').bind(Date.now() - 864e5).run();
}
const ipOf = req => req.headers.get('cf-connecting-ip') || '-';
const pwOk = pw => pw.length >= 8 && pw.length <= 128;

/* ---------- acceso ---------- */
async function login(req, env, b) {
  const email = String(b.email || '').trim().toLowerCase(), pw = String(b.password || ''), ip = ipOf(req);
  if ((await limited(env, 'l:' + email, 8, 9e5)) || (await limited(env, 'i:' + ip, 30, 9e5))) return E('Demasiados intentos. Espera unos minutos.', 429);
  const h = await env.DB.prepare('SELECT id,pass_hash,estado FROM hermanas WHERE email=?').bind(email).first();
  const ok = h ? await checkPw(pw, h.pass_hash) : (await derive(pw, new Uint8Array(16)), false);
  if (!ok || h.estado === 'Baja') { await fail(env, 'l:' + email); await fail(env, 'i:' + ip); return E('Correo o contraseña incorrectos', 401); }
  return session(req, env, h.id);
}
async function forgot(req, env, b) {
  const email = String(b.email || '').trim().toLowerCase(), ip = ipOf(req);
  if (await limited(env, 'f:' + ip, 10, 36e5)) return E('Demasiadas solicitudes. Inténtalo más tarde.', 429);
  await fail(env, 'f:' + ip);
  const h = await env.DB.prepare("SELECT id,nombre,email,pass_hash FROM hermanas WHERE email=? AND estado!='Baja'").bind(email).first();
  // Se conserva el mecanismo anterior como compatibilidad, aunque la interfaz
  // nueva indica pedir el restablecimiento a la administradora por correo electrónico.
  if (h) await enviarEnlace(env, req, h, h.pass_hash ? 'reset' : 'invitacion');
  return J({ ok: true });
}
async function passSet(req, env, b) {
  const pw = String(b.password || '');
  if (!pwOk(pw)) return E('La contraseña debe tener entre 8 y 128 caracteres');
  const t = await env.DB.prepare('SELECT hermana_id FROM tokens WHERE id=? AND expira>?').bind(await sha(String(b.token || '')), Date.now()).first();
  if (!t) return E('El enlace ha caducado o ya se usó. Pide uno nuevo.', 410);
  const h = await env.DB.prepare("SELECT id FROM hermanas WHERE id=? AND estado!='Baja'").bind(t.hermana_id).first();
  if (!h) return E('Cuenta no disponible', 403);
  await env.DB.batch([
    env.DB.prepare('UPDATE hermanas SET pass_hash=? WHERE id=?').bind(await hashPw(pw), h.id),
    env.DB.prepare('DELETE FROM tokens WHERE hermana_id=?').bind(h.id),
    env.DB.prepare('DELETE FROM sesiones WHERE hermana_id=?').bind(h.id),
  ]);
  return session(req, env, h.id);
}
async function passChange(env, me, b) {
  const act = String(b.actual || ''), nue = String(b.nueva || '');
  if (!pwOk(nue)) return E('La contraseña nueva debe tener entre 8 y 128 caracteres');
  const h = await env.DB.prepare('SELECT pass_hash FROM hermanas WHERE id=?').bind(me.id).first();
  if (h.pass_hash && !(await checkPw(act, h.pass_hash))) return E('La contraseña actual no es correcta', 403);
  await env.DB.prepare('UPDATE hermanas SET pass_hash=? WHERE id=?').bind(await hashPw(nue), me.id).run();
  return J({ ok: true });
}
async function setup(req, env, b) {
  if (!env.SETUP_KEY) return E('No disponible', 403);
  const ip = ipOf(req);
  if (await limited(env, 's:' + ip, 5, 36e5)) return E('Demasiados intentos', 429);
  await fail(env, 's:' + ip);
  if (!same(String(b.key || ''), env.SETUP_KEY)) return E('Clave incorrecta', 403);
  const pw = String(b.password || '');
  if (!pwOk(pw)) return E('La contraseña debe tener entre 8 y 128 caracteres');
  const a = await env.DB.prepare('SELECT id FROM hermanas WHERE es_admin=1 AND pass_hash IS NULL ORDER BY id LIMIT 1').first();
  if (!a) return E('La administradora ya tiene contraseña. Usa "He olvidado mi contraseña".', 409);
  await env.DB.prepare('UPDATE hermanas SET pass_hash=? WHERE id=?').bind(await hashPw(pw), a.id).run();
  return session(req, env, a.id);
}

/* ---------- Google ---------- */
async function gStart(req, env) {
  const o = origin(env, req);
  if (!env.GOOGLE_CLIENT_ID) return new Response(null, { status: 302, headers: { Location: o + '/zona/#/error/google' } });
  const st = rand(16);
  const u = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: o + '/api/auth/google/callback', response_type: 'code', scope: 'openid email', state: st, prompt: 'select_account' });
  return new Response(null, { status: 302, headers: { Location: u, 'Set-Cookie': setCookie(req, 'gst', st, 600, '/api/auth'), 'Cache-Control': 'no-store' } });
}
async function gCallback(req, env, url) {
  const o = origin(env, req);
  const back = e => new Response(null, { status: 302, headers: { Location: `${o}/zona/#/error/${e}`, 'Set-Cookie': setCookie(req, 'gst', '', 0, '/api/auth') } });
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return back('google');
  const st = url.searchParams.get('state'), code = url.searchParams.get('code');
  if (!code || !st || st !== getCookie(req, 'gst')) return back('google');
  const tr = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: o + '/api/auth/google/callback', grant_type: 'authorization_code' }) });
  if (!tr.ok) return back('google');
  const { id_token } = await tr.json();
  const ir = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(id_token));
  if (!ir.ok) return back('google');
  const info = await ir.json();
  if (info.aud !== env.GOOGLE_CLIENT_ID || String(info.email_verified) !== 'true' || !info.email) return back('google');
  const h = await env.DB.prepare("SELECT id FROM hermanas WHERE email=? AND estado!='Baja'").bind(info.email.toLowerCase()).first();
  if (!h) return back('no-registrada');
  return session(req, env, h.id, null, o + '/zona/#/');
}

/* ---------- correo (se conserva para compatibilidad) ---------- */
async function getCfg(env) {
  const c = { mail_asunto: 'Bienvenida a la web de Las Tribulaciones de Sara', mail_mensaje: '' };
  (await env.DB.prepare('SELECT clave,valor FROM config').all()).results.forEach(r => (c[r.clave] = r.valor));
  return c;
}
async function sendMail(env, to, subject, html) {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) return { ok: false, aviso: 'El correo todavía no está configurado (faltan RESEND_API_KEY y MAIL_FROM).' };
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, html }) });
  if (!r.ok) { console.error('resend', r.status, await r.text()); return { ok: false, aviso: 'No se pudo enviar el correo (error ' + r.status + ').' }; }
  return { ok: true };
}
function mailShell(env, req, cuerpo, boton, url, pie) {
  const o = origin(env, req);
  return `<!doctype html><html lang="es"><body style="margin:0;background:#fbf6e9;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#fffdf8;border:1px solid #efe5cd;border-radius:16px;overflow:hidden"><tr><td align="center" style="background:#3b2c1c;padding:22px"><img src="${o}/logo.png" width="84" alt="" style="display:block"><div style="font:700 24px Georgia,serif;color:#e8c23a;margin-top:8px">Las Tribulaciones de Sara</div></td></tr><tr><td style="padding:26px;color:#33261a;font-size:15px;line-height:1.6">${cuerpo}<p style="text-align:center;margin:26px 0"><a href="${esc(url)}" style="background:#e8c23a;color:#3b2c1c;font-weight:bold;text-decoration:none;padding:13px 26px;border-radius:99px;display:inline-block">${esc(boton)}</a></p><p style="font-size:12px;color:#8a7a68;margin:0">${pie}</p></td></tr></table></td></tr></table></body></html>`;
}
const mailBienvenida = (env, req, nombre, url, msg) => mailShell(env, req,
  `<h2 style="margin:0 0 12px;font-family:Georgia,serif">Bienvenida a nuestra web, ${esc(nombre)}</h2><p>Ya tienes acceso a la Zona hermana, el espacio privado del cuartel. Poco a poco irás encontrando ahí la confirmación de asistencia a los sábados, tus cuotas, las actas y las convocatorias.</p>${msg ? `<p style="font-style:italic">${esc(msg)}</p>` : ''}<p><b>Cómo empezar</b></p><ol style="padding-left:20px"><li>Pulsa el botón de abajo.</li><li>La primera vez que accedas, crea tu contraseña.</li><li>Desde entonces entras con tu correo y tu contraseña, o con Google si usas este mismo correo.</li></ol>`,
  'Crear mi contraseña', url, 'El enlace es personal y caduca en 7 días. Si no lo esperabas, puedes ignorar este correo.');
const mailReset = (env, req, nombre, url) => mailShell(env, req,
  `<h2 style="margin:0 0 12px;font-family:Georgia,serif">Hola, ${esc(nombre)}</h2><p>Has pedido crear una contraseña nueva para la Zona hermana de Las Tribulaciones de Sara. Pulsa el botón para elegirla.</p>`,
  'Crear contraseña nueva', url, 'El enlace es personal y caduca en 24 horas. Si no lo has pedido tú, puedes ignorar este correo: tu contraseña actual sigue funcionando.');
async function enviarEnlace(env, req, h, tipo) {
  const tok = rand(32), horas = tipo === 'reset' ? 24 : 168;
  await env.DB.prepare('DELETE FROM tokens WHERE hermana_id=?').bind(h.id).run();
  await env.DB.prepare('INSERT INTO tokens VALUES(?,?,?,?)').bind(await sha(tok), h.id, tipo, Date.now() + horas * 36e5).run();
  const link = `${origin(env, req)}/zona/#/clave/${tok}`, cfg = await getCfg(env);
  const res = tipo === 'reset'
    ? await sendMail(env, h.email, 'Crea una contraseña nueva', mailReset(env, req, h.nombre, link))
    : await sendMail(env, h.email, cfg.mail_asunto, mailBienvenida(env, req, h.nombre, link, cfg.mail_mensaje));
  if (tipo === 'invitacion' && res.ok) await env.DB.prepare("UPDATE hermanas SET invitada=datetime('now') WHERE id=?").bind(h.id).run();
  return res;
}

/* ---------- imágenes ---------- */
async function guardarImagen(env, dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m || m[2].length > 1000000) return null;
  const r = await env.DB.prepare('INSERT INTO imagenes(tipo,datos) VALUES(?,?)').bind(m[1], m[2]).run();
  return r.meta.last_row_id;
}
async function borrarImagen(env, id) { if (id) await env.DB.prepare('DELETE FROM imagenes WHERE id=?').bind(id).run(); }
async function media(req, env, id) {
  const me = await userOf(req, env);
  const r = await env.DB.prepare('SELECT i.tipo,i.datos FROM imagenes i WHERE i.id=?1 AND (?2=1 OR EXISTS(SELECT 1 FROM noticias WHERE imagen_id=i.id) OR EXISTS(SELECT 1 FROM hermanas WHERE foto_id=i.id AND visible_web=1 AND estado!=\'Baja\'))').bind(id, me && me.admin ? 1 : 0).first();
  if (!r) return new Response('No encontrada', { status: 404 });
  return new Response(Uint8Array.from(atob(r.datos), c => c.charCodeAt(0)), { headers: { 'Content-Type': r.tipo, 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' } });
}

/* ---------- parte pública ---------- */
async function publico(env) {
  const [h, n, t] = await Promise.all([
    env.DB.prepare("SELECT h.nombre,c.nombre cargo,h.anio_entrada anio,h.foto_id foto FROM hermanas h LEFT JOIN cargos c ON c.id=h.cargo_id WHERE h.visible_web=1 AND h.estado!='Baja' ORDER BY COALESCE(c.orden,99),h.nombre").all(),
    env.DB.prepare("SELECT id,titulo,texto,fecha,imagen_id imagen,url,tipo FROM noticias ORDER BY fecha DESC,id DESC LIMIT 12").all(),
    env.DB.prepare('SELECT anio,texto FROM hitos ORDER BY orden,id').all(),
  ]);
  return J({ hermanas: h.results, noticias: n.results, hitos: t.results }, 200, { 'Cache-Control': 'no-store' });
}

async function noticiasPublicas(env, tipo) {
  const r = await env.DB.prepare('SELECT id,titulo,texto,fecha,imagen_id imagen,url,tipo FROM noticias WHERE tipo=? ORDER BY fecha DESC,id DESC').bind(tipo).all();
  return J(r.results, 200, { 'Cache-Control': 'no-store' });
}
const htmlEsc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
async function paginaContenido(env, id, base, tipo) {
  const n = await env.DB.prepare('SELECT id,titulo,texto,fecha,imagen_id imagen,url,tipo FROM noticias WHERE id=? AND tipo=?').bind(id,tipo).first();
  const raiz = tipo === 'cronica' ? 'cronicas' : 'noticias', etiqueta = tipo === 'cronica' ? 'Crónica de Cuaresma' : 'Noticias del cuartel';
  if (!n) return new Response('<!doctype html><html lang="es"><meta charset="utf-8"><title>Contenido no encontrado</title><h1>Contenido no encontrado</h1><a href="/' + raiz + '/">Volver</a></html>', { status:404, headers:{'Content-Type':'text/html; charset=utf-8'} });
  const title = htmlEsc(n.titulo), desc = htmlEsc(String(n.texto || '').replaceAll('\n',' ').replaceAll('\r',' ').slice(0, 155)), canonical = base + '/' + raiz + '/' + n.id + '/';
  const img = n.imagen ? base + '/media/' + n.imagen : base + '/logo.png';
  const date = htmlEsc(n.fecha || '');
  const original = n.url ? '<p><a class="btn" href="' + htmlEsc(n.url) + '" target="_blank" rel="noopener noreferrer">Ver publicación original ↗</a></p>' : '';
  const body = '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + title + ' | Las Tribulaciones de Sara</title><meta name="description" content="' + desc + '"><link rel="canonical" href="' + canonical + '"><meta name="robots" content="index,follow"><meta property="og:type" content="article"><meta property="og:site_name" content="Las Tribulaciones de Sara"><meta property="og:title" content="' + title + '"><meta property="og:description" content="' + desc + '"><meta property="og:url" content="' + canonical + '"><meta property="og:image" content="' + img + '"><meta name="twitter:card" content="summary_large_image"><script type="application/ld+json">' + JSON.stringify({ '@context':'https://schema.org','@type':'NewsArticle','headline':n.titulo,'datePublished':n.fecha,'image':[img],'mainEntityOfPage':canonical,'publisher':{'@type':'Organization','name':'Las Tribulaciones de Sara','logo':{'@type':'ImageObject','url':base+'/logo.png'}} }).replace(/</g,'\\u003c') + '</script><link rel="icon" href="/logo.png"><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet"><link rel="stylesheet" href="/estilos.css?v=20261112-9"><style>.article-wrap{max-width:900px;margin:0 auto;padding:48px 22px 80px}.article-wrap .cover{width:100%;max-height:560px;object-fit:cover;border-radius:20px;margin:24px 0}.article-wrap .copy{font-size:17px;line-height:1.85;white-space:pre-line}.article-wrap h1{font:700 clamp(36px,6vw,58px)/1.05 "Cormorant Garamond",Georgia,serif;color:var(--dk)}.back{display:inline-block;margin-bottom:26px;color:var(--br)}</style></head><body><header><nav id="nav"><a class="logo" href="/"><img src="/logo.png" alt="Las Tribulaciones de Sara"></a><a class="dk" href="/">Inicio</a><div class="nav-drop"><button class="dk nav-trigger" type="button">Historia <span>⌄</span></button><div class="nav-menu"><a href="/historia/">Historia</a><a href="/#hermandad">Hermandad</a></div></div><a class="dk" href="/#cuaresma">Cuaresma</a><div class="nav-drop"><button class="dk nav-trigger" type="button">Publicaciones <span>⌄</span></button><div class="nav-menu"><a href="/noticias/">Noticias</a><a href="/cronicas/">Crónicas</a></div></div><a class="cta" href="/zona/">Zona hermana</a><button class="hb" id="hb" aria-label="Abrir menú"><i></i><i></i><i></i></button></nav></header><div id="mn"></div><main class="article-wrap"><a class="back" href="/' + raiz + '/">← Volver a ' + (tipo === 'cronica' ? 'las crónicas' : 'las noticias') + '</a><div class="tag">' + etiqueta + ' · Las Tribulaciones de Sara</div><small class="mu">' + date + '</small><h1>' + title + '</h1>' + (n.imagen ? '<img class="cover" src="/media/' + n.imagen + '" alt="' + title + '">' : '') + '<div class="copy">' + htmlEsc(n.texto) + '</div>' + original + '</main><footer class="dkb ft"><div class="in"><b>Las Tribulaciones de Sara · Puente Genil · Desde 2007</b><a href="https://www.instagram.com/tribulacionesdesara/">Instagram · @tribulacionesdesara</a></div></footer><script>const links=[{href:"/",label:"Inicio"},{href:"/historia/",label:"Historia",group:"Historia"},{href:"/#hermandad",label:"Hermandad",group:"Historia"},{href:"/#cuaresma",label:"Cuaresma"},{href:"/noticias/",label:"Noticias",group:"Publicaciones"},{href:"/cronicas/",label:"Crónicas",group:"Publicaciones"},{href:"/zona/",label:"Zona hermana"}];const menu=open=>{document.querySelector("#mn").innerHTML=open?"<div class=\\\"sc\\\" data-c=\\\"1\\\"></div><div class=\\\"mn\\\"><button class=\\\"x\\\" data-c=\\\"1\\\" aria-label=\\\"Cerrar\\\">✕</button>"+links.map(x=>"<a class=\\\""+(x.group?"mn-sub":"")+"\\\" href=\\\""+x.href+"\\\">"+x.label+"</a>").join("")+"</div>":""};const menu=open=>{document.querySelector("#mn").innerHTML=open?"<div class=\\"sc\\" data-c=\\"1\\"></div><div class=\\"mn\\"><button class=\\"x\\" data-c=\\"1\\" aria-label=\\"Cerrar\\">✕</button>"+links.map(x=>"<a href=\\""+x[0]+"\\">"+x[1]+"</a>").join("")+"</div>":""};document.querySelector("#hb").addEventListener("click",()=>menu(true));document.addEventListener("click",e=>{if(e.target.closest("[data-c]")||e.target.closest(".mn a"))menu(false)});</script></body></html>';
  return new Response(body, { headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=120','X-Content-Type-Options':'nosniff'} });
}
async function sitemapNoticias(env, base) {
  const r = await env.DB.prepare('SELECT id,tipo FROM noticias ORDER BY fecha DESC,id DESC').all();
  const urls = [base+'/',base+'/historia/',base+'/noticias/',base+'/cronicas/',...r.results.map(n=>base+'/'+(n.tipo === 'cronica' ? 'cronicas' : 'noticias')+'/'+n.id+'/')];
  const xml = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls.map(u=>'<url><loc>'+u.replace(/&/g,'&amp;')+'</loc></url>').join('') + '</urlset>';
  return new Response(xml,{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=300'}});
}

/* ---------- administración ---------- */
const cuentaDe = r => (r.tiene_pass || r.ultimo_acceso ? 'activa' : r.invitada ? 'invitada' : 'sin');
async function admin(req, env, me, m, p, b) {
  let r;
  if (m === 'POST' && p === '/api/admin/hermanas/publicar-activas') {
    await env.DB.prepare("UPDATE hermanas SET visible_web=1 WHERE estado='Activa'").run();
    return J({ ok: true });
  }
  if (m === 'GET' && p === '/api/admin/hermanas') {
    const rs = (await env.DB.prepare("SELECT h.id,h.nombre,h.email,h.telefono,h.cargo_id,c.nombre cargo,h.estado,h.es_admin,h.anio_entrada,h.visible_web,h.foto_id,h.pass_hash IS NOT NULL tiene_pass,h.invitada,h.ultimo_acceso FROM hermanas h LEFT JOIN cargos c ON c.id=h.cargo_id ORDER BY h.estado='Baja',h.nombre").all()).results;
    return J(rs.map(x => ({ id: x.id, nombre: x.nombre, email: x.email, telefono: x.telefono || '', cargo_id: x.cargo_id, cargo: x.cargo, estado: x.estado, es_admin: !!x.es_admin, anio_entrada: x.anio_entrada, visible_web: !!x.visible_web, foto: x.foto_id, cuenta: cuentaDe(x) })));
  }
  if (m === 'POST' && p === '/api/admin/hermanas') return crearHermana(env, b);
  if (m === 'PUT' && (r = p.match(/^\/api\/admin\/hermanas\/(\d+)$/))) return editarHermana(env, +r[1], b);
  if (m === 'POST' && (r = p.match(/^\/api\/admin\/hermanas\/(\d+)\/(invitar|reset)$/))) return enviarA(env, req, +r[1], r[2]);
  if (m === 'POST' && p === '/api/admin/invitar-pendientes') return E('Las bienvenidas se envían individualmente desde cada hermana.', 400);
  if (m === 'GET' && p === '/api/admin/cargos') return J((await env.DB.prepare('SELECT c.id,c.nombre,c.permiso,(SELECT COUNT(*) FROM hermanas h WHERE h.cargo_id=c.id) usos FROM cargos c ORDER BY c.orden,c.id').all()).results);
  if (m === 'POST' && p === '/api/admin/cargos') return cargoGuardar(env, null, b);
  if ((m === 'PUT' || m === 'DELETE') && (r = p.match(/^\/api\/admin\/cargos\/(\d+)$/))) return m === 'PUT' ? cargoGuardar(env, +r[1], b) : cargoBorrar(env, +r[1]);
  if (m === 'GET' && p === '/api/admin/correo') return J(await getCfg(env));
  if (m === 'PUT' && p === '/api/admin/correo') {
    const a = String(b.mail_asunto || '').trim().slice(0, 150) || 'Bienvenida a la web de Las Tribulaciones de Sara', t = String(b.mail_mensaje || '').trim().slice(0, 600);
    await env.DB.batch([env.DB.prepare('INSERT OR REPLACE INTO config VALUES(?,?)').bind('mail_asunto', a), env.DB.prepare('INSERT OR REPLACE INTO config VALUES(?,?)').bind('mail_mensaje', t)]);
    return J({ ok: true });
  }
  if (m === 'POST' && p === '/api/admin/correo/prueba') {
    const cfg = await getCfg(env), res = await sendMail(env, me.email, cfg.mail_asunto, mailBienvenida(env, req, me.nombre, origin(env, req) + '/zona/', cfg.mail_mensaje));
    return J({ ok: true, enviado: res.ok, aviso: res.aviso });
  }
  if (m === 'GET' && p === '/api/admin/noticias') return J((await env.DB.prepare('SELECT id,titulo,texto,fecha,imagen_id imagen,url,tipo FROM noticias ORDER BY fecha DESC,id DESC').all()).results);
  if (m === 'POST' && p === '/api/admin/noticias') return noticiaGuardar(env, me, null, b);
  if ((m === 'PUT' || m === 'DELETE') && (r = p.match(/^\/api\/admin\/noticias\/(\d+)$/))) {
    if (m === 'PUT') return noticiaGuardar(env, me, +r[1], b);
    const n = await env.DB.prepare('SELECT imagen_id FROM noticias WHERE id=?').bind(+r[1]).first();
    await env.DB.prepare('DELETE FROM noticias WHERE id=?').bind(+r[1]).run();
    if (n) await borrarImagen(env, n.imagen_id);
    return J({ ok: true });
  }
  if (m === 'PUT' && p === '/api/admin/hitos') {
    const hs = (Array.isArray(b.hitos) ? b.hitos : []).map(h => ({ a: String(h.anio || '').trim().slice(0, 20), t: String(h.texto || '').trim().slice(0, 800) })).filter(h => h.a && h.t).slice(0, 40);
    await env.DB.batch([env.DB.prepare('DELETE FROM hitos'), ...hs.map((h, i) => env.DB.prepare('INSERT INTO hitos(anio,texto,orden) VALUES(?,?,?)').bind(h.a, h.t, i))]);
    return J({ ok: true, total: hs.length });
  }
  return E('No encontrado', 404);
}

async function crearHermana(env, b) {
  const nombre = String(b.nombre || '').trim(), email = String(b.email || '').trim().toLowerCase() || null;
  const telefono = b.telefono ? normalizarTelefono(b.telefono) : null;
  if (nombre.length < 2 || nombre.length > 80) return E('Escribe el nombre de la hermana');
  if (email && !emailOk(email)) return E('El correo no es válido');
  if (b.telefono && !telefono) return E('El teléfono no es válido. Escribe el prefijo internacional, por ejemplo +34 600 000 000.');
  const cargo = b.cargo_id ? +b.cargo_id : (await env.DB.prepare("SELECT id FROM cargos WHERE nombre='Hermana'").first())?.id ?? null;
  const anio = b.anio_entrada ? +b.anio_entrada : null;
  try {
    const r = await env.DB.prepare('INSERT INTO hermanas(nombre,email,telefono,cargo_id,anio_entrada,visible_web) VALUES(?,?,?,?,?,?)').bind(nombre, email, telefono, cargo, anio, b.visible_web ? 1 : 0).run();
    return J({ ok: true, id: r.meta.last_row_id });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return E('Ese correo ya está registrado', 409);
    throw e;
  }
}
async function editarHermana(env, id, b) {
  const cur = await env.DB.prepare('SELECT * FROM hermanas WHERE id=?').bind(id).first();
  if (!cur) return E('No encontrada', 404);
  const nombre = b.nombre !== undefined ? String(b.nombre).trim() : cur.nombre;
  const email = b.email !== undefined ? String(b.email).trim().toLowerCase() || null : cur.email;
  const telefono = b.telefono !== undefined ? (String(b.telefono).trim() ? normalizarTelefono(b.telefono) : null) : cur.telefono;
  const estado = b.estado ?? cur.estado, esAdmin = b.es_admin !== undefined ? (b.es_admin ? 1 : 0) : cur.es_admin;
  if (nombre.length < 2 || nombre.length > 80) return E('Escribe el nombre de la hermana');
  if (email && !emailOk(email)) return E('El correo no es válido');
  if (b.telefono !== undefined && String(b.telefono).trim() && !telefono) return E('El teléfono no es válido. Escribe el prefijo internacional, por ejemplo +34 600 000 000.');
  if (!['Activa', 'Pasiva', 'Baja'].includes(estado)) return E('Estado no válido');
  if (cur.es_admin && (!esAdmin || estado === 'Baja')) {
    const n = await env.DB.prepare("SELECT COUNT(*) n FROM hermanas WHERE es_admin=1 AND estado!='Baja' AND id!=?").bind(id).first();
    if (n.n === 0) return E('Tiene que quedar al menos una administradora activa');
  }
  let foto = cur.foto_id;
  if (b.quitar_foto) { await borrarImagen(env, foto); foto = null; }
  if (b.foto) {
    const nuevo = await guardarImagen(env, b.foto);
    if (!nuevo) return E('La foto no es válida o pesa demasiado');
    await borrarImagen(env, foto); foto = nuevo;
  }
  const cargo = b.cargo_id !== undefined ? (b.cargo_id ? +b.cargo_id : null) : cur.cargo_id;
  const anio = b.anio_entrada !== undefined ? (b.anio_entrada ? +b.anio_entrada : null) : cur.anio_entrada;
  const vis = b.visible_web !== undefined ? (b.visible_web ? 1 : 0) : cur.visible_web;
  try {
    await env.DB.prepare('UPDATE hermanas SET nombre=?,email=?,telefono=?,cargo_id=?,estado=?,es_admin=?,anio_entrada=?,visible_web=?,foto_id=? WHERE id=?').bind(nombre, email, telefono, cargo, estado, esAdmin, anio, vis, foto, id).run();
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return E('Ese correo ya está registrado', 409);
    throw e;
  }
  if (estado === 'Baja') await env.DB.prepare('DELETE FROM sesiones WHERE hermana_id=?').bind(id).run();
  return J({ ok: true, foto });
}
async function enviarA(env, req, id, que) {
  const h = await env.DB.prepare('SELECT id,nombre,email,telefono,estado FROM hermanas WHERE id=?').bind(id).first();
  if (!h) return E('No encontrada', 404);
  if (h.estado === 'Baja') return E('Está dada de baja');
  if (que === 'invitar') {
    if (!h.telefono) return E('Añade primero el teléfono de WhatsApp de esta hermana');
    const tok = rand(32), horas = 168;
    await env.DB.prepare('DELETE FROM tokens WHERE hermana_id=?').bind(h.id).run();
    await env.DB.prepare('INSERT INTO tokens VALUES(?,?,?,?)').bind(await sha(tok), h.id, 'invitacion', Date.now() + horas * 36e5).run();
    const link = `${origin(env, req)}/zona/#/clave/${tok}`;
    await env.DB.prepare("UPDATE hermanas SET invitada=datetime('now') WHERE id=?").bind(h.id).run();
    const mensaje = `¡Hola, ${h.nombre}! Te damos la bienvenida a la Zona hermana de Las Tribulaciones de Sara. Desde aquí podrás consultar la información y realizar las gestiones del cuartel. Para activar tu acceso y crear tu contraseña, entra en este enlace personal (válido durante 7 días): ${link}`;
    return J({ ok:true, whatsapp:`https://wa.me/${h.telefono}?text=${encodeURIComponent(mensaje)}` });
  }
  if (!h.email) return E('Añade primero el correo electrónico de esta hermana');
  const res = await enviarEnlace(env, req, h, 'reset');
  return J({ ok:true,enviado:res.ok,aviso:res.aviso||null });
}
async function cargoGuardar(env, id, b) {
  const nombre = String(b.nombre || '').trim(), permiso = b.permiso || 'none';
  if (nombre.length < 2 || nombre.length > 40) return E('Escribe el nombre del cargo');
  if (!['none', 'tes', 'actas'].includes(permiso)) return E('Permiso no válido');
  try {
    if (id) await env.DB.prepare('UPDATE cargos SET nombre=?,permiso=? WHERE id=?').bind(nombre, permiso, id).run();
    else await env.DB.prepare('INSERT INTO cargos(nombre,permiso,orden) VALUES(?,?,(SELECT COALESCE(MAX(orden),0)+1 FROM cargos))').bind(nombre, permiso).run();
  } catch (e) { if (String(e.message).includes('UNIQUE')) return E('Ya existe un cargo con ese nombre', 409); throw e; }
  return J({ ok: true });
}
async function cargoBorrar(env, id) {
  const c = await env.DB.prepare('SELECT nombre,(SELECT COUNT(*) FROM hermanas WHERE cargo_id=cargos.id) usos FROM cargos WHERE id=?').bind(id).first();
  if (!c) return E('No encontrado', 404);
  if (c.nombre === 'Hermana') return E('El cargo "Hermana" no se puede borrar');
  if (c.usos) return E('Hay hermanas con este cargo. Cámbiales el cargo antes de borrarlo.', 409);
  await env.DB.prepare('DELETE FROM cargos WHERE id=?').bind(id).run();
  return J({ ok: true });
}
async function noticiaGuardar(env, me, id, b) {
  const titulo = String(b.titulo || '').trim(), texto = String(b.texto || '').trim();
  const tipo = b.tipo === 'cronica' ? 'cronica' : 'noticia';
  const fecha = String(b.fecha || '').trim() || new Date().toISOString().slice(0,10);
  if (titulo.length < 3 || titulo.length > 150) return E('Escribe un título');
  if (texto.length < 3 || texto.length > 6000) return E('Escribe el texto de la publicación');
  const fechaValida = /^\d{4}-\d{2}-\d{2}$/.test(fecha) && !Number.isNaN(Date.parse(fecha+'T00:00:00Z')) && new Date(fecha+'T00:00:00Z').toISOString().slice(0,10) === fecha;
  if (!fechaValida) return E('Selecciona una fecha válida');
  const url = String(b.url || '').trim();
  if (url) {
    if (url.length > 500) return E('El enlace es demasiado largo');
    let u;
    try { u = new URL(url); } catch { return E('Introduce una URL válida de Instagram o Facebook'); }
    const host = u.hostname.toLowerCase();
    const social = host === 'instagram.com' || host.endsWith('.instagram.com') || host === 'facebook.com' || host.endsWith('.facebook.com') || host === 'fb.watch' || host.endsWith('.fb.watch') || host === 'fb.com' || host.endsWith('.fb.com');
    if (u.protocol !== 'https:' || !social) return E('El enlace debe ser de Instagram o Facebook y comenzar por https://');
  }
  let img = null;
  if (b.imagen) { img = await guardarImagen(env, b.imagen); if (!img) return E('La foto no es válida o pesa demasiado'); }
  if (!id) {
    const r = await env.DB.prepare('INSERT INTO noticias(titulo,texto,fecha,imagen_id,autor_id,url,tipo) VALUES(?,?,?,?,?,?,?)').bind(titulo, texto, fecha, img, me.id, url || null, tipo).run();
    return J({ ok: true, id: r.meta.last_row_id });
  }
  const cur = await env.DB.prepare('SELECT imagen_id FROM noticias WHERE id=?').bind(id).first();
  if (!cur) return E('No encontrada', 404);
  let nueva = cur.imagen_id;
  if (b.quitar_imagen || img) { await borrarImagen(env, cur.imagen_id); nueva = img; }
  await env.DB.prepare('UPDATE noticias SET titulo=?,texto=?,fecha=?,imagen_id=?,url=?,tipo=? WHERE id=?').bind(titulo, texto, fecha, nueva, url || null, tipo, id).run();
  return J({ ok: true });
}
