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


async function syncCargosHermanas(db) {
  const cfgRows = await rows(db.prepare("SELECT clave,valor FROM config WHERE clave IN ('sabado_precio_centimos','invitada_precio_centimos','copa_precio_centimos','refresco_precio_centimos','cuotas_extraordinarias_json')"));
  const cfg = Object.fromEntries(cfgRows.map(x=>[x.clave,x.valor]));
  const cents = k => Math.max(0,Number(cfg[k]||0));
  let extras=[]; try { extras=JSON.parse(cfg.cuotas_extraordinarias_json||'[]'); } catch { extras=[]; }
  const ops=[];
  const hermanas=await rows(db.prepare("SELECT id FROM hermanas WHERE estado!='Baja'"));
  for(const x of extras.filter(x=>x.tipo==='una_vez' && Number(x.importe_centimos)>=0)) {
    const key='extra:'+String(x.categoria)+':'+String(x.nombre).trim().toLowerCase();
    for(const h of hermanas) ops.push(db.prepare(`INSERT INTO cargos_hermanas(hermana_id,categoria,concepto,importe_centimos,source_key,grupo)
      VALUES(?,?,?,?,?,'extraordinaria') ON CONFLICT(source_key) DO NOTHING`)
      .bind(h.id,x.categoria,x.nombre,Math.round(Number(x.importe_centimos)||0),key+':'+h.id));
  }
  const porCategoria={};
  for(const x of extras.filter(x=>x.tipo==='por_sabado')) porCategoria[x.categoria]=(porCategoria[x.categoria]||0)+Math.max(0,Number(x.importe_centimos)||0);
  const asistencias=await rows(db.prepare(`SELECT s.id sabado_id,s.fecha,s.titulo,s.categoria,a.hermana_id,a.asiste,a.acompanantes,
      COALESCE(c.copas,0) copas,COALESCE(c.refrescos,0) refrescos
      FROM sabados s JOIN asistencias_sabado a ON a.sabado_id=s.id
      LEFT JOIN consumos_sabado c ON c.sabado_id=s.id AND c.hermana_id=a.hermana_id
      WHERE s.estado!='cancelado'`));
  for(const a of asistencias) {
    const categoria=['Cuaresma','Semana Santa','Otros'].includes(a.categoria)?a.categoria:'Cuaresma';
    const asistencia=a.asiste ? cents('sabado_precio_centimos') : 0;
    const invitadas=Math.max(0,Number(a.acompanantes)||0)*cents('invitada_precio_centimos');
    const extra=a.asiste ? (porCategoria[categoria]||0) : 0;
    const importe=asistencia+invitadas+extra;
    const detalle=[a.asiste?'Asistencia '+(asistencia/100).toFixed(2)+' €':'',Number(a.acompanantes)>0?'Invitadas '+a.acompanantes+' × '+(cents('invitada_precio_centimos')/100).toFixed(2)+' €':'',extra>0?'Extra '+(extra/100).toFixed(2)+' €':''].filter(Boolean).join(' · ');
    const concepto='Sábado · '+a.titulo+' · '+detalle;
    ops.push(db.prepare(`INSERT INTO cargos_hermanas(hermana_id,categoria,concepto,importe_centimos,source_key,grupo)
      VALUES(?,?,?,?,?,'sabados') ON CONFLICT(source_key) DO UPDATE SET categoria=excluded.categoria,concepto=excluded.concepto,importe_centimos=excluded.importe_centimos,grupo='sabados' WHERE (SELECT fecha FROM sabados WHERE id=?)>=date('now')`)
      .bind(a.hermana_id,categoria,concepto,importe,'sabado:'+a.sabado_id+':'+a.hermana_id,a.sabado_id));
    const copas=Math.max(0,Number(a.copas)||0),refrescos=Math.max(0,Number(a.refrescos)||0);
    const importeConsumos=copas*cents('copa_precio_centimos')+refrescos*cents('refresco_precio_centimos');
    const detalleConsumos=['Copas '+copas+' × '+(cents('copa_precio_centimos')/100).toFixed(2)+' €','Refrescos '+refrescos+' × '+(cents('refresco_precio_centimos')/100).toFixed(2)+' €'].join(' · ');
    if(importeConsumos>0) ops.push(db.prepare(`INSERT INTO cargos_hermanas(hermana_id,categoria,concepto,importe_centimos,source_key,grupo)
      VALUES(?,?,?,?,?,'consumos') ON CONFLICT(source_key) DO UPDATE SET categoria=excluded.categoria,concepto=excluded.concepto,importe_centimos=excluded.importe_centimos,grupo='consumos' WHERE (SELECT fecha FROM sabados WHERE id=?)>=date('now')`)
      .bind(a.hermana_id,categoria,detalleConsumos,importeConsumos,'consumo:'+a.sabado_id+':'+a.hermana_id,a.sabado_id));
  }
  for(let i=0;i<ops.length;i+=100) await db.batch(ops.slice(i,i+100));
  await db.prepare(`UPDATE cargos_hermanas SET importe_centimos=
      (SELECT COALESCE(SUM(p.importe_centimos),0) FROM pagos p WHERE p.cargo_id=cargos_hermanas.id AND p.estado='confirmado')
    WHERE grupo IN ('sabados','consumos')
      AND EXISTS(SELECT 1 FROM sabados s WHERE s.fecha>=date('now')
        AND (cargos_hermanas.source_key LIKE 'sabado:'||s.id||':%' OR cargos_hermanas.source_key LIKE 'consumo:'||s.id||':%')
        AND (s.estado='cancelado' OR
          (cargos_hermanas.grupo='sabados' AND NOT EXISTS(
            SELECT 1 FROM asistencias_sabado a WHERE a.sabado_id=s.id AND a.hermana_id=CAST(REPLACE(REPLACE(cargos_hermanas.source_key,'sabado:'||s.id||':',''),'consumo:'||s.id||':','') AS INTEGER) AND (a.asiste=1 OR a.acompanantes>0)
          )) OR
          (cargos_hermanas.grupo='consumos' AND NOT EXISTS(
            SELECT 1 FROM consumos_sabado c WHERE c.sabado_id=s.id AND c.hermana_id=CAST(REPLACE(REPLACE(cargos_hermanas.source_key,'sabado:'||s.id||':',''),'consumo:'||s.id||':','') AS INTEGER) AND (c.copas>0 OR c.refrescos>0)
          ))))`).run();
}

export async function routeModulos(req, env, me, method, path, body) {
  let m;

  // SÁBADOS Y ASISTENCIA
  if (path === '/api/modulos/sabados' && method === 'GET') {
    await syncCargosHermanas(env.DB);
    const data = await rows(env.DB.prepare(`SELECT s.*,a.asiste mi_asistencia,a.acompanantes mis_acompanantes,a.detalle_acompanantes,
      COALESCE(NULLIF(a.alergias,''),ah.alergias,ah_old.alergias,'') mis_alergias,
      COALESCE(ah.observaciones,ah_old.observaciones,'') mi_alergias_observaciones,
      COALESCE(a.observaciones,'') mi_observaciones,
      COALESCE(c.copas,0) mis_copas,COALESCE(c.refrescos,0) mis_refrescos,
      (SELECT COUNT(*) FROM asistencias_sabado x WHERE x.sabado_id=s.id AND x.asiste=1) confirmadas,
      (SELECT COALESCE(SUM(x.acompanantes),0) FROM asistencias_sabado x WHERE x.sabado_id=s.id) invitadas,
      ((SELECT COUNT(*) FROM asistencias_sabado x WHERE x.sabado_id=s.id AND x.asiste=1)+
       (SELECT COALESCE(SUM(x.acompanantes),0) FROM asistencias_sabado x WHERE x.sabado_id=s.id)) plazas_ocupadas
      FROM sabados s LEFT JOIN asistencias_sabado a ON a.sabado_id=s.id AND a.hermana_id=?
      LEFT JOIN lts_perfil_alergias ah ON ah.hermana_id=?
      LEFT JOIN alergias_hermanas ah_old ON ah_old.hermana_id=?
      LEFT JOIN consumos_sabado c ON c.sabado_id=s.id AND c.hermana_id=? ORDER BY s.fecha DESC,s.id DESC LIMIT 40`).bind(me.id,me.id,me.id,me.id));
    const alergiasEvento = await rows(env.DB.prepare(`SELECT sabado_id,persona_tipo,persona_numero,alergias,observaciones
      FROM lts_alergias_evento WHERE hermana_id=?
      AND sabado_id IN (SELECT id FROM sabados ORDER BY fecha DESC,id DESC LIMIT 40)
      ORDER BY sabado_id,persona_tipo,persona_numero`).bind(me.id));
    const cfg = await rows(env.DB.prepare("SELECT clave,valor FROM config WHERE clave IN ('sabado_precio_centimos','invitada_precio_centimos')"));
    const precios = Object.fromEntries(cfg.map(x => [x.clave, Number(x.valor || 0)]));
    for (const s of data) {
      s.mis_alergias_personas = alergiasEvento.filter(x => x.sabado_id === s.id);
      s.precio_sabado_centimos = precios.sabado_precio_centimos ?? 1000;
      s.precio_invitada_centimos = precios.invitada_precio_centimos ?? 1000;
    }
    return J(data);
  }
  if (path === '/api/modulos/sabados' && method === 'POST') {
    if (!me.admin && !me.tes) return E('No tienes permiso para crear sábados', 403);
    const fecha = txt(body.fecha, 10), titulo = txt(body.titulo, 120);
    if (!isoDate(fecha) || titulo.length < 2) return E('Indica una fecha y un título');
    const categoria=['Cuaresma','Semana Santa','Otros'].includes(body.categoria)?body.categoria:'Cuaresma';
    const r = await env.DB.prepare('INSERT INTO sabados(fecha,hora,titulo,descripcion,categoria,creado_por) VALUES(?,?,?,?,?,?)')
      .bind(fecha, txt(body.hora, 10) || null, titulo, txt(body.descripcion, 2000) || null, categoria, me.id).run();
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
    await env.DB.prepare('UPDATE sabados SET fecha=?,hora=?,titulo=?,descripcion=?,categoria=?,estado=? WHERE id=?')
      .bind(fecha, txt(body.hora ?? s.hora, 10) || null, txt(body.titulo ?? s.titulo, 120), txt(body.descripcion ?? s.descripcion, 2000) || null,
        ['Cuaresma','Semana Santa','Otros'].includes(body.categoria)?body.categoria:s.categoria||'Cuaresma',
        ['abierto','cerrado','cancelado'].includes(body.estado) ? body.estado : s.estado, id).run();
    await syncCargosHermanas(env.DB);
    return J({ ok: true });
  }
  if ((m = path.match(/^\/api\/modulos\/sabados\/(\d+)\/asistencia$/)) && method === 'POST') {
    const id = +m[1], s = await env.DB.prepare('SELECT id,estado,fecha FROM sabados WHERE id=?').bind(id).first();
    if (!s) return E('Sábado no encontrado', 404);
    if (s.estado !== 'abierto') return E('Este sábado ya no admite cambios', 409);
    const fechaEvento = new Date(`${s.fecha}T12:00:00`);
    fechaEvento.setDate(fechaEvento.getDate() - 2);
    fechaEvento.setHours(23, 0, 0, 0);
    if (!me.admin && !tes(me) && Date.now() > fechaEvento.getTime()) return E('El plazo de confirmación terminó el jueves a las 23:00', 409);
    const asiste = body.asiste ? 1 : 0, acomp = Math.max(0, Math.min(20, num(body.acompanantes || 0)));
    if (!Number.isInteger(acomp)) return E('Número de invitadas no válido');
    const personas = Array.isArray(body.personas) ? body.personas : [{
      tipo: 'hermana', numero: 0, alergias: body.alergias || '', observaciones: body.observaciones || ''
    }];
    const propia = personas.find(x => x.tipo === 'hermana' && Number(x.numero || 0) === 0) || {};
    const ocupacion = await env.DB.prepare(`SELECT
      (SELECT COUNT(*) FROM asistencias_sabado WHERE sabado_id=? AND hermana_id<>? AND asiste=1) confirmadas,
      (SELECT COALESCE(SUM(acompanantes),0) FROM asistencias_sabado WHERE sabado_id=? AND hermana_id<>?) invitadas`)
      .bind(id,me.id,id,me.id).first();
    const plazasOcupadas = Number(ocupacion?.confirmadas || 0) + Number(ocupacion?.invitadas || 0) + (asiste ? 1 : 0) + acomp;
    if (plazasOcupadas > 40) return E(`No quedan plazas suficientes. Solo hay ${Math.max(0,40-Number(ocupacion?.confirmadas||0)-Number(ocupacion?.invitadas||0))} disponibles.`,409);
    const ops = [
      env.DB.prepare(`INSERT INTO asistencias_sabado(sabado_id,hermana_id,asiste,acompanantes,detalle_acompanantes,alergias,observaciones,actualizado)
        VALUES(?,?,?,?,?,?,?,datetime('now')) ON CONFLICT(sabado_id,hermana_id) DO UPDATE SET asiste=excluded.asiste,acompanantes=excluded.acompanantes,
        detalle_acompanantes=NULL,alergias=excluded.alergias,observaciones=excluded.observaciones,actualizado=datetime('now')`)
        .bind(id, me.id, asiste, acomp, null, txt(propia.alergias, 1000) || null, txt(body.observaciones, 1000) || null),
      env.DB.prepare('DELETE FROM lts_alergias_evento WHERE sabado_id=? AND hermana_id=?').bind(id, me.id),
    ];
    for (const persona of personas) {
      const tipo = persona.tipo === 'invitada' ? 'invitada' : persona.tipo === 'hermana' ? 'hermana' : '';
      const numero = tipo === 'hermana' ? 0 : num(persona.numero);
      if (!tipo || (tipo === 'invitada' && (!Number.isInteger(numero) || numero < 1 || numero > acomp))) continue;
      const alergias = txt(persona.alergias, 1000), observaciones = txt(persona.observaciones, 1000);
      if (!alergias && !observaciones && tipo === 'invitada') continue;
      ops.push(env.DB.prepare(`INSERT INTO lts_alergias_evento(sabado_id,hermana_id,persona_tipo,persona_numero,alergias,observaciones)
        VALUES(?,?,?,?,?,?)`).bind(id, me.id, tipo, numero, alergias, observaciones || null));
    }
    await env.DB.batch(ops);
    await syncCargosHermanas(env.DB);
    return J({ ok: true });
  }
  if ((m = path.match(/^\/api\/modulos\/sabados\/(\d+)\/asistencias$/)) && method === 'GET') {
    if (!tes(me) && !actas(me)) return E('No tienes permiso para consultar el listado', 403);
    const columnas = actas(me) ? 'a.*' : 'a.id,a.sabado_id,a.hermana_id,a.asiste,a.acompanantes,a.detalle_acompanantes,a.observaciones,a.actualizado';
    return J(await rows(env.DB.prepare(`SELECT ${columnas},h.nombre,h.telefono,COALESCE(c.copas,0) copas,COALESCE(c.refrescos,0) refrescos FROM asistencias_sabado a JOIN hermanas h ON h.id=a.hermana_id LEFT JOIN consumos_sabado c ON c.sabado_id=a.sabado_id AND c.hermana_id=a.hermana_id WHERE a.sabado_id=? ORDER BY h.nombre`).bind(+m[1])));
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
    await syncCargosHermanas(env.DB);
    return J({ ok: true });
  }


  // MI CUENTA: cada hermana solo puede consultar y registrar sus propios pagos.
  if (path === '/api/modulos/cuenta' && method === 'GET') {
    await syncCargosHermanas(env.DB);
    const cuotas = await rows(env.DB.prepare(`SELECT c.*,((SELECT COALESCE(SUM(p.importe_centimos),0) FROM pagos p WHERE p.cuota_id=c.id AND p.estado='confirmado')+(SELECT COALESCE(SUM(pa.importe_centimos),0) FROM pagos_aplicaciones pa JOIN pagos p ON p.id=pa.pago_id WHERE pa.cuota_id=c.id AND p.estado='confirmado')) pagado_centimos,MAX(0,c.importe_centimos-((SELECT COALESCE(SUM(p.importe_centimos),0) FROM pagos p WHERE p.cuota_id=c.id AND p.estado='confirmado')+(SELECT COALESCE(SUM(pa.importe_centimos),0) FROM pagos_aplicaciones pa JOIN pagos p ON p.id=pa.pago_id WHERE pa.cuota_id=c.id AND p.estado='confirmado'))) restante_centimos FROM cuotas c WHERE c.hermana_id=? ORDER BY c.periodo DESC`).bind(me.id));
    const cargos = await rows(env.DB.prepare(`SELECT x.*,
      ((SELECT COALESCE(SUM(p.importe_centimos),0) FROM pagos p WHERE p.cargo_id=x.id AND p.estado='confirmado')+(SELECT COALESCE(SUM(pa.importe_centimos),0) FROM pagos_aplicaciones pa JOIN pagos p ON p.id=pa.pago_id WHERE pa.cargo_id=x.id AND p.estado='confirmado')) pagado_centimos,
      MAX(0,x.importe_centimos-((SELECT COALESCE(SUM(p.importe_centimos),0) FROM pagos p WHERE p.cargo_id=x.id AND p.estado='confirmado')+(SELECT COALESCE(SUM(pa.importe_centimos),0) FROM pagos_aplicaciones pa JOIN pagos p ON p.id=pa.pago_id WHERE pa.cargo_id=x.id AND p.estado='confirmado'))) restante_centimos
      FROM cargos_hermanas x WHERE x.hermana_id=? ORDER BY CASE x.categoria WHEN 'Cuaresma' THEN 1 WHEN 'Semana Santa' THEN 2 ELSE 3 END,x.id`).bind(me.id));
    const pagos = await rows(env.DB.prepare('SELECT p.*,c.periodo,x.concepto cargo_concepto FROM pagos p LEFT JOIN cuotas c ON c.id=p.cuota_id LEFT JOIN cargos_hermanas x ON x.id=p.cargo_id WHERE p.hermana_id=? ORDER BY p.fecha_pago DESC,p.id DESC').bind(me.id));
    const alergias = await env.DB.prepare(`SELECT COALESCE(p.alergias,a.alergias,'') alergias,COALESCE(p.observaciones,a.observaciones,'') observaciones
      FROM hermanas h LEFT JOIN lts_perfil_alergias p ON p.hermana_id=h.id
      LEFT JOIN alergias_hermanas a ON a.hermana_id=h.id WHERE h.id=?`).bind(me.id).first();
    return J({ cuotas, cargos, pagos, alergias: alergias || { alergias: '', observaciones: '' } });
  }
  if (path === '/api/modulos/cuenta/pagos' && method === 'POST') {
    const importe = money(body.importe);
    if (!Number.isInteger(importe)) return E('Indica un importe válido');
    const cuotaId = body.cuota_id ? num(body.cuota_id) : null;
    const cargoId = body.cargo_id ? num(body.cargo_id) : null;
    const categorias=['Cuotas mensuales','Cuotas extraordinarias','Sábados e invitadas','Copas y refrescos','Otros'];
    const categoria=txt(body.categoria,40);
    if (cuotaId && cargoId) return E('Selecciona una cuota o un cargo, no ambos');
    if (!cuotaId && !cargoId && !categorias.includes(categoria)) return E('Selecciona qué concepto estás pagando');
    if (cuotaId) {
      const q = await env.DB.prepare('SELECT id,estado FROM cuotas WHERE id=? AND hermana_id=?').bind(cuotaId, me.id).first();
      if (!q) return E('La cuota seleccionada no pertenece a tu cuenta', 403);
      if (q.estado === 'pagada') return E('Esa cuota ya figura como pagada', 409);
    }
    if (cargoId) {
      const x = await env.DB.prepare(`SELECT x.id,MAX(0,x.importe_centimos-((SELECT COALESCE(SUM(p.importe_centimos),0) FROM pagos p WHERE p.cargo_id=x.id AND p.estado='confirmado')+(SELECT COALESCE(SUM(pa.importe_centimos),0) FROM pagos_aplicaciones pa JOIN pagos p ON p.id=pa.pago_id WHERE pa.cargo_id=x.id AND p.estado='confirmado'))) restante
        FROM cargos_hermanas x WHERE x.id=? AND x.hermana_id=?`).bind(cargoId,me.id).first();
      if (!x) return E('El concepto seleccionado no pertenece a tu cuenta',403);
      if (x.restante<=0) return E('Ese concepto ya figura como pagado',409);
      if (importe>x.restante) return E('El importe supera lo pendiente de ese concepto');
    }
    const fecha = isoDate(body.fecha_pago) ? body.fecha_pago : new Date().toISOString().slice(0, 10);
    const r = await env.DB.prepare(`INSERT INTO pagos(hermana_id,cuota_id,cargo_id,importe_centimos,fecha_pago,metodo,concepto,categoria,registrado_por)
      VALUES(?,?,?,?,?,?,?,?,?)`).bind(me.id, cuotaId, cargoId, importe, fecha, txt(body.metodo, 50) || null, txt(body.concepto, 300) || null, categoria||null, me.id).run();
    return J({ ok: true, id: r.meta.last_row_id, estado: 'pendiente' });
  }

  // COCINA: lectura para hermanas; edición solo para tesorería/administración.
  if (path === '/api/modulos/cocina' && method === 'GET') {
    const [turnos, alergias, tickets] = await Promise.all([
      rows(env.DB.prepare(`SELECT tc.*,
        (SELECT COUNT(*) FROM asistencias_sabado a JOIN sabados s ON s.id=a.sabado_id WHERE s.fecha=tc.fecha AND s.estado!='cancelado' AND a.asiste=1) confirmadas,
        (SELECT COALESCE(SUM(a.acompanantes),0) FROM asistencias_sabado a JOIN sabados s ON s.id=a.sabado_id WHERE s.fecha=tc.fecha AND s.estado!='cancelado') invitadas,
        COALESCE((SELECT CAST(valor AS INTEGER) FROM config WHERE clave='cocina_precio_persona_centimos'),0) precio_persona_centimos,
        (COALESCE((SELECT CAST(valor AS INTEGER) FROM config WHERE clave='cocina_precio_persona_centimos'),0) *
          ((SELECT COUNT(*) FROM asistencias_sabado a JOIN sabados s ON s.id=a.sabado_id WHERE s.fecha=tc.fecha AND s.estado!='cancelado' AND a.asiste=1) +
           (SELECT COALESCE(SUM(a.acompanantes),0) FROM asistencias_sabado a JOIN sabados s ON s.id=a.sabado_id WHERE s.fecha=tc.fecha AND s.estado!='cancelado'))) presupuesto_calculado_centimos
        FROM turnos_cocina tc ORDER BY tc.fecha DESC,tc.id DESC LIMIT 100`)),
      actas(me)
      ? await rows(env.DB.prepare(`SELECT DISTINCT l.hermana_id,
          CASE WHEN l.persona_tipo='invitada' THEN 'Invitada '||l.persona_numero||' de '||h.nombre ELSE h.nombre END nombre,
          tc.fecha fecha,l.alergias,l.observaciones
          FROM turnos_cocina tc JOIN sabados s ON s.fecha=tc.fecha
          JOIN asistencias_sabado asb ON asb.sabado_id=s.id AND (asb.asiste=1 OR asb.acompanantes>0)
          JOIN lts_alergias_evento l ON l.sabado_id=s.id AND l.hermana_id=asb.hermana_id
          JOIN hermanas h ON h.id=asb.hermana_id
          WHERE h.estado!='Baja' AND ((l.persona_tipo='hermana' AND asb.asiste=1) OR (l.persona_tipo='invitada' AND l.persona_numero<=asb.acompanantes)) AND (l.alergias<>'' OR COALESCE(l.observaciones,'')<>'')
          ORDER BY tc.fecha,h.nombre,l.persona_tipo,l.persona_numero`))
      : await rows(env.DB.prepare(`SELECT DISTINCT l.hermana_id,
          CASE WHEN l.persona_tipo='invitada' THEN 'Invitada '||l.persona_numero||' de '||h.nombre ELSE h.nombre END nombre,
          tc.fecha fecha,l.alergias,l.observaciones
          FROM turnos_cocina_hermanas mine JOIN turnos_cocina tc ON tc.id=mine.turno_id
          JOIN sabados s ON s.fecha=tc.fecha
          JOIN asistencias_sabado asb ON asb.sabado_id=s.id AND (asb.asiste=1 OR asb.acompanantes>0)
          JOIN lts_alergias_evento l ON l.sabado_id=s.id AND l.hermana_id=asb.hermana_id
          JOIN hermanas h ON h.id=asb.hermana_id
          WHERE mine.hermana_id=? AND ((l.persona_tipo='hermana' AND asb.asiste=1) OR (l.persona_tipo='invitada' AND l.persona_numero<=asb.acompanantes)) AND (l.alergias<>'' OR COALESCE(l.observaciones,'')<>'')
          ORDER BY tc.fecha,h.nombre,l.persona_tipo,l.persona_numero`).bind(me.id)),
      tes(me)
        ? rows(env.DB.prepare(`SELECT t.id,t.nombre_archivo,t.mime,t.tamano,t.creado,t.sabado_id,t.turno_cocina_id,t.comercio,t.importe_centimos,t.forma_pago,t.categoria,t.cuenta,t.estado,h.nombre subido_por_nombre FROM tickets t LEFT JOIN hermanas h ON h.id=t.subido_por ORDER BY t.creado DESC LIMIT 100`))
        : rows(env.DB.prepare(`SELECT t.id,t.nombre_archivo,t.mime,t.tamano,t.creado,t.sabado_id,t.turno_cocina_id,t.comercio,t.importe_centimos,t.forma_pago,t.categoria,t.cuenta,t.estado
          FROM tickets t WHERE t.subido_por=? OR t.turno_cocina_id IN (SELECT turno_id FROM turnos_cocina_hermanas WHERE hermana_id=?) ORDER BY t.creado DESC LIMIT 50`).bind(me.id,me.id)),
    ]);
    const hermanas = await rows(env.DB.prepare("SELECT id,nombre FROM hermanas WHERE estado='Activa' ORDER BY nombre"));
    const asignaciones = await rows(env.DB.prepare(`SELECT tc.turno_id,tc.hermana_id,h.nombre FROM turnos_cocina_hermanas tc JOIN hermanas h ON h.id=tc.hermana_id ORDER BY h.nombre`));
    const cambios = await rows(env.DB.prepare(`SELECT ch.id,ch.turno_id,ch.hermana_sale_id,ch.hermana_entra_id,hs.nombre hermana_sale,he.nombre hermana_entra,hr.nombre registrado_por,ch.creado
      FROM lts_cambios_cocina ch
      JOIN hermanas hs ON hs.id=ch.hermana_sale_id
      JOIN hermanas he ON he.id=ch.hermana_entra_id
      JOIN hermanas hr ON hr.id=ch.registrado_por
      WHERE ?=1 OR ch.hermana_sale_id=? OR ch.hermana_entra_id=? OR ch.turno_id IN (SELECT turno_id FROM turnos_cocina_hermanas WHERE hermana_id=?)
      ORDER BY ch.creado DESC,ch.id DESC LIMIT 200`).bind(tes(me)?1:0,me.id,me.id,me.id));
    const cfg = await env.DB.prepare("SELECT valor FROM config WHERE clave='cocina_personas_por_turno'").first();
    return J({ turnos, alergias, tickets, hermanas, asignaciones, cambios, personas_por_turno: cfg?.valor ? Number(cfg.valor) : 2 });
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
    const existentes = await rows(env.DB.prepare(`SELECT mine.hermana_id FROM turnos_cocina_hermanas mine
      JOIN turnos_cocina tc ON tc.id=mine.turno_id WHERE tc.fecha>=date('now')`));
    existentes.forEach(x => { if (carga[x.hermana_id] !== undefined) carga[x.hermana_id]++; });
    const asignaciones = [], omitidos = [];
    for (const sabado of sabados) {
      let turno = await env.DB.prepare('SELECT id FROM turnos_cocina WHERE fecha=? ORDER BY id LIMIT 1').bind(sabado.fecha).first();
      if (turno) {
        const yaAsignadas = await rows(env.DB.prepare('SELECT hermana_id FROM turnos_cocina_hermanas WHERE turno_id=?').bind(turno.id));
        if (yaAsignadas.length) { omitidos.push({fecha:sabado.fecha,turno_id:turno.id}); continue; }
      } else {
        const creado = await env.DB.prepare("INSERT INTO turnos_cocina(fecha,turno,responsable,creado_por) VALUES(?,'Cocina','Turno sorteado',?)").bind(sabado.fecha,me.id).run();
        turno = { id: creado.meta.last_row_id };
      }
      const orden = [...hermanas].sort((a,b) => carga[a.id]-carga[b.id] || Math.random()-0.5);
      const elegidas = orden.slice(0, personas);
      elegidas.forEach(h => carga[h.id]++);
      asignaciones.push({ turno_id: turno.id, hermana_ids: elegidas.map(h => h.id) });
    }
    if (!asignaciones.length) return E('Todos los sábados futuros ya tienen asignaciones. No se ha sobrescrito ningún turno.', 409);
    const ops = [];
    for (const a of asignaciones) for (const id of a.hermana_ids) {
      ops.push(env.DB.prepare('INSERT INTO turnos_cocina_hermanas(turno_id,hermana_id) VALUES(?,?)').bind(a.turno_id,id));
    }
    ops.push(env.DB.prepare("INSERT OR REPLACE INTO config(clave,valor) VALUES('cocina_personas_por_turno',?)").bind(String(personas)));
    for(let i=0;i<ops.length;i+=100) await env.DB.batch(ops.slice(i,i+100));
    return J({ ok: true, personas_por_turno: personas, turnos_sorteados: asignaciones.length, turnos_omitidos: omitidos.length, asignaciones: asignaciones.map(a => ({ turno_id:a.turno_id, hermana_ids:a.hermana_ids, hermanas:a.hermana_ids })) });
  }
  if ((m = path.match(/^\\/api\\/modulos\\/cocina\\/(\\d+)\\/cambio$/)) && method === 'POST') {
    const turnoId = Number(m[1]);
    const turno = await env.DB.prepare('SELECT id,fecha FROM turnos_cocina WHERE id=?').bind(turnoId).first();
    if (!turno) return E('Turno de cocina no encontrado', 404);
    const propia = await env.DB.prepare('SELECT id FROM turnos_cocina_hermanas WHERE turno_id=? AND hermana_id=?').bind(turnoId,me.id).first();
    if (!propia) return E('Solo puedes cambiar un turno que tengas asignado', 403);
    const nueva = num(body.hermana_id);
    if (!Number.isInteger(nueva) || nueva<=0 || nueva===me.id) return E('Selecciona otra hermana para el cambio');
    const activa = await env.DB.prepare("SELECT id FROM hermanas WHERE id=? AND estado='Activa'").bind(nueva).first();
    if (!activa) return E('La hermana elegida no está activa', 400);
    const ocupada = await env.DB.prepare('SELECT id FROM turnos_cocina_hermanas WHERE turno_id=? AND hermana_id=?').bind(turnoId,nueva).first();
    if (ocupada) return E('Esa hermana ya forma parte de este turno');
    await env.DB.batch([
      env.DB.prepare('DELETE FROM turnos_cocina_hermanas WHERE turno_id=? AND hermana_id=?').bind(turnoId,me.id),
      env.DB.prepare('INSERT INTO turnos_cocina_hermanas(turno_id,hermana_id) VALUES(?,?)').bind(turnoId,nueva),
      env.DB.prepare('INSERT INTO lts_cambios_cocina(turno_id,hermana_sale_id,hermana_entra_id,registrado_por) VALUES(?,?,?,?)').bind(turnoId,me.id,nueva,me.id)
    ]);
    return J({ok:true,turno_id:turnoId,hermana_sale_id:me.id,hermana_entra_id:nueva});
  }
  if (path === '/api/modulos/cocina/tickets' && method === 'POST') {
    const mdata = /^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/.exec(String(body.datos || ''));
    if (!mdata || mdata[2].length > 1400000) return E('El ticket debe ser JPG, PNG, WEBP o PDF y no superar 1 MB');
    const sabadoId = body.sabado_id ? num(body.sabado_id) : null;
    if (sabadoId && !await env.DB.prepare('SELECT id FROM sabados WHERE id=?').bind(sabadoId).first()) return E('El sábado asociado no existe');
    const turnoId = body.turno_cocina_id ? num(body.turno_cocina_id) : null;
    if (turnoId && !await env.DB.prepare('SELECT id FROM turnos_cocina WHERE id=?').bind(turnoId).first()) return E('El turno de cocina asociado no existe');
    const comercio=txt(body.comercio,120), importe=money(body.importe), formaPago=['tarjeta','caja','yo'].includes(body.forma_pago)?body.forma_pago:'tarjeta';
    if(!comercio||!Number.isInteger(importe)) return E('Indica el comercio y el importe del ticket');
    const r = await env.DB.prepare('INSERT INTO tickets(sabado_id,turno_cocina_id,nombre_archivo,mime,datos,tamano,subido_por,comercio,importe_centimos,forma_pago,cuenta,estado) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(sabadoId, turnoId, txt(body.nombre_archivo, 120) || 'ticket', mdata[1], mdata[2], Math.floor(mdata[2].length * 3 / 4), me.id, comercio, importe, formaPago, formaPago==='caja'?'Caja fuerte':'Banco', 'pendiente').run();
    return J({ ok: true, id: r.meta.last_row_id });
  }
  if ((m = path.match(/^\/api\/modulos\/cocina\/tickets\/(\d+)$/)) && method === 'GET') {
    const t = await env.DB.prepare('SELECT nombre_archivo,mime,datos,subido_por,turno_cocina_id FROM tickets WHERE id=?').bind(+m[1]).first();
    const asignada=t?.turno_cocina_id?await env.DB.prepare('SELECT id FROM turnos_cocina_hermanas WHERE turno_id=? AND hermana_id=?').bind(t.turno_cocina_id,me.id).first():null;
    if (!t || (t.subido_por !== me.id && !tes(me) && !actas(me) && !asignada)) return E('Ticket no encontrado', 404);
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
    const alergias = txt(body.alergias, 1000), observaciones = txt(body.observaciones, 1000) || null;
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO alergias_hermanas(hermana_id,alergias,observaciones,actualizado) VALUES(?,?,?,datetime('now'))
        ON CONFLICT(hermana_id) DO UPDATE SET alergias=excluded.alergias,observaciones=excluded.observaciones,actualizado=datetime('now')`)
        .bind(me.id, alergias, observaciones),
      env.DB.prepare(`INSERT INTO lts_perfil_alergias(hermana_id,alergias,observaciones,actualizado) VALUES(?,?,?,datetime('now'))
        ON CONFLICT(hermana_id) DO UPDATE SET alergias=excluded.alergias,observaciones=excluded.observaciones,actualizado=datetime('now')`)
        .bind(me.id, alergias, observaciones),
    ]);
    return J({ ok: true });
  }

  // TESORERÍA: todo el módulo queda protegido por permiso real del servidor.
  if (path.startsWith('/api/modulos/tesoreria')) {
    if (!tes(me)) return E('No tienes permiso para acceder a tesorería', 403);
    if (path === '/api/modulos/tesoreria' && method === 'GET') {
      await syncCargosHermanas(env.DB);
      const [movimientos, pagos, gastosFijos, cuotas, tickets, pendientes, informes, totales, cfg] = await Promise.all([
        rows(env.DB.prepare(`SELECT m.*,h.nombre hermana,(SELECT GROUP_CONCAT(t.id) FROM tickets t WHERE t.movimiento_id=m.id) tickets FROM movimientos m LEFT JOIN hermanas h ON h.id=m.hermana_id ORDER BY m.fecha DESC,m.id DESC`)),
        rows(env.DB.prepare(`SELECT p.*,h.nombre hermana,c.periodo FROM pagos p JOIN hermanas h ON h.id=p.hermana_id LEFT JOIN cuotas c ON c.id=p.cuota_id WHERE p.estado='pendiente' ORDER BY p.fecha_pago,p.id`)),
        rows(env.DB.prepare('SELECT * FROM gastos_fijos ORDER BY activo DESC,id')),
        rows(env.DB.prepare(`SELECT c.periodo,c.estado,COUNT(*) cantidad,SUM(c.importe_centimos) total FROM cuotas c GROUP BY c.periodo,c.estado ORDER BY c.periodo DESC LIMIT 24`)),
        rows(env.DB.prepare(`SELECT t.id,t.nombre_archivo,t.mime,t.tamano,t.creado,t.movimiento_id,t.sabado_id,t.turno_cocina_id,t.comercio,t.importe_centimos,t.forma_pago,t.categoria,t.cuenta,t.estado,m.concepto,tc.turno turno_cocina,tc.fecha fecha_turno FROM tickets t LEFT JOIN movimientos m ON m.id=t.movimiento_id LEFT JOIN turnos_cocina tc ON tc.id=t.turno_cocina_id LEFT JOIN hermanas h ON h.id=t.subido_por ORDER BY t.creado DESC LIMIT 200`)),
        rows(env.DB.prepare(`SELECT c.id,c.periodo,c.importe_centimos,c.estado,h.nombre,MAX(0,c.importe_centimos-((SELECT COALESCE(SUM(p.importe_centimos),0) FROM pagos p WHERE p.cuota_id=c.id AND p.estado='confirmado')+(SELECT COALESCE(SUM(pa.importe_centimos),0) FROM pagos_aplicaciones pa JOIN pagos p ON p.id=pa.pago_id WHERE pa.cuota_id=c.id AND p.estado='confirmado'))) restante_centimos FROM cuotas c JOIN hermanas h ON h.id=c.hermana_id WHERE c.estado!='pagada' ORDER BY c.periodo DESC,h.nombre`)),
        rows(env.DB.prepare(`SELECT strftime('%Y',fecha) anio,SUM(CASE WHEN tipo='ingreso' THEN importe_centimos ELSE 0 END) ingresos,SUM(CASE WHEN tipo='gasto' THEN importe_centimos ELSE 0 END) gastos FROM movimientos WHERE traspaso_id IS NULL GROUP BY strftime('%Y',fecha) ORDER BY anio DESC`)),
        env.DB.prepare(`SELECT COALESCE(SUM(CASE WHEN tipo='ingreso' THEN importe_centimos ELSE 0 END),0) ingresos,COALESCE(SUM(CASE WHEN tipo='gasto' THEN importe_centimos ELSE 0 END),0) gastos FROM movimientos WHERE traspaso_id IS NULL`).first(),
        env.DB.prepare("SELECT valor FROM config WHERE clave='cuota_mensual_centimos'").first(),
      ]);
      const parametrosRows = await rows(env.DB.prepare("SELECT clave,valor FROM config WHERE clave IN ('cocina_precio_persona_centimos','sabado_precio_centimos','invitada_precio_centimos','copa_precio_centimos','refresco_precio_centimos','cocina_personas_por_turno')"));
      const parametros = Object.fromEntries(parametrosRows.map(x => [x.clave, Number(x.valor)]));
      const extrasRow = await env.DB.prepare("SELECT valor FROM config WHERE clave='cuotas_extraordinarias_json'").first();
      let cuotas_extraordinarias = [];
      try { cuotas_extraordinarias = JSON.parse(extrasRow?.valor || '[]'); } catch { cuotas_extraordinarias = []; }
      const [estadisticasMensuales, estadisticasCategorias] = await Promise.all([
        rows(env.DB.prepare(`SELECT strftime('%Y-%m',fecha) periodo,
          SUM(CASE WHEN tipo='ingreso' THEN importe_centimos ELSE 0 END) ingresos,
          SUM(CASE WHEN tipo='gasto' THEN importe_centimos ELSE 0 END) gastos
          FROM movimientos WHERE tipo IN ('ingreso','gasto') AND traspaso_id IS NULL GROUP BY strftime('%Y-%m',fecha) ORDER BY periodo`)),
        rows(env.DB.prepare(`SELECT strftime('%Y',fecha) anio,tipo,categoria,SUM(importe_centimos) total FROM movimientos
          WHERE tipo IN ('ingreso','gasto') AND traspaso_id IS NULL GROUP BY strftime('%Y',fecha),tipo,categoria ORDER BY anio,tipo,total DESC`))
      ]);
      const hermanas = await rows(env.DB.prepare('SELECT id,nombre FROM hermanas ORDER BY nombre'));
      const cargos_pendientes = await rows(env.DB.prepare(`SELECT x.id,x.hermana_id,h.nombre,x.categoria,x.concepto,x.source_key,x.grupo,x.importe_centimos,
        ((SELECT COALESCE(SUM(p.importe_centimos),0) FROM pagos p WHERE p.cargo_id=x.id AND p.estado='confirmado')+(SELECT COALESCE(SUM(pa.importe_centimos),0) FROM pagos_aplicaciones pa JOIN pagos p ON p.id=pa.pago_id WHERE pa.cargo_id=x.id AND p.estado='confirmado')) pagado_centimos,
        MAX(0,x.importe_centimos-((SELECT COALESCE(SUM(p.importe_centimos),0) FROM pagos p WHERE p.cargo_id=x.id AND p.estado='confirmado')+(SELECT COALESCE(SUM(pa.importe_centimos),0) FROM pagos_aplicaciones pa JOIN pagos p ON p.id=pa.pago_id WHERE pa.cargo_id=x.id AND p.estado='confirmado'))) restante_centimos
        FROM cargos_hermanas x JOIN hermanas h ON h.id=x.hermana_id
        WHERE x.importe_centimos>(SELECT COALESCE(SUM(p.importe_centimos),0) FROM pagos p WHERE p.cargo_id=x.id AND p.estado='confirmado')
        ORDER BY h.nombre,x.categoria,x.id`));
      const saldoCfg=await rows(env.DB.prepare("SELECT clave,valor FROM config WHERE clave IN ('saldo_inicial_fecha','saldo_inicial_banco_centimos','saldo_inicial_caja_centimos')"));
      const saldosCfg=Object.fromEntries(saldoCfg.map(x=>[x.clave,x.valor]));
      const saldoInicial={fecha:saldosCfg.saldo_inicial_fecha||'2026-01-01',banco_centimos:Number(saldosCfg.saldo_inicial_banco_centimos||0),caja_centimos:Number(saldosCfg.saldo_inicial_caja_centimos||0)};
      const cocina_informe=await rows(env.DB.prepare(`SELECT tc.id,tc.fecha,tc.turno,tc.responsable,
        (COALESCE((SELECT CAST(valor AS INTEGER) FROM config WHERE clave='cocina_precio_persona_centimos'),0)*
          ((SELECT COUNT(*) FROM asistencias_sabado a JOIN sabados s ON s.id=a.sabado_id WHERE s.fecha=tc.fecha AND s.estado!='cancelado' AND a.asiste=1)+
           (SELECT COALESCE(SUM(a.acompanantes),0) FROM asistencias_sabado a JOIN sabados s ON s.id=a.sabado_id WHERE s.fecha=tc.fecha AND s.estado!='cancelado' AND a.asiste=1))) presupuesto_centimos,
        COALESCE((SELECT SUM(t.importe_centimos) FROM tickets t WHERE t.turno_cocina_id=tc.id AND t.estado='incluido'),0) gastado_centimos
        FROM turnos_cocina tc ORDER BY tc.fecha DESC,tc.id DESC`));
      const saldos=await rows(env.DB.prepare(`SELECT cuenta,
        SUM(CASE WHEN tipo='ingreso' THEN importe_centimos ELSE -importe_centimos END) neto
        FROM movimientos WHERE fecha>=? GROUP BY cuenta`).bind(saldoInicial.fecha));
      const banco=saldoInicial.banco_centimos+Number(saldos.find(x=>x.cuenta==='Banco')?.neto||0);
      const caja=saldoInicial.caja_centimos+Number(saldos.find(x=>x.cuenta==='Caja fuerte')?.neto||0);
      return J({ movimientos, pagos_pendientes: pagos, gastos_fijos: gastosFijos, resumen_cuotas: cuotas, tickets, hermanas, cuotas_pendientes: pendientes, cargos_pendientes, informes, cocina_informe, totales:{...totales,banco_centimos:banco,caja_centimos:caja,saldo_centimos:banco+caja}, saldo_inicial:saldoInicial, cuota_mensual: cfg?.valor ? Number(cfg.valor) / 100 : null, parametros, cuotas_extraordinarias, estadisticas: { mensuales: estadisticasMensuales, categorias: estadisticasCategorias } });
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
      const actualizaPrecios = Object.keys(campos).some(campo => body[campo] !== undefined);
      for (const [campo, clave] of Object.entries(campos)) {
        if (body[campo] === undefined || body[campo] === '') {
          if (campo === 'cuota_mensual' && actualizaPrecios) return E('Indica una cuota mensual válida');
          continue;
        }
        const numero = Number(String(body[campo]).replace(',', '.'));
        if (!Number.isFinite(numero) || numero < 0 || (campo === 'cuota_mensual' && numero === 0)) return E('Revisa los importes de configuración');
        const importe = Math.round(numero * 100);
        ops.push(env.DB.prepare('INSERT OR REPLACE INTO config(clave,valor) VALUES(?,?)').bind(clave,String(importe)));
      }
      if (body.personas_por_turno !== undefined) {
        const personas = num(body.personas_por_turno);
        if (![2,3].includes(personas)) return E('El sorteo debe asignar 2 o 3 personas por turno');
        ops.push(env.DB.prepare("INSERT OR REPLACE INTO config(clave,valor) VALUES('cocina_personas_por_turno',?)").bind(String(personas)));
      }
      if (body.cuotas_extraordinarias !== undefined) {
        if (!Array.isArray(body.cuotas_extraordinarias) || body.cuotas_extraordinarias.length > 50) return E('La lista de cuotas extraordinarias no es válida');
        const extras = [];
        for (const x of body.cuotas_extraordinarias) {
          const nombre = txt(x.nombre, 100), categoria = txt(x.categoria, 30), tipo = txt(x.tipo, 20);
          const importe = Number(String(x.importe ?? '').replace(',', '.'));
          if (!nombre || !['Cuaresma','Semana Santa','Otros'].includes(categoria) || !['una_vez','por_sabado'].includes(tipo) || !Number.isFinite(importe) || importe < 0) return E('Revisa los conceptos extraordinarios');
          extras.push({ nombre, categoria, importe_centimos: Math.round(importe*100), tipo });
        }
        ops.push(env.DB.prepare("INSERT OR REPLACE INTO config(clave,valor) VALUES('cuotas_extraordinarias_json',?)").bind(JSON.stringify(extras)));
      }
      const saldoInicial = body.saldo_inicial;
      if (saldoInicial !== undefined) {
        if (!saldoInicial || !isoDate(saldoInicial.fecha)) return E('La fecha del saldo inicial no es válida');
        const banco = Number(String(saldoInicial.banco ?? '').replace(',', '.'));
        const caja = Number(String(saldoInicial.caja ?? '').replace(',', '.'));
        if (!Number.isFinite(banco) || !Number.isFinite(caja)) return E('Revisa los saldos iniciales');
        ops.push(env.DB.prepare("INSERT OR REPLACE INTO config(clave,valor) VALUES('saldo_inicial_fecha',?)").bind(saldoInicial.fecha));
        ops.push(env.DB.prepare("INSERT OR REPLACE INTO config(clave,valor) VALUES('saldo_inicial_banco_centimos',?)").bind(String(Math.round(banco*100))));
        ops.push(env.DB.prepare("INSERT OR REPLACE INTO config(clave,valor) VALUES('saldo_inicial_caja_centimos',?)").bind(String(Math.round(caja*100))));
      }
      await env.DB.batch(ops);
      await syncCargosHermanas(env.DB);
      return J({ ok: true });
    }
    if (path === '/api/modulos/tesoreria/movimientos' && method === 'POST') {
      const tipo = body.tipo === 'ingreso' ? 'ingreso' : body.tipo === 'gasto' ? 'gasto' : null;
      const importe = money(body.importe), fecha = isoDate(body.fecha) ? body.fecha : null, concepto = txt(body.concepto, 180);
      const cuenta = ['Banco','Caja fuerte'].includes(body.cuenta)?body.cuenta:'Banco';
      if (!tipo || !Number.isInteger(importe) || !fecha || concepto.length < 2) return E('Revisa tipo, fecha, concepto e importe');
      const r = await env.DB.prepare('INSERT INTO movimientos(tipo,fecha,concepto,categoria,importe_centimos,cuenta,creado_por) VALUES(?,?,?,?,?,?,?)')
        .bind(tipo, fecha, concepto, txt(body.categoria, 80) || null, importe, cuenta, me.id).run();
      return J({ ok: true, id: r.meta.last_row_id });
    }
    if (path === '/api/modulos/tesoreria/traspasos' && method === 'POST') {
      const importe=money(body.importe),fecha=isoDate(body.fecha)?body.fecha:null,origen=body.origen,destino=body.destino;
      if(!Number.isInteger(importe)||!fecha||!['Banco','Caja fuerte'].includes(origen)||!['Banco','Caja fuerte'].includes(destino)||origen===destino) return E('Revisa importe, fecha y cuentas del traspaso');
      const id=crypto.randomUUID();
      await env.DB.batch([
        env.DB.prepare("INSERT INTO movimientos(tipo,fecha,concepto,categoria,importe_centimos,cuenta,traspaso_id,creado_por) VALUES('gasto',?,'Traspaso entre cuentas','Traspaso',?,?,?,?)").bind(fecha,importe,origen,id,me.id),
        env.DB.prepare("INSERT INTO movimientos(tipo,fecha,concepto,categoria,importe_centimos,cuenta,traspaso_id,creado_por) VALUES('ingreso',?,'Traspaso entre cuentas','Traspaso',?,?,?,?)").bind(fecha,importe,destino,id,me.id)
      ]);
      return J({ok:true});
    }
    if (path === '/api/modulos/tesoreria/importar' && method === 'POST') {
      if(!Array.isArray(body.movimientos)||body.movimientos.length<1||body.movimientos.length>500) return E('El archivo debe contener entre 1 y 500 movimientos');
      const ops=[];let omitidos=0;
      for(const x of body.movimientos){
        const tipo=x.tipo==='Ingreso'?'ingreso':x.tipo==='Gasto'?'gasto':null;
        const fecha=isoDate(x.fecha)?x.fecha:null,importe=money(x.importe),concepto=txt(x.concepto,180),categoria=txt(x.categoria,80)||'Otros',cuenta=['Banco','Caja fuerte'].includes(x.cuenta)?x.cuenta:'Banco';
        if(!tipo||!fecha||!Number.isInteger(importe)||!concepto) return E('Hay filas con fecha, tipo, concepto o importe no válidos');
        const key=txt(x.clave,160);
        if(!key) return E('Cada movimiento importado necesita una clave única');
        ops.push(env.DB.prepare('INSERT OR IGNORE INTO movimientos(tipo,fecha,concepto,categoria,importe_centimos,cuenta,import_key,creado_por) VALUES(?,?,?,?,?,?,?,?)').bind(tipo,fecha,concepto,categoria,importe,cuenta,key,me.id));
      }
      const result=await env.DB.batch(ops);
      return J({ok:true,importados:result.reduce((n,x)=>n+(x.changes||0),0),duplicados:result.reduce((n,x)=>n+((x.changes||0)?0:1),0)});
    }
    if (path === '/api/modulos/tesoreria/gastos-fijos' && method === 'POST') {
      const importe=money(body.importe),concepto=txt(body.concepto,180);
      const periodicidad=['mensual','anual'].includes(body.periodicidad)?body.periodicidad:'mensual';
      const dia=num(body.dia||1),mes=num(body.mes||1),cuenta=['Banco','Caja fuerte'].includes(body.cuenta)?body.cuenta:'Banco';
      if(!Number.isInteger(importe)||importe<=0||concepto.length<2) return E('Indica concepto e importe');
      if(!Number.isInteger(dia)||dia<1||dia>28) return E('El día debe estar entre 1 y 28');
      if(!Number.isInteger(mes)||mes<1||mes>12) return E('Selecciona el mes de cargo');
      const r=await env.DB.prepare(`INSERT INTO gastos_fijos(concepto,categoria,importe_centimos,periodicidad,dia,activo,creado_por,cuenta,variable,mes)
        VALUES(?,?,?,?,?,1,?,?,?,?)`).bind(concepto,txt(body.categoria,80)||null,importe,periodicidad,dia,me.id,cuenta,body.variable?1:0,mes).run();
      return J({ok:true,id:r.meta.last_row_id});
    }
    if ((m = path.match(/^\/api\/modulos\/tesoreria\/gastos-fijos\/(\d+)\/registrar$/)) && method === 'POST') {
      const id=+m[1],g=await env.DB.prepare('SELECT * FROM gastos_fijos WHERE id=? AND activo=1').bind(id).first();
      if(!g) return E('Gasto fijo no encontrado o inactivo',404);
      const periodo=txt(body.periodo,7);
      if(!/^\d{4}-\d{2}$/.test(periodo)||periodo!==new Date().toISOString().slice(0,7)) return E('Solo puedes registrar los gastos del mes actual');
      const mes=Number(periodo.slice(5,7));
      if(g.periodicidad==='anual'&&Number(g.mes)!==mes) return E('Este gasto no vence este mes');
      if(g.ultimo_periodo===periodo) return E('Este gasto ya está registrado este mes',409);
      const importe=g.variable?money(body.importe):Number(g.importe_centimos);
      if(!Number.isInteger(importe)||importe<=0) return E('Revisa el importe del gasto');
      const fecha=periodo+'-'+String(g.dia).padStart(2,'0');
      const ops=[
        env.DB.prepare(`INSERT OR IGNORE INTO movimientos(tipo,fecha,concepto,categoria,importe_centimos,creado_por,cuenta,gasto_fijo_id,periodo_fijo)
          VALUES('gasto',?,?,?,?,?,?,?,?)`).bind(fecha,g.concepto,g.categoria||'Gastos fijos',importe,me.id,g.cuenta||'Banco',id,periodo),
        env.DB.prepare(`UPDATE gastos_fijos SET ultimo_periodo=? WHERE id=? AND EXISTS(SELECT 1 FROM movimientos WHERE gasto_fijo_id=? AND periodo_fijo=?)`).bind(periodo,id,id,periodo),
      ];
      const res=await env.DB.batch(ops);
      if(!res[0]?.meta?.changes) return E('Este gasto ya está registrado este mes',409);
      return J({ok:true,movimiento_id:res[0].meta.last_row_id,fecha,importe_centimos:importe});
    }
    if ((m = path.match(/^\/api\/modulos\/tesoreria\/gastos-fijos\/(\d+)$/)) && (method === 'PUT' || method === 'DELETE')) {
      const id=+m[1];
      if(method==='DELETE'){await env.DB.prepare('UPDATE gastos_fijos SET activo=0 WHERE id=?').bind(id).run();return J({ok:true});}
      const cur=await env.DB.prepare('SELECT * FROM gastos_fijos WHERE id=?').bind(id).first();
      if(!cur) return E('Gasto fijo no encontrado',404);
      const importe=body.importe!==undefined?money(body.importe):cur.importe_centimos;
      const dia=num(body.dia??cur.dia),mes=num(body.mes??cur.mes),periodicidad=body.periodicidad??cur.periodicidad,cuenta=body.cuenta??cur.cuenta;
      if(!Number.isInteger(importe)||importe<=0) return E('Importe no válido');
      if(!Number.isInteger(dia)||dia<1||dia>28) return E('El día debe estar entre 1 y 28');
      if(!Number.isInteger(mes)||mes<1||mes>12) return E('Selecciona el mes de cargo');
      if(!['mensual','anual'].includes(periodicidad)||!['Banco','Caja fuerte'].includes(cuenta)) return E('Revisa la periodicidad o la cuenta');
      await env.DB.prepare('UPDATE gastos_fijos SET concepto=?,categoria=?,importe_centimos=?,periodicidad=?,dia=?,activo=?,cuenta=?,variable=?,mes=? WHERE id=?')
        .bind(txt(body.concepto??cur.concepto,180),txt(body.categoria??cur.categoria,80)||null,importe,periodicidad,dia,
          body.activo===undefined?cur.activo:(body.activo?1:0),cuenta,
          body.variable===undefined?cur.variable:(body.variable?1:0),mes,id).run();
      return J({ok:true});
    }
    if ((m = path.match(/^\/api\/modulos\/tesoreria\/pagos\/(\d+)\/confirmar$/)) && method === 'POST') {
      const pagoId = +m[1], p = await env.DB.prepare('SELECT * FROM pagos WHERE id=?').bind(pagoId).first();
      if (!p) return E('Pago no encontrado', 404);
      if (p.estado !== 'pendiente') return E('Este pago ya está revisado', 409);
      const ops = [env.DB.prepare("UPDATE pagos SET estado='confirmado',confirmado_por=? WHERE id=? AND estado='pendiente'").bind(me.id, pagoId)];
      const cuotasAplicadas=[];
      if (!p.cuota_id && !p.cargo_id) {
        const cat=p.categoria;
        let deudas=[];
        if(cat==='Cuotas mensuales') {
          deudas=await rows(env.DB.prepare(`SELECT c.id,MAX(0,c.importe_centimos-((SELECT COALESCE(SUM(p.importe_centimos),0) FROM pagos p WHERE p.cuota_id=c.id AND p.estado='confirmado')+(SELECT COALESCE(SUM(pa.importe_centimos),0) FROM pagos_aplicaciones pa JOIN pagos p ON p.id=pa.pago_id WHERE pa.cuota_id=c.id AND p.estado='confirmado'))) restante
            FROM cuotas c WHERE c.hermana_id=? AND c.estado!='pagada' ORDER BY c.periodo,c.id`).bind(p.hermana_id));
          deudas=deudas.filter(x=>x.restante>0).map(x=>({...x,tipo:'cuota'}));
        } else {
          const filtro=cat==='Cuotas extraordinarias'?"grupo='extraordinaria' AND categoria!='Otros'":cat==='Sábados e invitadas'?"grupo='sabados'":cat==='Copas y refrescos'?"grupo='consumos'": "categoria='Otros'";
          deudas=await rows(env.DB.prepare(`SELECT x.id,MAX(0,x.importe_centimos-((SELECT COALESCE(SUM(p.importe_centimos),0) FROM pagos p WHERE p.cargo_id=x.id AND p.estado='confirmado')+(SELECT COALESCE(SUM(pa.importe_centimos),0) FROM pagos_aplicaciones pa JOIN pagos p ON p.id=pa.pago_id WHERE pa.cargo_id=x.id AND p.estado='confirmado'))) restante
            FROM cargos_hermanas x WHERE x.hermana_id=? AND ${filtro} ORDER BY x.id`).bind(p.hermana_id));
          deudas=deudas.filter(x=>x.restante>0).map(x=>({...x,tipo:'cargo'}));
        }
        const disponible=deudas.reduce((n,x)=>n+x.restante,0);
        if(disponible<p.importe_centimos) return E('El importe supera lo pendiente de ese concepto. Revisa la deuda antes de confirmarlo.',409);
        let restante=p.importe_centimos;
        for(const d of deudas) {
          if(!restante) break;
          const aplicar=Math.min(restante,d.restante);
          if(d.tipo==='cuota') { ops.push(env.DB.prepare('INSERT INTO pagos_aplicaciones(pago_id,cuota_id,importe_centimos) VALUES(?,?,?)').bind(pagoId,d.id,aplicar)); cuotasAplicadas.push(d.id); }
          else ops.push(env.DB.prepare('INSERT INTO pagos_aplicaciones(pago_id,cargo_id,importe_centimos) VALUES(?,?,?)').bind(pagoId,d.id,aplicar));
          restante-=aplicar;
        }
      }
      ops.push(env.DB.prepare(`INSERT OR IGNORE INTO movimientos(tipo,fecha,concepto,categoria,importe_centimos,hermana_id,cuota_id,pago_id,creado_por)
        SELECT 'ingreso',p.fecha_pago,
          COALESCE(NULLIF(p.concepto,''),CASE WHEN p.categoria IS NOT NULL THEN p.categoria WHEN p.cuota_id IS NOT NULL THEN 'Pago de cuota' ELSE COALESCE(x.concepto,'Pago registrado') END),
          COALESCE(p.categoria,CASE WHEN p.cuota_id IS NOT NULL THEN 'Cuotas mensuales' WHEN p.cargo_id IS NOT NULL THEN x.categoria ELSE 'Otros' END),
          p.importe_centimos,p.hermana_id,p.cuota_id,p.id,?
        FROM pagos p LEFT JOIN cargos_hermanas x ON x.id=p.cargo_id WHERE p.id=? AND p.estado='confirmado'`).bind(me.id, pagoId));
      const resultado=await env.DB.batch(ops);
      if (!resultado[0]?.meta?.changes) return E('Este pago ya está revisado', 409);
      if(p.cuota_id) cuotasAplicadas.push(p.cuota_id);
      for(const cuotaId of [...new Set(cuotasAplicadas)]) {
        const c=await env.DB.prepare('SELECT importe_centimos FROM cuotas WHERE id=?').bind(cuotaId).first();
        const total=await env.DB.prepare(`SELECT
          (SELECT COALESCE(SUM(importe_centimos),0) FROM pagos WHERE cuota_id=? AND estado='confirmado')+
          (SELECT COALESCE(SUM(pa.importe_centimos),0) FROM pagos_aplicaciones pa JOIN pagos p ON p.id=pa.pago_id WHERE pa.cuota_id=? AND p.estado='confirmado') n`).bind(cuotaId,cuotaId).first();
        await env.DB.prepare('UPDATE cuotas SET estado=? WHERE id=?').bind(total.n>=c.importe_centimos?'pagada':'parcial',cuotaId).run();
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
      if(body.estado==='rechazado') {
        await env.DB.prepare("UPDATE tickets SET estado='rechazado' WHERE id=? AND estado='pendiente'").bind(id).run();
        return J({ok:true,estado:'rechazado'});
      }
      if(body.incluir) {
        const t=await env.DB.prepare('SELECT * FROM tickets WHERE id=?').bind(id).first();
        if(!t) return E('Ticket no encontrado',404);
        if(t.estado!=='pendiente') return E('Este ticket ya está revisado',409);
        const importe=body.importe!==undefined?money(body.importe):Number(t.importe_centimos);
        const categoria=txt(body.categoria,80),cuenta=['Banco','Caja fuerte'].includes(body.cuenta)?body.cuenta:(t.forma_pago==='caja'?'Caja fuerte':'Banco');
        if(!Number.isInteger(importe)||!categoria) return E('Indica un importe y una categoría válidos');
        const movimiento=await env.DB.prepare("INSERT INTO movimientos(tipo,fecha,concepto,categoria,importe_centimos,cuenta,creado_por) VALUES('gasto',?,?,?,?,?,?)")
          .bind((t.creado||new Date().toISOString()).slice(0,10),t.comercio||t.nombre_archivo,categoria,importe,cuenta,me.id).run();
        await env.DB.prepare("UPDATE tickets SET movimiento_id=?,importe_centimos=?,categoria=?,cuenta=?,estado='incluido' WHERE id=? AND estado='pendiente'")
          .bind(movimiento.meta.last_row_id,importe,categoria,cuenta,id).run();
        return J({ok:true,movimiento_id:movimiento.meta.last_row_id,estado:'incluido'});
      }
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

  if (path === '/api/modulos/actas/estatutos' && method === 'GET') {
    const doc=await env.DB.prepare("SELECT nombre,tamano,creado FROM documentos WHERE clave='estatutos'").first();
    return J({documento:doc||null});
  }
  if (path === '/api/modulos/actas/estatutos/archivo' && method === 'GET') {
    const doc=await env.DB.prepare("SELECT nombre,mime,datos FROM documentos WHERE clave='estatutos'").first();
    if(!doc) return E('Todavía no hay estatutos publicados',404);
    const bytes=Uint8Array.from(atob(doc.datos),ch=>ch.charCodeAt(0));
    const nombre=txt(doc.nombre,120).replace(/[\\r\\n"\\\\]/g,'_');
    return new Response(bytes,{headers:{'Content-Type':'application/pdf','Content-Disposition':`inline; filename="${nombre}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }
  if (path === '/api/modulos/actas/estatutos' && method === 'PUT') {
    if(!actas(me)) return E('No tienes permiso para publicar estatutos',403);
    const match=/^data:application\/pdf;base64,([A-Za-z0-9+/=]+)$/.exec(String(body.datos||''));
    if(!match||match[1].length>1400000) return E('El archivo debe ser un PDF de 1 MB como máximo');
    await env.DB.prepare(`INSERT INTO documentos(clave,nombre,mime,datos,tamano,subido_por) VALUES('estatutos',?,'application/pdf',?,?,?)
      ON CONFLICT(clave) DO UPDATE SET nombre=excluded.nombre,mime=excluded.mime,datos=excluded.datos,tamano=excluded.tamano,subido_por=excluded.subido_por,creado=datetime('now')`)
      .bind(txt(body.nombre,120)||'Estatutos_vigentes.pdf',match[1],Math.floor(match[1].length*3/4),me.id).run();
    return J({ok:true});
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
      const hora=txt(body.hora,10),lugar=txt(body.lugar,180),convocatoria=txt(body.convocatoria,2000),orden=txt(body.orden_dia,4000);
      const r = await env.DB.prepare('INSERT INTO juntas(fecha,hora,lugar,convocatoria,orden_dia,creado_por) VALUES(?,?,?,?,?,?)')
        .bind(fecha,hora||null,lugar||null,convocatoria||null,orden||null,me.id).run();
      let correos_enviados=0,correo_aviso='';
      if(env.RESEND_API_KEY&&env.MAIL_FROM) {
        const destinatarias=await rows(env.DB.prepare("SELECT nombre,email FROM hermanas WHERE estado='Activa' AND email IS NOT NULL AND email!=''"));
        const safe=x=>String(x||'').replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
        for(const h of destinatarias) {
          try {
            const resp=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:env.MAIL_FROM,to:[h.email],subject:'Convocatoria de junta · '+fecha,html:`<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#33261a"><h2>Las Tribulaciones de Sara</h2><h3>Convocatoria de junta</h3><p>Hola, ${safe(h.nombre)}.</p><p>Se convoca junta para el <b>${safe(fecha)}</b> a las <b>${safe(hora||'hora por confirmar')}</b>.</p><p>Lugar: ${safe(lugar||'Por confirmar')}</p><p><b>Orden del día</b><br>${safe(orden).replace(/\r?\n/g,'<br>')}</p><p>${safe(convocatoria)}</p><p>Un saludo.</p></div>`})});
            if(resp.ok) correos_enviados++; else correo_aviso='La junta se ha creado, pero algún correo no se ha podido enviar.';
          } catch { correo_aviso='La junta se ha creado, pero algún correo no se ha podido enviar.'; }
        }
      } else correo_aviso='Junta creada. El correo no está configurado todavía.';
      return J({ ok:true,id:r.meta.last_row_id,correos_enviados,correo_aviso });
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
