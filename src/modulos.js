// API de los módulos de la Zona hermana. Las comprobaciones de permisos
// se realizan aquí en servidor; ocultar enlaces en el navegador no es suficiente.
const J = (d, status = 200, extra = {}) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra } });
const E = (msg, status = 400) => J({ error: msg }, status);
const tes = me => !!(me && (me.admin || me.tes));
const actas = me => !!(me && (me.admin || me.actas));
const txt = (v, max = 500) => String(v ?? '').trim().slice(0, max);
const num = v => Number.isFinite(Number(v)) ? Math.round(Number(v)) : NaN;
const isoDate = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const money = v => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : NaN;
};
const rows = async q => (await q.all()).results || [];

export async function generarCuotasMensuales(db, fecha = new Date()) {
  if (fecha.getUTCDate() !== 1) return { generadas: 0, configurada: true, omitida: 'No es día 1' };
  const cfg = await db.prepare("SELECT valor FROM config WHERE clave='cuota_mensual_centimos'").first();
  const importe = Number(cfg?.valor || 0);
  if (!Number.isInteger(importe) || importe <= 0) return { generadas: 0, configurada: false };
  const periodo = `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`;
  const r = await db.prepare(`INSERT OR IGNORE INTO cuotas(hermana_id,periodo,importe_centimos)
    SELECT id,?,? FROM hermanas WHERE estado='Activa'`).bind(periodo, importe).run();
  return { generadas: r.meta?.changes || 0, configurada: true, periodo };
}

export async function generarGastosFijos(db, fecha = new Date()) {
  const anio = fecha.getUTCFullYear(), mes = fecha.getUTCMonth() + 1, dia = fecha.getUTCDate();
  const gastos = await rows(db.prepare('SELECT * FROM gastos_fijos WHERE activo=1'));
  let generados = 0;
  for (const g of gastos) {
    let periodo = null, vence = false;
    if (g.periodicidad === 'mensual') { periodo = `${anio}-${String(mes).padStart(2, '0')}`; vence = dia >= g.dia; }
    else if (g.periodicidad === 'trimestral' && [1,4,7,10].includes(mes)) { periodo = `${anio}-T${Math.ceil(mes / 3)}`; vence = dia >= g.dia; }
    else if (g.periodicidad === 'anual' && mes === 1) { periodo = String(anio); vence = dia >= g.dia; }
    if (!periodo || !vence || g.ultimo_periodo === periodo) continue;
    const fechaCargo = `${anio}-${String(mes).padStart(2, '0')}-${String(g.dia).padStart(2, '0')}`;
    await db.batch([
      db.prepare(`INSERT INTO movimientos(tipo,fecha,concepto,categoria,importe_centimos,creado_por) VALUES('gasto',?,?,?,?,?)`)
        .bind(fechaCargo, g.concepto, g.categoria || 'Gastos fijos', g.importe_centimos, g.creado_por),
      db.prepare('UPDATE gastos_fijos SET ultimo_periodo=? WHERE id=?').bind(periodo, g.id),
    ]);
    generados++;
  }
  return { generados };
}

export async function routeModulos(req, env, me, method, path, body) {
  let m;

  // SÁBADOS Y ASISTENCIA
  if (path === '/api/modulos/sabados' && method === 'GET') {
    const data = await rows(env.DB.prepare(`SELECT s.*,a.asiste mi_asistencia,a.acompanantes mis_acompanantes,a.detalle_acompanantes,a.alergias mis_alergias,a.observaciones mi_observaciones,
      COALESCE(c.copas,0) mis_copas,COALESCE(c.refrescos,0) mis_refrescos,
      (SELECT COUNT(*) FROM asistencias_sabado x WHERE x.sabado_id=s.id AND x.asiste=1) confirmadas
      FROM sabados s LEFT JOIN asistencias_sabado a ON a.sabado_id=s.id AND a.hermana_id=?
      LEFT JOIN consumos_sabado c ON c.sabado_id=s.id AND c.hermana_id=? ORDER BY s.fecha DESC,s.id DESC LIMIT 40`).bind(me.id,me.id));
    return J(data);
  }
  if (path === '/api/modulos/sabados' && method === 'POST') {
    if (!me.admin && !me.tes) return E('No tienes permiso para crear sábados', 403);
    const fecha = txt(body.fecha, 10), titulo = txt(body.titulo, 120);
    if (!isoDate(fecha) || titulo.length < 2) return E('Indica una fecha y un título');
    const r = await env.DB.prepare('INSERT INTO sabados(fecha,hora,titulo,descripcion,creado_por) VALUES(?,?,?,?,?)')
      .bind(fecha, txt(body.hora, 10) || null, titulo, txt(body.descripcion, 2000) || null, me.id).run();
    return J({ ok: true, id: r.meta.last_row_id });
  }
  if ((m = path.match(/^\/api\/modulos\/sabados\/(\d+)$/)) && (method === 'PUT' || method === 'DELETE')) {
    if (!me.admin && !me.tes) return E('No tienes permiso para modificar sábados', 403);
    const id = +m[1];
    if (method === 'DELETE') { await env.DB.prepare('DELETE FROM sabados WHERE id=?').bind(id).run(); return J({ ok: true }); }
    const s = await env.DB.prepare('SELECT * FROM sabados WHERE id=?').bind(id).first();
    if (!s) return E('Sábado no encontrado', 404);
    const fecha = body.fecha !== undefined ? txt(body.fecha, 10) : s.fecha;
    if (!isoDate(fecha)) return E('La fecha no es válida');
    await env.DB.prepare('UPDATE sabados SET fecha=?,hora=?,titulo=?,descripcion=?,estado=? WHERE id=?')
      .bind(fecha, txt(body.hora ?? s.hora, 10) || null, txt(body.titulo ?? s.titulo, 120), txt(body.descripcion ?? s.descripcion, 2000) || null,
        ['abierto','cerrado','cancelado'].includes(body.estado) ? body.estado : s.estado, id).run();
    return J({ ok: true });
  }
  if ((m = path.match(/^\/api\/modulos\/sabados\/(\d+)\/asistencia$/)) && method === 'POST') {
    const id = +m[1], s = await env.DB.prepare('SELECT id,estado FROM sabados WHERE id=?').bind(id).first();
    if (!s) return E('Sábado no encontrado', 404);
    if (s.estado !== 'abierto') return E('Este sábado ya no admite cambios', 409);
    const asiste = body.asiste ? 1 : 0, acomp = Math.max(0, Math.min(20, num(body.acompanantes || 0)));
    if (!Number.isInteger(acomp)) return E('Número de acompañantes no válido');
    await env.DB.prepare(`INSERT INTO asistencias_sabado(sabado_id,hermana_id,asiste,acompanantes,detalle_acompanantes,alergias,observaciones,actualizado)
      VALUES(?,?,?,?,?,?,?,datetime('now')) ON CONFLICT(sabado_id,hermana_id) DO UPDATE SET asiste=excluded.asiste,acompanantes=excluded.acompanantes,
      detalle_acompanantes=excluded.detalle_acompanantes,alergias=excluded.alergias,observaciones=excluded.observaciones,actualizado=datetime('now')`)
      .bind(id, me.id, asiste, acomp, txt(body.detalle_acompanantes, 1000) || null, txt(body.alergias, 1000) || null, txt(body.observaciones, 1000) || null).run();
    return J({ ok: true });
  }
  if ((m = path.match(/^\/api\/modulos\/sabados\/(\d+)\/asistencias$/)) && method === 'GET') {
    if (!tes(me)) return E('Solo tesorería o administración puede consultar el listado', 403);
    return J(await rows(env.DB.prepare(`SELECT a.*,h.nombre,h.telefono,COALESCE(c.copas,0) copas,COALESCE(c.refrescos,0) refrescos FROM asistencias_sabado a JOIN hermanas h ON h.id=a.hermana_id LEFT JOIN consumos_sabado c ON c.sabado_id=a.sabado_id AND c.hermana_id=a.hermana_id WHERE a.sabado_id=? ORDER BY h.nombre`).bind(+m[1])));
  }
  if ((m = path.match(/^\/api\/modulos\/sabados\/(\d+)\/consumos$/)) && method === 'POST') {
    const id = +m[1];
    const s = await env.DB.prepare('SELECT fecha FROM sabados WHERE id=?').bind(id).first();
    if (!s) return E('Sábado no encontrado', 404);
    if (s.fecha >= new Date().toISOString().slice(0, 10)) return E('Las consumiciones se pueden apuntar cuando el sábado ya se ha celebrado', 409);
    const asistencia = await env.DB.prepare('SELECT asiste FROM asistencias_sabado WHERE sabado_id=? AND hermana_id=?').bind(id, me.id).first();
    if (!asistencia || !asistencia.asiste) return E('Solo puedes apuntar consumiciones si confirmaste tu asistencia', 403);
    const copas = num(body.copas), refrescos = num(body.refrescos);
    if (!Number.isInteger(copas) || copas < 0 || copas > 50 || !Number.isInteger(refrescos) || refrescos < 0 || refrescos > 50) return E('Indica cantidades válidas (entre 0 y 50)');
    await env.DB.prepare(`INSERT INTO consumos_sabado(sabado_id,hermana_id,copas,refrescos,actualizado) VALUES(?,?,?,?,datetime('now'))
      ON CONFLICT(sabado_id,hermana_id) DO UPDATE SET copas=excluded.copas,refrescos=excluded.refrescos,actualizado=datetime('now')`)
      .bind(id,me.id,copas,refrescos).run();
    return J({ ok: true });
  }


  // MI CUENTA: cada hermana solo puede consultar y registrar sus propios pagos.
  if (path === '/api/modulos/cuenta' && method === 'GET') {
    const cuotas = await rows(env.DB.prepare(`SELECT c.*,(SELECT COALESCE(SUM(p.importe_centimos),0) FROM pagos p WHERE p.cuota_id=c.id AND p.estado='confirmado') pagado_centimos,MAX(0,c.importe_centimos-(SELECT COALESCE(SUM(p.importe_centimos),0) FROM pagos p WHERE p.cuota_id=c.id AND p.estado='confirmado')) restante_centimos FROM cuotas c WHERE c.hermana_id=? ORDER BY c.periodo DESC`).bind(me.id));
    const pagos = await rows(env.DB.prepare('SELECT p.*,c.periodo FROM pagos p LEFT JOIN cuotas c ON c.id=p.cuota_id WHERE p.hermana_id=? ORDER BY p.fecha_pago DESC,p.id DESC').bind(me.id));
    const alergias = await env.DB.prepare('SELECT alergias,observaciones FROM alergias_hermanas WHERE hermana_id=?').bind(me.id).first();
    return J({ cuotas, pagos, alergias: alergias || { alergias: '', observaciones: '' } });
  }
  if (path === '/api/modulos/cuenta/pagos' && method === 'POST') {
    const importe = money(body.importe);
    if (!Number.isInteger(importe)) return E('Indica un importe válido');
    const cuotaId = body.cuota_id ? num(body.cuota_id) : null;
    if (cuotaId) {
      const c = await env.DB.prepare('SELECT id,estado FROM cuotas WHERE id=? AND hermana_id=?').bind(cuotaId, me.id).first();
      if (!c) return E('La cuota seleccionada no pertenece a tu cuenta', 403);
      if (c.estado === 'pagada') return E('Esa cuota ya figura como pagada', 409);
    }
    const fecha = isoDate(body.fecha_pago) ? body.fecha_pago : new Date().toISOString().slice(0, 10);
    const r = await env.DB.prepare(`INSERT INTO pagos(hermana_id,cuota_id,importe_centimos,fecha_pago,metodo,concepto,registrado_por)
      VALUES(?,?,?,?,?,?,?)`).bind(me.id, cuotaId, importe, fecha, txt(body.metodo, 50) || null, txt(body.concepto, 300) || null, me.id).run();
    return J({ ok: true, id: r.meta.last_row_id, estado: 'pendiente' });
  }

  // COCINA: lectura para hermanas; edición solo para tesorería/administración.
  if (path === '/api/modulos/cocina' && method === 'GET') {
    const [turnos, alergias, tickets] = await Promise.all([
      rows(env.DB.prepare(`SELECT tc.*,
        (SELECT COUNT(*) FROM asistencias_sabado a JOIN sabados s ON s.id=a.sabado_id WHERE s.fecha=tc.fecha AND s.estado!='cancelado' AND a.asiste=1) confirmadas,
        (SELECT COALESCE(SUM(a.acompanantes),0) FROM asistencias_sabado a JOIN sabados s ON s.id=a.sabado_id WHERE s.fecha=tc.fecha AND s.estado!='cancelado' AND a.asiste=1) invitadas,
        COALESCE((SELECT CAST(valor AS INTEGER) FROM config WHERE clave='cocina_precio_persona_centimos'),0) precio_persona_centimos,
        (COALESCE((SELECT CAST(valor AS INTEGER) FROM config WHERE clave='cocina_precio_persona_centimos'),0) *
          ((SELECT COUNT(*) FROM asistencias_sabado a JOIN sabados s ON s.id=a.sabado_id WHERE s.fecha=tc.fecha AND s.estado!='cancelado' AND a.asiste=1) +
           (SELECT COALESCE(SUM(a.acompanantes),0) FROM asistencias_sabado a JOIN sabados s ON s.id=a.sabado_id WHERE s.fecha=tc.fecha AND s.estado!='cancelado' AND a.asiste=1))) presupuesto_calculado_centimos
        FROM turnos_cocina tc ORDER BY tc.fecha DESC,tc.id DESC LIMIT 100`)),
      tes(me)
      ? await rows(env.DB.prepare("SELECT a.*,h.nombre FROM alergias_hermanas a JOIN hermanas h ON h.id=a.hermana_id WHERE h.estado!='Baja' ORDER BY h.nombre"))
      : await rows(env.DB.prepare("SELECT a.*,h.nombre FROM alergias_hermanas a JOIN hermanas h ON h.id=a.hermana_id WHERE h.id=?").bind(me.id)),
      tes(me)
        ? rows(env.DB.prepare(`SELECT t.id,t.nombre_archivo,t.mime,t.tamano,t.creado,t.sabado_id,t.turno_cocina_id,h.nombre subido_por_nombre FROM tickets t LEFT JOIN hermanas h ON h.id=t.subido_por ORDER BY t.creado DESC LIMIT 100`))
        : rows(env.DB.prepare('SELECT id,nombre_archivo,mime,tamano,creado,sabado_id,turno_cocina_id FROM tickets WHERE subido_por=? ORDER BY creado DESC LIMIT 50').bind(me.id)),
    ]);
    const hermanas = tes(me) ? await rows(env.DB.prepare("SELECT id,nombre FROM hermanas WHERE estado='Activa' ORDER BY nombre")) : [];
    const asignaciones = await rows(env.DB.prepare(`SELECT tc.turno_id,tc.hermana_id,h.nombre FROM turnos_cocina_hermanas tc JOIN hermanas h ON h.id=tc.hermana_id ORDER BY h.nombre`));
    const cfg = await env.DB.prepare("SELECT valor FROM config WHERE clave='cocina_personas_por_turno'").first();
    return J({ turnos, alergias, tickets, hermanas, asignaciones, personas_por_turno: cfg?.valor ? Number(cfg.valor) : 2 });
  }
  if (path === '/api/modulos/cocina/sorteo' && method === 'POST') {
    if (!tes(me)) return E('No tienes permiso para realizar el sorteo', 403);
    const personas = num(body.personas_por_turno);
    if (![2, 3].includes(personas)) return E('El sorteo debe asignar 2 o 3 personas por turno');
    const hermanas = await rows(env.DB.prepare("SELECT id FROM hermanas WHERE estado='Activa' ORDER BY id"));
    if (hermanas.length < personas) return E('No hay suficientes hermanas activas para realizar el sorteo');
    const sabados = await rows(env.DB.prepare("SELECT id,fecha,titulo FROM sabados WHERE estado!='cancelado' AND fecha>=date('now') ORDER BY fecha,id"));
    if (!sabados.length) return E('No hay sábados futuros publicados para sortear');
    const carga = Object.fromEntries(hermanas.map(h => [h.id, 0]));
    const asignaciones = [];
    for (const sabado of sabados) {
      const orden = [...hermanas].sort((a,b) => carga[a.id]-carga[b.id] || Math.random()-0.5);
      const elegidas = orden.slice(0, personas);
      elegidas.forEach(h => carga[h.id]++);
      let turno = await env.DB.prepare('SELECT id FROM turnos_cocina WHERE fecha=? ORDER BY id LIMIT 1').bind(sabado.fecha).first();
      if (!turno) {
        const creado = await env.DB.prepare("INSERT INTO turnos_cocina(fecha,turno,responsable,creado_por) VALUES(?,'Cocina','Turno sorteado',?)").bind(sabado.fecha,me.id).run();
        turno = { id: creado.meta.last_row_id };
      }
      asignaciones.push({ turno_id: turno.id, hermana_ids: elegidas.map(h => h.id) });
    }
    const ops = [];
    for (const a of asignaciones) {
      ops.push(env.DB.prepare('DELETE FROM turnos_cocina_hermanas WHERE turno_id=?').bind(a.turno_id));
      for (const id of a.hermana_ids) ops.push(env.DB.prepare('INSERT INTO turnos_cocina_hermanas(turno_id,hermana_id) VALUES(?,?)').bind(a.turno_id,id));
    }
    ops.push(env.DB.prepare("INSERT OR REPLACE INTO config(clave,valor) VALUES('cocina_personas_por_turno',?)").bind(String(personas)));
    await env.DB.batch(ops);
    return J({ ok: true, personas_por_turno: personas, turnos_sorteados: asignaciones.length, asignaciones: asignaciones.map(a => ({ turno_id:a.turno_id, hermanas:a.hermana_ids })) });
  }
  if (path === '/api/modulos/cocina/tickets' && method === 'POST') {
    const mdata = /^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/.exec(String(body.datos || ''));
    if (!mdata || mdata[2].length > 1400000) return E('El ticket debe ser JPG, PNG, WEBP o PDF y no superar 1 MB');
    const sabadoId = body.sabado_id ? num(body.sabado_id) : null;
    if (sabadoId && !await env.DB.prepare('SELECT id FROM sabados WHERE id=?').bind(sabadoId).first()) return E('El sábado asociado no existe');
    const turnoId = body.turno_cocina_id ? num(body.turno_cocina_id) : null;
    if (turnoId && !await env.DB.prepare('SELECT id FROM turnos_cocina WHERE id=?').bind(turnoId).first()) return E('El turno de cocina asociado no existe');
    const r = await env.DB.prepare('INSERT INTO tickets(sabado_id,turno_cocina_id,nombre_archivo,mime,datos,tamano,subido_por) VALUES(?,?,?,?,?,?,?)')
      .bind(sabadoId, turnoId, txt(body.nombre_archivo, 120) || 'ticket', mdata[1], mdata[2], Math.floor(mdata[2].length * 3 / 4), me.id).run();
    return J({ ok: true, id: r.meta.last_row_id });
  }
  if ((m = path.match(/^\/api\/modulos\/cocina\/tickets\/(\d+)$/)) && method === 'GET') {
    const t = await env.DB.prepare('SELECT nombre_archivo,mime,datos,subido_por FROM tickets WHERE id=?').bind(+m[1]).first();
    if (!t || (t.subido_por !== me.id && !tes(me))) return E('Ticket no encontrado', 404);
    const bytes = Uint8Array.from(atob(t.datos), c => c.charCodeAt(0));
    const nombre = txt(t.nombre_archivo, 120).replace(/[\r\n"\\]/g, '_');
    return new Response(bytes, { headers: { 'Content-Type': t.mime, 'Content-Disposition': `inline; filename="${nombre}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  }
  if (path === '/api/modulos/cocina' && method === 'POST') {
    if (!tes(me)) return E('No tienes permiso para organizar cocina', 403);
    const fecha = txt(body.fecha, 10);
    if (!isoDate(fecha)) return E('Indica una fecha válida');
    const presupuesto = body.presupuesto ? money(body.presupuesto) : null;
    const r = await env.DB.prepare('INSERT INTO turnos_cocina(fecha,turno,menu,responsable,presupuesto_centimos,observaciones,creado_por) VALUES(?,?,?,?,?,?,?)')
      .bind(fecha, txt(body.turno, 80) || null, txt(body.menu, 1500) || null, txt(body.responsable, 120) || null,
        Number.isInteger(presupuesto) ? presupuesto : null, txt(body.observaciones, 1000) || null, me.id).run();
    return J({ ok: true, id: r.meta.last_row_id });
  }
  if ((m = path.match(/^\/api\/modulos\/cocina\/(\d+)\/asignacion$/)) && method === 'PUT') {
    if (!tes(me)) return E('No tienes permiso para asignar turnos', 403);
    const id = +m[1];
    if (!await env.DB.prepare('SELECT id FROM turnos_cocina WHERE id=?').bind(id).first()) return E('Turno no encontrado', 404);
    const ids = Array.isArray(body.hermanas) ? [...new Set(body.hermanas.map(num))] : [];
    if (ids.some(x => !Number.isInteger(x) || x <= 0)) return E('La selección de hermanas no es válida');
    if (ids.length) {
      const validas = await rows(env.DB.prepare(`SELECT id FROM hermanas WHERE estado='Activa' AND id IN (${ids.map(() => '?').join(',')})`).bind(...ids));
      if (validas.length !== ids.length) return E('Solo puedes asignar hermanas activas');
    }
    const ops = [env.DB.prepare('DELETE FROM turnos_cocina_hermanas WHERE turno_id=?').bind(id), ...ids.map(hid => env.DB.prepare('INSERT INTO turnos_cocina_hermanas(turno_id,hermana_id) VALUES(?,?)').bind(id,hid))];
    await env.DB.batch(ops);
    return J({ ok: true, asignadas: ids.length });
  }
  if ((m = path.match(/^\/api\/modulos\/cocina\/(\d+)$/)) && (method === 'PUT' || method === 'DELETE')) {
    if (!tes(me)) return E('No tienes permiso para modificar cocina', 403);
    const id = +m[1];
    if (method === 'DELETE') { await env.DB.prepare('DELETE FROM turnos_cocina WHERE id=?').bind(id).run(); return J({ ok: true }); }
    const cur = await env.DB.prepare('SELECT * FROM turnos_cocina WHERE id=?').bind(id).first();
    if (!cur) return E('Turno no encontrado', 404);
    const fecha = body.fecha !== undefined ? txt(body.fecha, 10) : cur.fecha;
    if (!isoDate(fecha)) return E('La fecha no es válida');
    const presupuesto = body.presupuesto !== undefined ? (body.presupuesto ? money(body.presupuesto) : null) : cur.presupuesto_centimos;
    await env.DB.prepare('UPDATE turnos_cocina SET fecha=?,turno=?,menu=?,responsable=?,presupuesto_centimos=?,observaciones=? WHERE id=?')
      .bind(fecha, txt(body.turno ?? cur.turno, 80) || null, txt(body.menu ?? cur.menu, 1500) || null, txt(body.responsable ?? cur.responsable, 120) || null,
        Number.isInteger(presupuesto) ? presupuesto : null, txt(body.observaciones ?? cur.observaciones, 1000) || null, id).run();
    return J({ ok: true });
  }
  if (path === '/api/modulos/alergias' && method === 'PUT') {
    await env.DB.prepare(`INSERT INTO alergias_hermanas(hermana_id,alergias,observaciones,actualizado) VALUES(?,?,?,datetime('now'))
      ON CONFLICT(hermana_id) DO UPDATE SET alergias=excluded.alergias,observaciones=excluded.observaciones,actualizado=datetime('now')`)
      .bind(me.id, txt(body.alergias, 1000), txt(body.observaciones, 1000) || null).run();
    return J({ ok: true });
  }

  // TESORERÍA: todo el módulo queda protegido por permiso real del servidor.
  if (path.startsWith('/api/modulos/tesoreria')) {
    if (!tes(me)) return E('No tienes permiso para acceder a tesorería', 403);
    if (path === '/api/modulos/tesoreria' && method === 'GET') {
      const [movimientos, pagos, gastosFijos, cuotas, tickets, pendientes, informes, totales, cfg] = await Promise.all([
        rows(env.DB.prepare(`SELECT m.*,h.nombre hermana,(SELECT GROUP_CONCAT(t.id) FROM tickets t WHERE t.movimiento_id=m.id) tickets FROM movimientos m LEFT JOIN hermanas h ON h.id=m.hermana_id ORDER BY m.fecha DESC,m.id DESC LIMIT 250`)),
        rows(env.DB.prepare(`SELECT p.*,h.nombre hermana,c.periodo FROM pagos p JOIN hermanas h ON h.id=p.hermana_id LEFT JOIN cuotas c ON c.id=p.cuota_id WHERE p.estado='pendiente' ORDER BY p.fecha_pago,p.id`)),
        rows(env.DB.prepare('SELECT * FROM gastos_fijos ORDER BY activo DESC,id')),
        rows(env.DB.prepare(`SELECT c.periodo,c.estado,COUNT(*) cantidad,SUM(c.importe_centimos) total FROM cuotas c GROUP BY c.periodo,c.estado ORDER BY c.periodo DESC LIMIT 24`)),
        rows(env.DB.prepare(`SELECT t.id,t.nombre_archivo,t.mime,t.tamano,t.creado,t.movimiento_id,t.sabado_id,t.turno_cocina_id,m.concepto,tc.turno turno_cocina,tc.fecha fecha_turno FROM tickets t LEFT JOIN movimientos m ON m.id=t.movimiento_id LEFT JOIN turnos_cocina tc ON tc.id=t.turno_cocina_id ORDER BY t.creado DESC LIMIT 200`)),
        rows(env.DB.prepare(`SELECT c.id,c.periodo,c.importe_centimos,c.estado,h.nombre,MAX(0,c.importe_centimos-(SELECT COALESCE(SUM(p.importe_centimos),0) FROM pagos p WHERE p.cuota_id=c.id AND p.estado='confirmado')) restante_centimos FROM cuotas c JOIN hermanas h ON h.id=c.hermana_id WHERE c.estado!='pagada' ORDER BY c.periodo DESC,h.nombre`)),
        rows(env.DB.prepare(`SELECT strftime('%Y',fecha) anio,SUM(CASE WHEN tipo='ingreso' THEN importe_centimos ELSE 0 END) ingresos,SUM(CASE WHEN tipo='gasto' THEN importe_centimos ELSE 0 END) gastos FROM movimientos GROUP BY strftime('%Y',fecha) ORDER BY anio DESC`)),
        env.DB.prepare(`SELECT COALESCE(SUM(CASE WHEN tipo='ingreso' THEN importe_centimos ELSE 0 END),0) ingresos,COALESCE(SUM(CASE WHEN tipo='gasto' THEN importe_centimos ELSE 0 END),0) gastos FROM movimientos`).first(),
        env.DB.prepare("SELECT valor FROM config WHERE clave='cuota_mensual_centimos'").first(),
      ]);
      const parametrosRows = await rows(env.DB.prepare("SELECT clave,valor FROM config WHERE clave IN ('cocina_precio_persona_centimos','sabado_precio_centimos','invitada_precio_centimos','copa_precio_centimos','refresco_precio_centimos','cocina_personas_por_turno')"));
      const parametros = Object.fromEntries(parametrosRows.map(x => [x.clave, Number(x.valor)]));
      const [estadisticasMensuales, estadisticasCategorias] = await Promise.all([
        rows(env.DB.prepare(`SELECT strftime('%Y-%m',fecha) periodo,
          SUM(CASE WHEN tipo='ingreso' THEN importe_centimos ELSE 0 END) ingresos,
          SUM(CASE WHEN tipo='gasto' THEN importe_centimos ELSE 0 END) gastos
          FROM movimientos WHERE tipo IN ('ingreso','gasto') GROUP BY strftime('%Y-%m',fecha) ORDER BY periodo`)),
        rows(env.DB.prepare(`SELECT tipo,categoria,SUM(importe_centimos) total FROM movimientos
          WHERE tipo IN ('ingreso','gasto') GROUP BY tipo,categoria ORDER BY tipo,total DESC`))
      ]);
      return J({ movimientos, pagos_pendientes: pagos, gastos_fijos: gastosFijos, resumen_cuotas: cuotas, tickets, cuotas_pendientes: pendientes, informes, totales, cuota_mensual: cfg?.valor ? Number(cfg.valor) / 100 : null, parametros, estadisticas: { mensuales: estadisticasMensuales, categorias: estadisticasCategorias } });
    }
    if (path === '/api/modulos/tesoreria/config' && method === 'PUT') {
      const campos = {
        cuota_mensual: 'cuota_mensual_centimos',
        cocina_precio_persona: 'cocina_precio_persona_centimos',
        sabado_precio: 'sabado_precio_centimos',
        invitada_precio: 'invitada_precio_centimos',
        copa_precio: 'copa_precio_centimos',
        refresco_precio: 'refresco_precio_centimos'
      };
      const ops = [];
      for (const [campo, clave] of Object.entries(campos)) {
        if (body[campo] === undefined || body[campo] === '') {
          if (campo !== 'cuota_mensual') continue;
          return E('Indica una cuota mensual válida');
        }
        const importe = money(body[campo]);
        if (!Number.isInteger(importe) || importe < 0 || (campo === 'cuota_mensual' && importe === 0)) return E('Revisa los importes de configuración');
        ops.push(env.DB.prepare('INSERT OR REPLACE INTO config(clave,valor) VALUES(?,?)').bind(clave,String(importe)));
      }
      if (body.personas_por_turno !== undefined) {
        const personas = num(body.personas_por_turno);
        if (![2,3].includes(personas)) return E('El sorteo debe asignar 2 o 3 personas por turno');
        ops.push(env.DB.prepare("INSERT OR REPLACE INTO config(clave,valor) VALUES('cocina_personas_por_turno',?)").bind(String(personas)));
      }
      await env.DB.batch(ops);
      return J({ ok: true });
    }
    if (path === '/api/modulos/tesoreria/movimientos' && method === 'POST') {
      const tipo = body.tipo === 'ingreso' ? 'ingreso' : body.tipo === 'gasto' ? 'gasto' : null;
      const importe = money(body.importe), fecha = isoDate(body.fecha) ? body.fecha : null, concepto = txt(body.concepto, 180);
      if (!tipo || !Number.isInteger(importe) || !fecha || concepto.length < 2) return E('Revisa tipo, fecha, concepto e importe');
      const r = await env.DB.prepare('INSERT INTO movimientos(tipo,fecha,concepto,categoria,importe_centimos,creado_por) VALUES(?,?,?,?,?,?)')
        .bind(tipo, fecha, concepto, txt(body.categoria, 80) || null, importe, me.id).run();
      return J({ ok: true, id: r.meta.last_row_id });
    }
    if (path === '/api/modulos/tesoreria/gastos-fijos' && method === 'POST') {
      const importe = money(body.importe), concepto = txt(body.concepto, 180), periodicidad = ['mensual','trimestral','anual'].includes(body.periodicidad) ? body.periodicidad : 'mensual';
      if (!Number.isInteger(importe) || concepto.length < 2) return E('Indica concepto e importe');
      const dia = num(body.dia || 1);
      if (!Number.isInteger(dia) || dia < 1 || dia > 28) return E('El día debe estar entre 1 y 28');
      const r = await env.DB.prepare('INSERT INTO gastos_fijos(concepto,categoria,importe_centimos,periodicidad,dia,creado_por) VALUES(?,?,?,?,?,?)')
        .bind(concepto, txt(body.categoria, 80) || null, importe, periodicidad, dia, me.id).run();
      return J({ ok: true, id: r.meta.last_row_id });
    }
    if ((m = path.match(/^\/api\/modulos\/tesoreria\/gastos-fijos\/(\d+)$/)) && (method === 'PUT' || method === 'DELETE')) {
      const id = +m[1];
      if (method === 'DELETE') { await env.DB.prepare('DELETE FROM gastos_fijos WHERE id=?').bind(id).run(); return J({ ok: true }); }
      const cur = await env.DB.prepare('SELECT * FROM gastos_fijos WHERE id=?').bind(id).first();
      if (!cur) return E('Gasto fijo no encontrado', 404);
      const importe = body.importe !== undefined ? money(body.importe) : cur.importe_centimos;
      if (!Number.isInteger(importe)) return E('Importe no válido');
      const dia = num(body.dia ?? cur.dia);
      if (!Number.isInteger(dia) || dia < 1 || dia > 28) return E('El día debe estar entre 1 y 28');
      await env.DB.prepare('UPDATE gastos_fijos SET concepto=?,categoria=?,importe_centimos=?,periodicidad=?,dia=?,activo=? WHERE id=?')
        .bind(txt(body.concepto ?? cur.concepto, 180), txt(body.categoria ?? cur.categoria, 80) || null, importe,
          ['mensual','trimestral','anual'].includes(body.periodicidad) ? body.periodicidad : cur.periodicidad,
          dia, body.activo === undefined ? cur.activo : (body.activo ? 1 : 0), id).run();
      return J({ ok: true });
    }
    if ((m = path.match(/^\/api\/modulos\/tesoreria\/pagos\/(\d+)\/confirmar$/)) && method === 'POST') {
      const pagoId = +m[1], p = await env.DB.prepare('SELECT * FROM pagos WHERE id=?').bind(pagoId).first();
      if (!p) return E('Pago no encontrado', 404);
      if (p.estado !== 'pendiente') return E('Este pago ya está revisado', 409);
      const resultado = await env.DB.batch([
        env.DB.prepare("UPDATE pagos SET estado='confirmado',confirmado_por=? WHERE id=? AND estado='pendiente'").bind(me.id, pagoId),
        env.DB.prepare(`INSERT OR IGNORE INTO movimientos(tipo,fecha,concepto,categoria,importe_centimos,hermana_id,cuota_id,pago_id,creado_por)
          SELECT 'ingreso',fecha_pago,'Pago de cuota','Cuotas',importe_centimos,hermana_id,cuota_id,id,? FROM pagos WHERE id=? AND estado='confirmado'`).bind(me.id, pagoId),
      ]);
      if (!resultado[0]?.meta?.changes) return E('Este pago ya está revisado', 409);
      if (p.cuota_id) {
        const c = await env.DB.prepare('SELECT importe_centimos FROM cuotas WHERE id=?').bind(p.cuota_id).first();
        const total = await env.DB.prepare("SELECT COALESCE(SUM(importe_centimos),0) n FROM pagos WHERE cuota_id=? AND estado='confirmado'").bind(p.cuota_id).first();
        const estado = total.n >= c.importe_centimos ? 'pagada' : 'parcial';
        await env.DB.prepare('UPDATE cuotas SET estado=? WHERE id=?').bind(estado, p.cuota_id).run();
      }
      return J({ ok: true });
    }
    if ((m = path.match(/^\/api\/modulos\/tesoreria\/pagos\/(\d+)\/rechazar$/)) && method === 'POST') {
      const pagoId = +m[1];
      const resultado = await env.DB.prepare("UPDATE pagos SET estado='rechazado',confirmado_por=? WHERE id=? AND estado='pendiente'").bind(me.id, pagoId).run();
      if (!resultado.meta?.changes) {
        const existe = await env.DB.prepare('SELECT id,estado FROM pagos WHERE id=?').bind(pagoId).first();
        if (!existe) return E('Pago no encontrado', 404);
        return E('Este pago ya está revisado', 409);
      }
      return J({ ok: true });
    }
    if ((m = path.match(/^\/api\/modulos\/tesoreria\/tickets\/(\d+)$/)) && method === 'GET') {
      const t = await env.DB.prepare('SELECT nombre_archivo,mime,datos FROM tickets WHERE id=?').bind(+m[1]).first();
      if (!t) return E('Ticket no encontrado', 404);
      const bytes = Uint8Array.from(atob(t.datos), c => c.charCodeAt(0));
      const nombre = txt(t.nombre_archivo, 120).replace(/[\r\n"\\]/g, '_');
      return new Response(bytes, { headers: { 'Content-Type': t.mime, 'Content-Disposition': `inline; filename="${nombre}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
    }
    if ((m = path.match(/^\/api\/modulos\/tesoreria\/tickets\/(\d+)$/)) && method === 'PUT') {
      const id = +m[1], ticket = await env.DB.prepare('SELECT id FROM tickets WHERE id=?').bind(id).first();
      if (!ticket) return E('Ticket no encontrado', 404);
      const movimientoId = body.movimiento_id ? num(body.movimiento_id) : null;
      if (movimientoId && !await env.DB.prepare('SELECT id FROM movimientos WHERE id=?').bind(movimientoId).first()) return E('El movimiento asociado no existe');
      await env.DB.prepare('UPDATE tickets SET movimiento_id=? WHERE id=?').bind(movimientoId, id).run();
      return J({ ok: true });
    }
    if (path === '/api/modulos/tesoreria/tickets' && method === 'POST') {
      const mdata = /^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/.exec(String(body.datos || ''));
      if (!mdata || mdata[2].length > 1400000) return E('El ticket debe ser JPG, PNG, WEBP o PDF y no superar 1 MB');
      const nombre = txt(body.nombre_archivo, 120) || 'ticket';
      const movimientoId = body.movimiento_id ? num(body.movimiento_id) : null;
      if (movimientoId && !await env.DB.prepare('SELECT id FROM movimientos WHERE id=?').bind(movimientoId).first()) return E('El gasto asociado no existe');
      const sabadoId = body.sabado_id ? num(body.sabado_id) : null;
      if (sabadoId && !await env.DB.prepare('SELECT id FROM sabados WHERE id=?').bind(sabadoId).first()) return E('El sábado asociado no existe');
      const turnoId = body.turno_cocina_id ? num(body.turno_cocina_id) : null;
      if (turnoId && !await env.DB.prepare('SELECT id FROM turnos_cocina WHERE id=?').bind(turnoId).first()) return E('El turno de cocina asociado no existe');
      const r = await env.DB.prepare('INSERT INTO tickets(movimiento_id,sabado_id,turno_cocina_id,nombre_archivo,mime,datos,tamano,subido_por) VALUES(?,?,?,?,?,?,?,?)')
        .bind(movimientoId, sabadoId, turnoId, nombre, mdata[1], mdata[2], Math.floor(mdata[2].length * 3 / 4), me.id).run();
      return J({ ok: true, id: r.meta.last_row_id });
    }
    return E('Ruta de tesorería no encontrada', 404);
  }

  // ACTAS Y JUNTAS: permiso actas o administradora.
  if (path.startsWith('/api/modulos/actas')) {
    if (!actas(me)) return E('No tienes permiso para acceder a actas y juntas', 403);
    if (path === '/api/modulos/actas' && method === 'GET') {
      const [juntas, actasRows, hermanas, asistencias] = await Promise.all([
        rows(env.DB.prepare(`SELECT j.*,(SELECT COUNT(*) FROM asistencia_junta a WHERE a.junta_id=j.id AND a.asiste=1) asistentes FROM juntas j ORDER BY j.fecha DESC,j.id DESC LIMIT 100`)),
        rows(env.DB.prepare('SELECT * FROM actas ORDER BY actualizada DESC')),
        rows(env.DB.prepare("SELECT id,nombre FROM hermanas WHERE estado!='Baja' ORDER BY nombre")),
        rows(env.DB.prepare('SELECT junta_id,hermana_id FROM asistencia_junta WHERE asiste=1')),
      ]);
      return J({ juntas, actas: actasRows, hermanas, asistencias });
    }
    if (path === '/api/modulos/actas/juntas' && method === 'POST') {
      const fecha = txt(body.fecha, 10);
      if (!isoDate(fecha)) return E('Indica una fecha válida');
      const r = await env.DB.prepare('INSERT INTO juntas(fecha,hora,lugar,convocatoria,orden_dia,creado_por) VALUES(?,?,?,?,?,?)')
        .bind(fecha, txt(body.hora, 10) || null, txt(body.lugar, 180) || null, txt(body.convocatoria, 2000) || null, txt(body.orden_dia, 4000) || null, me.id).run();
      return J({ ok: true, id: r.meta.last_row_id });
    }
    if ((m = path.match(/^\/api\/modulos\/actas\/juntas\/(\d+)$/)) && (method === 'PUT' || method === 'DELETE')) {
      const id = +m[1];
      if (method === 'DELETE') { await env.DB.prepare('DELETE FROM juntas WHERE id=?').bind(id).run(); return J({ ok: true }); }
      const cur = await env.DB.prepare('SELECT * FROM juntas WHERE id=?').bind(id).first();
      if (!cur) return E('Junta no encontrada', 404);
      const fecha = body.fecha !== undefined ? txt(body.fecha, 10) : cur.fecha;
      if (!isoDate(fecha)) return E('La fecha no es válida');
      await env.DB.prepare('UPDATE juntas SET fecha=?,hora=?,lugar=?,convocatoria=?,orden_dia=?,estado=? WHERE id=?')
        .bind(fecha, txt(body.hora ?? cur.hora, 10) || null, txt(body.lugar ?? cur.lugar, 180) || null,
          txt(body.convocatoria ?? cur.convocatoria, 2000) || null, txt(body.orden_dia ?? cur.orden_dia, 4000) || null,
          ['convocada','celebrada','cancelada'].includes(body.estado) ? body.estado : cur.estado, id).run();
      return J({ ok: true });
    }
    if ((m = path.match(/^\/api\/modulos\/actas\/juntas\/(\d+)\/acta$/)) && method === 'PUT') {
      const juntaId = +m[1], texto = txt(body.texto, 12000), acuerdos = txt(body.acuerdos, 6000);
      if (!await env.DB.prepare('SELECT id FROM juntas WHERE id=?').bind(juntaId).first()) return E('Junta no encontrada', 404);
      if (texto.length < 5) return E('Escribe el contenido del acta');
      await env.DB.prepare(`INSERT INTO actas(junta_id,texto,acuerdos,redactada_por,actualizada) VALUES(?,?,?,?,datetime('now'))
        ON CONFLICT(junta_id) DO UPDATE SET texto=excluded.texto,acuerdos=excluded.acuerdos,redactada_por=excluded.redactada_por,actualizada=datetime('now')`)
        .bind(juntaId, texto, acuerdos || null, me.id).run();
      await env.DB.prepare("UPDATE juntas SET estado='celebrada' WHERE id=?").bind(juntaId).run();
      return J({ ok: true });
    }
    if ((m = path.match(/^\/api\/modulos\/actas\/juntas\/(\d+)\/asistencia$/)) && method === 'PUT') {
      const juntaId = +m[1];
      if (!await env.DB.prepare('SELECT id FROM juntas WHERE id=?').bind(juntaId).first()) return E('Junta no encontrada', 404);
      const ids = Array.isArray(body.hermanas) ? [...new Set(body.hermanas.map(Number).filter(Number.isInteger))].slice(0, 300) : [];
      if (ids.length) {
        const validas = await env.DB.prepare(`SELECT COUNT(*) n FROM hermanas WHERE id IN (${ids.map(()=>'?').join(',')}) AND estado!='Baja'`).bind(...ids).first();
        if (validas.n !== ids.length) return E('La lista contiene una hermana no válida');
      }
      await env.DB.prepare('DELETE FROM asistencia_junta WHERE junta_id=?').bind(juntaId).run();
      if (ids.length) await env.DB.batch(ids.map(id => env.DB.prepare('INSERT INTO asistencia_junta(junta_id,hermana_id,asiste) VALUES(?,?,1)').bind(juntaId, id)));
      return J({ ok: true, total: ids.length });
    }
    return E('Ruta de actas no encontrada', 404);
  }

  return E('Módulo no encontrado', 404);
}
