// Prueba del servidor con una base de datos SQLite real (sin internet). Ejecutar: node test/run.mjs
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { ensureSchema } from '../src/schema.js';

function d1() {
  const db = new DatabaseSync(':memory:'); db.exec('PRAGMA foreign_keys=ON');
  const stm = (sql, args = []) => ({
    bind: (...a) => stm(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => { const r = db.prepare(sql).run(...args); return { meta: { last_row_id: Number(r.lastInsertRowid), changes: r.changes } }; },
    _run: () => db.prepare(sql).run(...args),
  });
  return { prepare: s => stm(s), batch: async a => a.map(s => { const r=s._run(); return { meta: { last_row_id: Number(r.lastInsertRowid), changes: r.changes }, changes: r.changes }; }) };
}
const correos = [];
globalThis.fetch = async (url, opt) => { if (String(url).includes('resend')) { correos.push({ ...JSON.parse(opt.body) }); return new Response('{}', { status: 200 }); } throw new Error('fetch inesperado ' + url); };
const env = { DB: d1(), ASSETS: { fetch: () => new Response('asset') }, ADMIN_EMAIL: 'Alba@Ejemplo.com', ADMIN_NAME: 'Alba', SETUP_KEY: 'clave-de-prueba', SITE_URL: 'https://ejemplo.es', RESEND_API_KEY: 'k', MAIL_FROM: 'Cuartel <hola@ejemplo.es>' };
const call = async (method, path, body, cookie) => {
  const r = await worker.fetch(new Request('https://ejemplo.es' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch', ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined }), env);
  const sc = r.headers.get('set-cookie'); let data = null; try { data = await r.clone().json(); } catch {}
  return { status: r.status, data, cookie: sc ? sc.split(';')[0] : null, r };
};
const ok = (n) => console.log('  ✓', n);
const foto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

// 0 reparación de esquemas antiguos: no elimina ni reinicia datos.
const dbLegada = d1();
await ensureSchema(dbLegada);
await dbLegada.prepare('ALTER TABLE sabados DROP COLUMN categoria').run();
await dbLegada.prepare('ALTER TABLE asistencias_sabado DROP COLUMN alergias').run();
await dbLegada.prepare('ALTER TABLE consumos_sabado DROP COLUMN refrescos').run();
await ensureSchema(dbLegada);
const colsSabado = await dbLegada.prepare('PRAGMA table_info(sabados)').all();
const colsAsistencia = await dbLegada.prepare('PRAGMA table_info(asistencias_sabado)').all();
const colsConsumo = await dbLegada.prepare('PRAGMA table_info(consumos_sabado)').all();
assert.ok(colsSabado.results.some(x => x.name === 'categoria'));
assert.ok(colsAsistencia.results.some(x => x.name === 'alergias'));
assert.ok(colsConsumo.results.some(x => x.name === 'refrescos'));
ok('migración compatible: repara columnas antiguas sin borrar datos');

// 1 público y arranque
let r = await call('GET', '/api/public'); assert.equal(r.status, 200); assert.equal(r.data.hitos.length, 2); ok('arranque: tablas creadas y datos de partida');
// 2 petición sin cabecera
r = await worker.fetch(new Request('https://ejemplo.es/api/auth/login', { method: 'POST', body: '{}' }), env); assert.equal(r.status, 403); ok('rechaza peticiones sin cabecera de seguridad');
// 3 setup
r = await call('POST', '/api/setup', { key: 'mala', password: 'abcdefgh1' }); assert.equal(r.status, 403);
r = await call('POST', '/api/setup', { key: 'clave-de-prueba', password: 'corta' }); assert.equal(r.status, 400);
r = await call('POST', '/api/setup', { key: 'clave-de-prueba', password: 'MiClaveSegura1' }); assert.equal(r.status, 200); const adm = r.cookie; assert.ok(adm.startsWith('sid='));
r = await call('GET', '/api/me', null, adm); assert.equal(r.data.admin, true); assert.equal(r.data.email, 'alba@ejemplo.com');
r = await call('POST', '/api/setup', { key: 'clave-de-prueba', password: 'OtraClave12345' }); assert.equal(r.status, 409); ok('primer acceso de la administradora con clave de instalación');
// 4 login
r = await call('POST', '/api/auth/login', { email: 'alba@ejemplo.com', password: 'mal' }); assert.equal(r.status, 401);
r = await call('POST', '/api/auth/login', { email: 'ALBA@ejemplo.com', password: 'MiClaveSegura1' }); assert.equal(r.status, 200); ok('login correcto e incorrecto');
// 5 crear hermana e invitar
r = await call('POST', '/api/admin/hermanas', { nombre: 'Laura Bascón', email: 'laura@ejemplo.com', telefono: '+34600111222' }, adm); assert.equal(r.status, 200); const lid = r.data.id;
r = await call('POST', '/api/admin/hermanas', { nombre: 'Otra', email: 'LAURA@ejemplo.com' }, adm); assert.equal(r.status, 409);
r = await call('POST', `/api/admin/hermanas/${lid}/invitar`, null, adm); assert.equal(r.status, 200); assert.match(r.data.whatsapp, /^https:\/\/wa\.me\//);
const mensajeBienvenida = new URL(r.data.whatsapp).searchParams.get('text'); assert.match(mensajeBienvenida, /bienvenida/i); const tok = /#\/clave\/([\w-]+)/.exec(mensajeBienvenida)[1];
r = await call('GET', '/api/admin/hermanas', null, adm); assert.equal(r.data.find(h => h.id === lid).cuenta, 'invitada');
r = await call('POST', '/api/auth/password/set', { token: tok, password: 'Laura-2026-ok' }); assert.equal(r.status, 200); const lau = r.cookie;
r = await call('POST', '/api/auth/password/set', { token: tok, password: 'Laura-2026-ok' }); assert.equal(r.status, 410); ok('bienvenida por WhatsApp → crea contraseña → el enlace no se puede reutilizar');
r = await call('GET', '/api/admin/hermanas', null, adm); assert.equal(r.data.find(h => h.id === lid).cuenta, 'activa');
// 6 permisos
r = await call('GET', '/api/admin/hermanas', null, lau); assert.equal(r.status, 403);
r = await call('GET', '/api/admin/hermanas'); assert.equal(r.status, 401); ok('una hermana normal no entra en administración');
// 7 olvido de contraseña
const n0 = correos.length; r = await call('POST', '/api/auth/forgot', { email: 'laura@ejemplo.com' }); assert.equal(r.status, 200); assert.equal(correos.length, n0 + 1); assert.match(correos.at(-1).html, /Crear contraseña nueva/);
r = await call('POST', '/api/auth/forgot', { email: 'noexiste@ejemplo.com' }); assert.equal(r.status, 200); assert.equal(correos.length, n0 + 1);
r = await call('POST', `/api/admin/hermanas/${lid}/reset`, null, adm); assert.equal(r.data.enviado, true); const tok2 = /#\/clave\/([\w-]+)/.exec(correos.at(-1).html)[1];
r = await call('POST', '/api/auth/password/set', { token: tok2, password: 'Nueva-Clave-77' }); assert.equal(r.status, 200);
r = await call('GET', '/api/me', null, lau); assert.equal(r.status, 401); // cambiar la contraseña cierra sesiones antiguas
r = await call('POST', '/api/auth/login', { email: 'laura@ejemplo.com', password: 'Laura-2026-ok' }); assert.equal(r.status, 401); ok('olvido y restablecer (administradora): no revela si el correo existe, y cierra sesiones antiguas');
// 8 foto en la hermana → aparece en público
r = await call('PUT', `/api/admin/hermanas/${lid}`, { cargo_id: 1, anio_entrada: 2010, visible_web: false, foto }, adm); assert.equal(r.status, 200); const fid = r.data.foto; assert.ok(fid);
r = await call('GET', '/api/public'); assert.equal(r.data.hermanas.length, 0);
r = await worker.fetch(new Request('https://ejemplo.es/media/' + fid), env); assert.equal(r.status, 404);
r = await worker.fetch(new Request('https://ejemplo.es/media/' + fid, { headers: { cookie: adm } }), env); assert.equal(r.status, 200);
r = await call('PUT', `/api/admin/hermanas/${lid}`, { visible_web: true }, adm);
r = await call('GET', '/api/public'); assert.equal(r.data.hermanas.length, 1); assert.equal(r.data.hermanas[0].foto, fid); assert.equal(r.data.hermanas[0].cargo, 'Presidenta'); assert.equal(r.data.hermanas[0].anio, 2010);
r = await worker.fetch(new Request('https://ejemplo.es/media/' + fid), env); assert.equal(r.status, 200); assert.equal(r.headers.get('content-type'), 'image/png'); ok('la foto de una hermana aparece en la web pública (y solo si está marcada "aparece en la web")');
// 9 baja
r = await call('PUT', `/api/admin/hermanas/${lid}`, { estado: 'Baja' }, adm); r = await call('GET', '/api/public'); assert.equal(r.data.hermanas.length, 0); ok('una baja desaparece de la web pública');
// 10 última administradora
const aid = (await call('GET', '/api/me', null, adm)).data.id;
r = await call('PUT', `/api/admin/hermanas/${aid}`, { es_admin: false }, adm); assert.equal(r.status, 400);
r = await call('PUT', `/api/admin/hermanas/${aid}`, { estado: 'Baja' }, adm); assert.equal(r.status, 400); ok('no se puede quitar a la última administradora');
// 11 cargos
r = await call('POST', '/api/admin/cargos', { nombre: 'Camarera', permiso: 'none' }, adm); assert.equal(r.status, 200);
r = await call('POST', '/api/admin/cargos', { nombre: 'Camarera', permiso: 'none' }, adm); assert.equal(r.status, 409);
r = await call('DELETE', '/api/admin/cargos/1', null, adm); assert.equal(r.status, 409); ok('cargos: crear, duplicado y borrar en uso');
// 12 noticias
r = await call('POST', '/api/admin/noticias', { titulo: 'Sábado de Pasión', texto: 'Un sábado precioso.', imagen: foto }, adm); assert.equal(r.status, 200); const nid = r.data.id;
r = await call('GET', '/api/public'); assert.equal(r.data.noticias.length, 1); assert.ok(r.data.noticias[0].imagen);
r = await call('DELETE', `/api/admin/noticias/${nid}`, null, adm); r = await call('GET', '/api/public'); assert.equal(r.data.noticias.length, 0); ok('noticias con foto: publicar y borrar');
// 13 hitos
r = await call('PUT', '/api/admin/hitos', { hitos: [{ anio: '2007', texto: 'Inicio' }, { anio: '', texto: 'sin año' }, { anio: '2012', texto: 'Segundo' }] }, adm); assert.equal(r.data.total, 2); ok('historia: hitos editables');
// 14 bloqueo por intentos
for (let i = 0; i < 8; i++) await call('POST', '/api/auth/login', { email: 'bloqueo@ejemplo.com', password: 'x' });
r = await call('POST', '/api/auth/login', { email: 'bloqueo@ejemplo.com', password: 'x' }); assert.equal(r.status, 429); ok('bloqueo tras demasiados intentos');
// 15 sin correo configurado
const e2 = { ...env, RESEND_API_KEY: undefined };
const w = await worker.fetch(new Request('https://ejemplo.es/api/admin/hermanas/' + aid + '/invitar', { method: 'POST', headers: { 'X-Requested-With': 'fetch', cookie: adm, 'Content-Type': 'application/json' } }), e2);
console.log('  ·', w.status, 'sin Resend:', (await w.json()).error ?? 'responde con aviso');
// 16 parámetros configurables, sorteo equilibrado y presupuesto automático de cocina
r = await call('POST', '/api/admin/hermanas', { nombre: 'Hermana de prueba 1', email: 'prueba1@ejemplo.com', telefono: '+34600111223' }, adm); assert.equal(r.status, 200); const hermanaInvitadasId = r.data.id;
r = await call('POST', '/api/admin/hermanas', { nombre: 'Hermana de prueba 2', email: 'prueba2@ejemplo.com' }, adm); assert.equal(r.status, 200); const hermanaDosId = r.data.id;
r = await call('POST', '/api/modulos/actas/juntas', { fecha: '2099-01-02', hora: '12:00', lugar: 'Cuartel', convocatoria: 'Junta de prueba', orden_dia: 'Tesorería y organización' }, adm); assert.equal(r.status, 200); const juntaPruebaId = r.data.id; assert.ok(r.data.correos_enviados >= 3);
r = await call('PUT', '/api/modulos/actas/juntas/'+juntaPruebaId+'/asistencia', { hermanas: [aid, hermanaInvitadasId, hermanaDosId] }, adm); assert.equal(r.status, 200); assert.equal(r.data.total, 3);
r = await call('GET', '/api/modulos/actas', null, adm); assert.equal(r.status, 200); assert.equal(r.data.juntas.find(x => x.id === juntaPruebaId).asistentes, 3);
r = await call('PUT', '/api/modulos/actas/juntas/'+juntaPruebaId+'/acta', { texto: 'Acta de prueba con acuerdos adoptados.', acuerdos: 'Revisar tesorería.' }, adm); assert.equal(r.status, 200);
const actaPdf = 'data:application/pdf;base64,JVBERi0xLjQK';
r = await call('PUT', '/api/modulos/actas/juntas/'+juntaPruebaId+'/archivo', { nombre: 'Acta_2026.pdf', datos: actaPdf }, adm); assert.equal(r.status, 200);
r = await call('GET', '/api/modulos/actas', null, adm); assert.ok(r.data.documentos.some(x => Number(x.junta_id) === juntaPruebaId && x.nombre === 'Acta_2026.pdf'));
const actaArchivo = await worker.fetch(new Request('https://ejemplo.es/api/modulos/actas/juntas/'+juntaPruebaId+'/archivo', { headers: { 'X-Requested-With': 'fetch', cookie: adm } }), env); assert.equal(actaArchivo.status, 200); assert.equal(actaArchivo.headers.get('content-type'), 'application/pdf');
r = await call('POST', '/api/modulos/actas/juntas/historica', { fecha: '2026-02-14', lugar: 'Junta histórica', orden_dia: 'Archivo de prueba' }, adm); assert.equal(r.status, 200); const juntaHistoricaId = r.data.id;
r = await call('PUT', '/api/modulos/actas/juntas/'+juntaHistoricaId+'/archivo', { nombre: 'Acta_historica.pdf', datos: actaPdf }, adm); assert.equal(r.status, 200);
r = await call('POST', '/api/modulos/actas/juntas/historica', { fecha: 'fecha incorrecta' }, adm); assert.equal(r.status, 400);
const invitacionPrueba = await call('POST', '/api/admin/hermanas/'+hermanaInvitadasId+'/invitar', null, adm); assert.equal(invitacionPrueba.status, 200); const textoInvitacion = new URL(invitacionPrueba.data.whatsapp).searchParams.get('text'); const tokenPrueba = textoInvitacion.split('/zona/#/clave/')[1].split(' ')[0]; r = await call('POST', '/api/auth/password/set', { token: tokenPrueba, password: 'Prueba-2026-ok' }); assert.equal(r.status, 200); const lau2 = r.cookie;
r = await call('GET', '/api/modulos/actas', null, lau2); assert.equal(r.status, 200); assert.equal(r.data.solo_lectura, true); assert.ok(r.data.documentos.some(x => Number(x.junta_id) === juntaPruebaId));
const actaArchivoHermana = await worker.fetch(new Request('https://ejemplo.es/api/modulos/actas/juntas/'+juntaPruebaId+'/archivo', { headers: { 'X-Requested-With': 'fetch', cookie: lau2 } }), env); assert.equal(actaArchivoHermana.status, 200);
r = await call('PUT', '/api/modulos/actas/juntas/'+juntaPruebaId+'/archivo', { nombre: 'No_permitido.pdf', datos: actaPdf }, lau2); assert.equal(r.status, 403);
ok('actas: subir y consultar PDF, registrar reuniones históricas y proteger permisos de edición');
r = await call('PUT', '/api/modulos/actas/estatutos', { nombre: 'Estatutos.pdf', datos: 'data:application/pdf;base64,JVBERi0xLjQK' }, adm); assert.equal(r.status, 200);
r = await call('GET', '/api/modulos/actas/estatutos', null, adm); assert.equal(r.status, 200); assert.equal(r.data.documento.nombre, 'Estatutos.pdf');
const pdf = await worker.fetch(new Request('https://ejemplo.es/api/modulos/actas/estatutos/archivo', { headers: { 'X-Requested-With': 'fetch', cookie: adm } }), env); assert.equal(pdf.status, 200); assert.equal(pdf.headers.get('content-type'), 'application/pdf');
r = await call('PUT', '/api/modulos/tesoreria/config', { cuota_mensual: 35, sabado_precio: 10, invitada_precio: 10, copa_precio: 2, refresco_precio: 1, cocina_precio_persona: 12.5, personas_por_turno: 2, cuotas_extraordinarias: [{ nombre: 'Aportación de Cuaresma', categoria: 'Cuaresma', importe: 6.25, tipo: 'una_vez' }] }, adm); assert.equal(r.status, 200);
r = await call('PUT', '/api/modulos/tesoreria/config', { cuotas_extraordinarias: [{ nombre: 'Aportación de Cuaresma', categoria: 'Cuaresma', importe: 6.25, tipo: 'una_vez' }] }, adm); assert.equal(r.status, 200);
r = await call('PUT', '/api/modulos/tesoreria/config', { saldo_inicial: { fecha: '2098-12-31', banco: 850, caja: 120 } }, adm); assert.equal(r.status, 200);
r = await call('GET', '/api/modulos/tesoreria', null, adm); assert.equal(r.status, 200); assert.equal(r.data.saldo_inicial.banco_centimos, 85000); assert.equal(r.data.saldo_inicial.caja_centimos, 12000);
r = await call('POST', '/api/modulos/tesoreria/gastos-fijos', { concepto: 'Alquiler de prueba', categoria: 'Local', importe: 25, periodicidad: 'mensual', dia: 1, cuenta: 'Caja fuerte', variable: true, mes: 1 }, adm); assert.equal(r.status, 200); const gastoFijoId = r.data.id;
let tareaProgramada;
await worker.scheduled({ scheduledTime: Date.UTC(2099, 0, 1, 1, 0, 0) }, env, { waitUntil: p => { tareaProgramada=p; } });
await tareaProgramada;
r = await call('GET', '/api/modulos/cuenta', null, adm); assert.equal(r.status, 200); assert.ok(r.data.cuotas.some(x => x.periodo === '2099-01' && x.importe_centimos === 3500));
r = await call('GET', '/api/modulos/tesoreria', null, adm); assert.equal(r.status, 200); assert.equal(r.data.movimientos.filter(x => x.concepto === 'Alquiler de prueba').length, 0);
const periodoFijo = new Date().toISOString().slice(0,7);
r = await call('POST', '/api/modulos/tesoreria/gastos-fijos/'+gastoFijoId+'/registrar', { periodo: periodoFijo, importe: 27.5 }, adm); assert.equal(r.status, 200);
r = await call('POST', '/api/modulos/tesoreria/gastos-fijos/'+gastoFijoId+'/registrar', { periodo: periodoFijo, importe: 27.5 }, adm); assert.equal(r.status, 409);
r = await call('GET', '/api/modulos/tesoreria', null, adm); assert.equal(r.status, 200); const gastoRegistrado = r.data.movimientos.find(x => x.concepto === 'Alquiler de prueba'); assert.ok(gastoRegistrado); assert.equal(gastoRegistrado.importe_centimos, 2750); assert.equal(gastoRegistrado.cuenta, 'Caja fuerte');

r = await call('POST', '/api/modulos/sabados', { fecha: '2099-01-03', titulo: 'Sábado de prueba' }, adm); assert.equal(r.status, 200); const sid = r.data.id;
r = await call('POST', `/api/modulos/sabados/${sid}/asistencia`, { asiste: true, acompanantes: 1, personas: [{ tipo: 'hermana', numero: 0, alergias: 'Sin gluten (celiaquía)' }, { tipo: 'invitada', numero: 1, alergias: 'Sin lactosa' }] }, adm); assert.equal(r.status, 200);
let alergiasEvento = await env.DB.prepare('SELECT persona_tipo,persona_numero,alergias FROM lts_alergias_evento WHERE sabado_id=? AND hermana_id=? ORDER BY persona_tipo').bind(sid,aid).all();
assert.equal(alergiasEvento.results.length, 2); assert.ok(alergiasEvento.results.some(x => x.persona_tipo === 'invitada' && x.alergias === 'Sin lactosa'));
await env.DB.prepare('INSERT INTO asistencias_sabado(sabado_id,hermana_id,asiste,acompanantes) VALUES(?,?,0,2)').bind(sid,hermanaInvitadasId).run();
r = await call('GET', '/api/modulos/sabados', null, adm); assert.equal(r.status, 200); assert.equal(r.data.find(x => x.id === sid).mis_alergias_personas.length, 2);
r = await call('POST', '/api/modulos/cocina/sorteo', { personas_por_turno: 2 }, adm); assert.equal(r.status, 200); assert.equal(r.data.turnos_sorteados, 1); assert.equal(r.data.asignaciones[0].hermana_ids.length, 2);
r = await call('GET', '/api/modulos/cocina', null, adm); assert.equal(r.status, 200); assert.equal(r.data.alergias.length, 2); assert.ok(r.data.alergias.some(x => x.nombre.startsWith('Invitada 1 de ')));
const turnoPrueba = r.data.turnos.find(t => t.fecha === '2099-01-03'); assert.ok(turnoPrueba); assert.equal(turnoPrueba.confirmadas, 1); assert.equal(turnoPrueba.invitadas, 3); assert.equal(turnoPrueba.presupuesto_calculado_centimos, 5000);
const hermanasActivas = r.data.hermanas;
const compañeraTurno = hermanasActivas.find(h => h.id !== aid);
const sustituta = hermanasActivas.find(h => h.id !== aid && h.id !== compañeraTurno?.id);
assert.ok(compañeraTurno && sustituta);
await env.DB.prepare('DELETE FROM turnos_cocina_hermanas WHERE turno_id=?').bind(turnoPrueba.id).run();
await env.DB.prepare('INSERT INTO turnos_cocina_hermanas(turno_id,hermana_id) VALUES(?,?)').bind(turnoPrueba.id,aid).run();
await env.DB.prepare('INSERT INTO turnos_cocina_hermanas(turno_id,hermana_id) VALUES(?,?)').bind(turnoPrueba.id,compañeraTurno.id).run();
r = await call('POST', '/api/modulos/cocina/'+turnoPrueba.id+'/cambio', { hermana_id: sustituta.id }, adm); assert.equal(r.status, 200);
r = await call('GET', '/api/modulos/cocina', null, adm); assert.equal(r.status, 200);
assert.ok(r.data.asignaciones.some(a => a.turno_id===turnoPrueba.id && a.hermana_id===sustituta.id));
assert.ok(!r.data.asignaciones.some(a => a.turno_id===turnoPrueba.id && a.hermana_id===aid));
assert.ok(r.data.cambios.some(x => x.turno_id===turnoPrueba.id && x.hermana_sale_id===aid && x.hermana_entra_id===sustituta.id));
ok('cocina: cambio de turno entre hermanas con historial');
r = await call('POST', '/api/modulos/cocina/sorteo', { personas_por_turno: 3 }, adm); assert.equal(r.status, 409); // no debe reemplazar asignaciones existentes
r = await call('GET', '/api/modulos/cuenta', null, adm); assert.equal(r.status, 200);
const cargoSabado = r.data.cargos.find(x => String(x.source_key).startsWith('sabado:'+sid+':')); assert.ok(cargoSabado); assert.equal(cargoSabado.importe_centimos, 2000);
r = await call('GET', '/api/modulos/tesoreria', null, adm); assert.equal(r.status, 200); const cargoInvitadasSinAsistencia = r.data.cargos_pendientes.find(x => x.hermana_id === hermanaInvitadasId && String(x.source_key).startsWith('sabado:'+sid+':')); assert.ok(cargoInvitadasSinAsistencia); assert.equal(cargoInvitadasSinAsistencia.importe_centimos, 2000);
r = await call('POST', `/api/modulos/sabados/${sid}/asistencia`, { asiste: false, acompanantes: 0 }, adm); assert.equal(r.status, 200);
r = await call('GET', '/api/modulos/sabados', null, adm); assert.equal(r.status, 200);
r = await call('GET', '/api/modulos/cuenta', null, adm); assert.equal(r.data.cargos.find(x => x.id === cargoSabado.id).restante_centimos, 0);
r = await call('POST', `/api/modulos/sabados/${sid}/asistencia`, { asiste: true, acompanantes: 1, alergias: 'Sin gluten (celiaquía)' }, adm); assert.equal(r.status, 200);
r = await call('GET', '/api/modulos/sabados', null, adm); assert.equal(r.status, 200);
r = await call('GET', '/api/modulos/cuenta', null, adm); assert.equal(r.data.cargos.find(x => x.id === cargoSabado.id).restante_centimos, 2000);
const extraCuaresma = r.data.cargos.find(x => x.concepto === 'Aportación de Cuaresma'); assert.ok(extraCuaresma); assert.equal(extraCuaresma.importe_centimos, 625);
r = await call('POST', '/api/modulos/cuenta/pagos', { categoria: 'Sábados e invitadas', importe: 5, fecha_pago: '2099-01-04', metodo: 'Bizum' }, adm); assert.equal(r.status, 200); const pagoId = r.data.id;
r = await call('GET', '/api/modulos/cuenta', null, adm); assert.equal(r.data.cargos.find(x => x.id === cargoSabado.id).restante_centimos, 2000);
r = await call('POST', '/api/modulos/tesoreria/pagos/'+pagoId+'/confirmar', {}, adm); assert.equal(r.status, 200);
r = await call('GET', '/api/modulos/cuenta', null, adm); assert.equal(r.data.cargos.find(x => x.id === cargoSabado.id).restante_centimos, 1500);
r = await call('POST', '/api/modulos/cuenta/pagos', { categoria: 'Cuotas extraordinarias', importe: 2, fecha_pago: '2099-01-05', metodo: 'Bizum' }, adm); assert.equal(r.status, 200); const pagoExtraId = r.data.id;
r = await call('POST', '/api/modulos/tesoreria/pagos/'+pagoExtraId+'/confirmar', {}, adm); assert.equal(r.status, 200);
r = await call('GET', '/api/modulos/cuenta', null, adm); assert.equal(r.data.cargos.find(x => x.id === extraCuaresma.id).restante_centimos, 425);
const fechaConsumo = new Date(Date.now()-86400000).toISOString().slice(0,10);
r = await call('POST', '/api/modulos/sabados', { fecha: fechaConsumo, titulo: 'Sábado de consumos', categoria: 'Cuaresma' }, adm); assert.equal(r.status, 200); const sidConsumo = r.data.id;
r = await call('POST', `/api/modulos/sabados/${sidConsumo}/asistencia`, { asiste: true, acompanantes: 0 }, adm); assert.equal(r.status, 200);
r = await call('POST', `/api/modulos/sabados/${sidConsumo}/consumos`, { copas: 2, refrescos: 1 }, adm); assert.equal(r.status, 200);
r = await call('GET', '/api/modulos/cuenta', null, adm); const cargoConsumo = r.data.cargos.find(x => String(x.source_key).startsWith('consumo:'+sidConsumo+':')); assert.ok(cargoConsumo); assert.equal(cargoConsumo.importe_centimos, 500);
r = await call('POST', '/api/modulos/cuenta/pagos', { categoria: 'Copas y refrescos', importe: 2.5, fecha_pago: fechaConsumo, metodo: 'Bizum' }, adm); assert.equal(r.status, 200); const pagoConsumoId = r.data.id;
r = await call('POST', '/api/modulos/tesoreria/pagos/'+pagoConsumoId+'/confirmar', {}, adm); assert.equal(r.status, 200);
r = await call('GET', '/api/modulos/cuenta', null, adm); assert.equal(r.data.cargos.find(x => x.id === cargoConsumo.id).restante_centimos, 250);
r = await call('GET', '/api/modulos/tesoreria', null, adm); assert.equal(r.status, 200); assert.equal(r.data.parametros.cocina_precio_persona_centimos, 1250); assert.ok(Array.isArray(r.data.estadisticas.mensuales)); assert.ok(Array.isArray(r.data.hermanas)); assert.ok(r.data.cargos_pendientes.some(x => x.id === cargoSabado.id));
ok('tesorería: cuotas extraordinarias, cargos automáticos, pagos confirmados sin duplicidad, sorteo protegido y presupuesto automático');
console.log('\nTODO CORRECTO');
