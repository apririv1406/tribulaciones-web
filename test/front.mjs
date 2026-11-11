// Prueba de que las pantallas se generan sin errores (sin navegador). Ejecutar: node test/front.mjs
import fs from 'node:fs'; import assert from 'node:assert/strict';
const els = {}; const el = k => els[k] ??= { innerHTML: '', insertAdjacentHTML() {}, addEventListener() {} };
globalThis.document = { querySelector: el, querySelectorAll: () => [], addEventListener() {} };
globalThis.addEventListener = () => {}; globalThis.location = { hash: '#/' };
const D = { me: { id: 1, nombre: 'Alba Prieto', email: 'a@x.es', cargo: 'Hermana', admin: true, tes: true, actas: true },
  hermanas: [{ id: 1, nombre: 'Alba Prieto', email: 'a@x.es', cargo_id: 8, cargo: 'Hermana', estado: 'Activa', es_admin: true, anio_entrada: 2009, visible_web: true, foto: 5, cuenta: 'activa' }, { id: 2, nombre: 'Laura <b>X</b>', email: 'l@x.es', cargo_id: 1, cargo: 'Presidenta', estado: 'Activa', es_admin: false, anio_entrada: null, visible_web: false, foto: null, cuenta: 'sin' }],
  cargos: [{ id: 1, nombre: 'Presidenta', permiso: 'none', usos: 1 }, { id: 8, nombre: 'Hermana', permiso: 'none', usos: 1 }],
  pub: { hermanas: [{ nombre: 'Alba Prieto', cargo: 'Hermana', anio: 2009, foto: 5 }], noticias: [{ id: 1, titulo: 'Sábado <script>', texto: 'Texto\nlargo', fecha: '2026-03-07', imagen: 3 }], hitos: [{ anio: '2007', texto: 'Inicio' }] } };
let logged = false;
globalThis.fetch = async (u, o = {}) => {
  const j = d => ({ ok: true, status: 200, json: async () => d });
  if (u === '/api/me') return logged ? j(D.me) : { ok: false, status: 401, json: async () => ({ error: 'no' }) };
  if (u === '/api/admin/hermanas') return j(D.hermanas); if (u === '/api/admin/cargos') return j(D.cargos);
  if (u === '/api/admin/correo') return j({ mail_asunto: 'Hola', mail_mensaje: '' }); if (u === '/api/public') return j(D.pub);
  return j({ ok: true });
};
let src = fs.readFileSync('public/zona.js', 'utf8') + '\n;globalThis.__t={render,setME:m=>{ME=m},html:()=>LAST};';
(0, eval)(src);
const { render, setME, html } = globalThis.__t;
await new Promise(r => setTimeout(r, 20));
for (const h of ['#/', '#/olvido', '#/setup', '#/clave/abc_DEF-1', '#/error/google', '#/error/no-registrada']) { location.hash = h; await render(); assert.ok(html().length > 100, h); }
console.log('  ✓ pantallas de acceso');
logged = true; setME(D.me);
for (const h of ['#/', '#/perfil', '#/admin/hermanas', '#/admin/cargos', '#/admin/correo', '#/admin/noticias', '#/admin/historia']) { location.hash = h; await render(); assert.ok(html().length > 100, h); }
location.hash = '#/admin/hermanas'; await render(); let h = html();
assert.ok(h.includes('Laura &lt;b&gt;X&lt;/b&gt;'), 'escapa HTML'); assert.ok(h.includes('/media/5')); assert.ok(h.includes('Enviar bienvenida')); assert.ok(h.includes('Restablecer contraseña')); assert.ok(h.includes('name="foto"'));
console.log('  ✓ administración: hermanas (con foto, bienvenida y restablecer), cargos, correo, noticias, historia');
setME({ ...D.me, admin: false }); location.hash = '#/admin/hermanas'; await render(); assert.ok(!html().includes('Nueva hermana')); console.log('  ✓ una hermana sin permiso no ve la administración');
// web pública
const pub = { ...els }; for (const k in els) delete els[k];
globalThis.document.querySelectorAll = () => []; globalThis.document.querySelector = el;
(0, eval)(fs.readFileSync('public/publico.js', 'utf8').replace(/^'use strict';/, '').replace(/const \$ =/, 'var $2 =').replace(/\$\(/g, '$2('));
await new Promise(r => setTimeout(r, 20));
assert.ok(els['#hermanas-l'].innerHTML.includes('/media/5')); assert.ok(els['#noticias-l'].innerHTML.includes('Sábado &lt;script&gt;')); assert.ok(els['#hitos'].innerHTML.includes('2007'));
console.log('  ✓ web pública: hermanas con foto, noticias (HTML escapado) e hitos\n\nTODO CORRECTO');
