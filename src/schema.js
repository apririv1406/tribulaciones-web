// Migraciones de la base de datos. Cada migración se aplica una sola vez, en orden.
// Para añadir tablas o columnas en una fase futura, se añade una migración nueva.
export const MIGRATIONS = [
  { v: 1, sql: [
    `CREATE TABLE IF NOT EXISTS cargos(id INTEGER PRIMARY KEY AUTOINCREMENT,nombre TEXT NOT NULL UNIQUE,permiso TEXT NOT NULL DEFAULT 'none' CHECK(permiso IN('none','tes','actas')),orden INTEGER NOT NULL DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS hermanas(id INTEGER PRIMARY KEY AUTOINCREMENT,nombre TEXT NOT NULL,email TEXT UNIQUE COLLATE NOCASE,cargo_id INTEGER REFERENCES cargos(id),estado TEXT NOT NULL DEFAULT 'Activa' CHECK(estado IN('Activa','Pasiva','Baja')),es_admin INTEGER NOT NULL DEFAULT 0,anio_entrada INTEGER,visible_web INTEGER NOT NULL DEFAULT 0,foto_id INTEGER,pass_hash TEXT,invitada TEXT,ultimo_acceso TEXT,creada TEXT NOT NULL DEFAULT (datetime('now')))` ,
    `CREATE TABLE IF NOT EXISTS sesiones(id TEXT PRIMARY KEY,hermana_id INTEGER NOT NULL REFERENCES hermanas(id) ON DELETE CASCADE,expira INTEGER NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS tokens(id TEXT PRIMARY KEY,hermana_id INTEGER NOT NULL REFERENCES hermanas(id) ON DELETE CASCADE,tipo TEXT NOT NULL,expira INTEGER NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS intentos(clave TEXT NOT NULL,ts INTEGER NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS ix_intentos ON intentos(clave,ts)`,
    `CREATE TABLE IF NOT EXISTS imagenes(id INTEGER PRIMARY KEY AUTOINCREMENT,tipo TEXT NOT NULL,datos TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS noticias(id INTEGER PRIMARY KEY AUTOINCREMENT,titulo TEXT NOT NULL,texto TEXT NOT NULL,fecha TEXT NOT NULL DEFAULT (date('now')),imagen_id INTEGER,autor_id INTEGER)`,
    `CREATE TABLE IF NOT EXISTS hitos(id INTEGER PRIMARY KEY AUTOINCREMENT,anio TEXT NOT NULL,texto TEXT NOT NULL,orden INTEGER NOT NULL DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS config(clave TEXT PRIMARY KEY,valor TEXT NOT NULL)`,
    `INSERT OR IGNORE INTO cargos(nombre,permiso,orden) VALUES ('Presidenta','none',1),('Vicepresidenta','none',2),('Secretaria','actas',3),('Vicesecretaria','actas',4),('Tesorera','tes',5),('Vicetesorera','tes',6),('Vocal','none',7),('Hermana','none',8)`,
    `INSERT INTO hitos(anio,texto,orden) VALUES ('2007','El 15 de junio, quince hermanas se reúnen, eligen presidenta y fijan una cuota mínima.',1),('2012','El 21 de septiembre nos convertimos en Primer Grupo de María Stma. de la Victoria.',2)`,
  ]},
  { v: 2, sql: [
    `ALTER TABLE hermanas ADD COLUMN telefono TEXT`,
  ]},
  { v: 3, sql: [
    // Sábados, confirmaciones y alergias. Una respuesta por hermana y sábado.
    `CREATE TABLE IF NOT EXISTS sabados(id INTEGER PRIMARY KEY AUTOINCREMENT,fecha TEXT NOT NULL,hora TEXT,titulo TEXT NOT NULL,descripcion TEXT,estado TEXT NOT NULL DEFAULT 'abierto' CHECK(estado IN('abierto','cerrado','cancelado')),creado_por INTEGER REFERENCES hermanas(id),creado TEXT NOT NULL DEFAULT (datetime('now')))` ,
    `CREATE TABLE IF NOT EXISTS asistencias_sabado(id INTEGER PRIMARY KEY AUTOINCREMENT,sabado_id INTEGER NOT NULL REFERENCES sabados(id) ON DELETE CASCADE,hermana_id INTEGER NOT NULL REFERENCES hermanas(id) ON DELETE CASCADE,asiste INTEGER NOT NULL DEFAULT 1 CHECK(asiste IN(0,1)),acompanantes INTEGER NOT NULL DEFAULT 0,detalle_acompanantes TEXT,alergias TEXT,observaciones TEXT,actualizado TEXT NOT NULL DEFAULT (datetime('now')),UNIQUE(sabado_id,hermana_id))`,
    `CREATE INDEX IF NOT EXISTS ix_sabados_fecha ON sabados(fecha)`,
    `CREATE INDEX IF NOT EXISTS ix_asistencias_sabado ON asistencias_sabado(sabado_id)`,

    // Cuotas mensuales y pagos. El periodo YYYY-MM evita duplicados por hermana.
    `CREATE TABLE IF NOT EXISTS cuotas(id INTEGER PRIMARY KEY AUTOINCREMENT,hermana_id INTEGER NOT NULL REFERENCES hermanas(id),periodo TEXT NOT NULL,importe_centimos INTEGER NOT NULL CHECK(importe_centimos>=0),estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN('pendiente','parcial','pagada')),generada TEXT NOT NULL DEFAULT (datetime('now')),UNIQUE(hermana_id,periodo))`,
    `CREATE INDEX IF NOT EXISTS ix_cuotas_periodo_estado ON cuotas(periodo,estado)`,
    `CREATE TABLE IF NOT EXISTS pagos(id INTEGER PRIMARY KEY AUTOINCREMENT,hermana_id INTEGER NOT NULL REFERENCES hermanas(id),cuota_id INTEGER REFERENCES cuotas(id),importe_centimos INTEGER NOT NULL CHECK(importe_centimos>0),fecha_pago TEXT NOT NULL,metodo TEXT,concepto TEXT,estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN('pendiente','confirmado','rechazado')),registrado_por INTEGER REFERENCES hermanas(id),confirmado_por INTEGER REFERENCES hermanas(id),creado TEXT NOT NULL DEFAULT (datetime('now')))` ,
    `CREATE INDEX IF NOT EXISTS ix_pagos_cuota ON pagos(cuota_id,estado)`,

    // Caja y gastos recurrentes. Los importes se guardan en céntimos.
    `CREATE TABLE IF NOT EXISTS movimientos(id INTEGER PRIMARY KEY AUTOINCREMENT,tipo TEXT NOT NULL CHECK(tipo IN('ingreso','gasto')),fecha TEXT NOT NULL,concepto TEXT NOT NULL,categoria TEXT,importe_centimos INTEGER NOT NULL CHECK(importe_centimos>0),hermana_id INTEGER REFERENCES hermanas(id),cuota_id INTEGER REFERENCES cuotas(id),pago_id INTEGER REFERENCES pagos(id),creado_por INTEGER REFERENCES hermanas(id),creado TEXT NOT NULL DEFAULT (datetime('now')))`,
    `CREATE INDEX IF NOT EXISTS ix_movimientos_fecha ON movimientos(fecha,tipo)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS ux_movimientos_pago ON movimientos(pago_id) WHERE pago_id IS NOT NULL`,
    `CREATE TABLE IF NOT EXISTS gastos_fijos(id INTEGER PRIMARY KEY AUTOINCREMENT,concepto TEXT NOT NULL,categoria TEXT,importe_centimos INTEGER NOT NULL CHECK(importe_centimos>0),periodicidad TEXT NOT NULL DEFAULT 'mensual' CHECK(periodicidad IN('mensual','trimestral','anual')),dia INTEGER NOT NULL DEFAULT 1 CHECK(dia BETWEEN 1 AND 28),activo INTEGER NOT NULL DEFAULT 1,ultimo_periodo TEXT,creado_por INTEGER REFERENCES hermanas(id))`,

    // Justificantes de compra: se conserva el archivo y su relación con el gasto.
    `CREATE TABLE IF NOT EXISTS tickets(id INTEGER PRIMARY KEY AUTOINCREMENT,movimiento_id INTEGER REFERENCES movimientos(id) ON DELETE SET NULL,sabado_id INTEGER REFERENCES sabados(id) ON DELETE SET NULL,nombre_archivo TEXT NOT NULL,mime TEXT NOT NULL,datos TEXT NOT NULL,tamano INTEGER NOT NULL,subido_por INTEGER REFERENCES hermanas(id),creado TEXT NOT NULL DEFAULT (datetime('now')))` ,
    `CREATE INDEX IF NOT EXISTS ix_tickets_movimiento ON tickets(movimiento_id)`,

    // Organización de cocina y alergias de las hermanas.
    `CREATE TABLE IF NOT EXISTS turnos_cocina(id INTEGER PRIMARY KEY AUTOINCREMENT,fecha TEXT NOT NULL,turno TEXT,menu TEXT,responsable TEXT,presupuesto_centimos INTEGER,observaciones TEXT,creado_por INTEGER REFERENCES hermanas(id),creado TEXT NOT NULL DEFAULT (datetime('now')))`,
    `CREATE INDEX IF NOT EXISTS ix_turnos_cocina_fecha ON turnos_cocina(fecha)`,
    `CREATE TABLE IF NOT EXISTS alergias_hermanas(id INTEGER PRIMARY KEY AUTOINCREMENT,hermana_id INTEGER NOT NULL REFERENCES hermanas(id) ON DELETE CASCADE,alergias TEXT NOT NULL,observaciones TEXT,actualizado TEXT NOT NULL DEFAULT (datetime('now')),UNIQUE(hermana_id))`,

    // Juntas, convocatorias, asistencia y actas.
    `CREATE TABLE IF NOT EXISTS juntas(id INTEGER PRIMARY KEY AUTOINCREMENT,fecha TEXT NOT NULL,hora TEXT,lugar TEXT,convocatoria TEXT,orden_dia TEXT,estado TEXT NOT NULL DEFAULT 'convocada' CHECK(estado IN('convocada','celebrada','cancelada')),creado_por INTEGER REFERENCES hermanas(id),creado TEXT NOT NULL DEFAULT (datetime('now')))` ,
    `CREATE TABLE IF NOT EXISTS asistencia_junta(id INTEGER PRIMARY KEY AUTOINCREMENT,junta_id INTEGER NOT NULL REFERENCES juntas(id) ON DELETE CASCADE,hermana_id INTEGER NOT NULL REFERENCES hermanas(id) ON DELETE CASCADE,asiste INTEGER NOT NULL DEFAULT 1 CHECK(asiste IN(0,1)),UNIQUE(junta_id,hermana_id))`,
    `CREATE TABLE IF NOT EXISTS actas(id INTEGER PRIMARY KEY AUTOINCREMENT,junta_id INTEGER NOT NULL UNIQUE REFERENCES juntas(id) ON DELETE CASCADE,texto TEXT NOT NULL,acuerdos TEXT,redactada_por INTEGER REFERENCES hermanas(id),actualizada TEXT NOT NULL DEFAULT (datetime('now')))` ,
    `CREATE INDEX IF NOT EXISTS ix_juntas_fecha ON juntas(fecha)`,
  ]},
  { v: 4, sql: [
    `CREATE TABLE IF NOT EXISTS consumos_sabado(id INTEGER PRIMARY KEY AUTOINCREMENT,sabado_id INTEGER NOT NULL REFERENCES sabados(id) ON DELETE CASCADE,hermana_id INTEGER NOT NULL REFERENCES hermanas(id) ON DELETE CASCADE,copas INTEGER NOT NULL DEFAULT 0 CHECK(copas BETWEEN 0 AND 50),refrescos INTEGER NOT NULL DEFAULT 0 CHECK(refrescos BETWEEN 0 AND 50),actualizado TEXT NOT NULL DEFAULT (datetime('now')),UNIQUE(sabado_id,hermana_id))`,
    `CREATE INDEX IF NOT EXISTS ix_consumos_sabado ON consumos_sabado(sabado_id)`,
  ]},
  { v: 5, sql: [
    `CREATE TABLE IF NOT EXISTS turnos_cocina_hermanas(id INTEGER PRIMARY KEY AUTOINCREMENT,turno_id INTEGER NOT NULL REFERENCES turnos_cocina(id) ON DELETE CASCADE,hermana_id INTEGER NOT NULL REFERENCES hermanas(id) ON DELETE CASCADE,asignada TEXT NOT NULL DEFAULT (datetime('now')),UNIQUE(turno_id,hermana_id))`,
    `CREATE INDEX IF NOT EXISTS ix_turnos_cocina_hermanas ON turnos_cocina_hermanas(turno_id)`,
  ]},
  { v: 6, sql: [
    `ALTER TABLE tickets ADD COLUMN turno_cocina_id INTEGER REFERENCES turnos_cocina(id) ON DELETE SET NULL`,
    `CREATE INDEX IF NOT EXISTS ix_tickets_turno_cocina ON tickets(turno_cocina_id)`,
  ]},
  { v: 7, sql: [
    `ALTER TABLE sabados ADD COLUMN categoria TEXT NOT NULL DEFAULT 'Cuaresma'`,
    `ALTER TABLE movimientos ADD COLUMN cuenta TEXT NOT NULL DEFAULT 'Banco'`,
    `ALTER TABLE movimientos ADD COLUMN traspaso_id TEXT`,
    `ALTER TABLE movimientos ADD COLUMN import_key TEXT`,
    `CREATE UNIQUE INDEX IF NOT EXISTS ux_movimientos_import_key ON movimientos(import_key) WHERE import_key IS NOT NULL`,
    `CREATE TABLE IF NOT EXISTS cargos_hermanas(id INTEGER PRIMARY KEY AUTOINCREMENT,hermana_id INTEGER NOT NULL REFERENCES hermanas(id) ON DELETE CASCADE,categoria TEXT NOT NULL CHECK(categoria IN('Cuaresma','Semana Santa','Otros')),concepto TEXT NOT NULL,importe_centimos INTEGER NOT NULL CHECK(importe_centimos>=0),source_key TEXT NOT NULL UNIQUE,creado TEXT NOT NULL DEFAULT (datetime('now')))`,
    `CREATE INDEX IF NOT EXISTS ix_cargos_hermanas ON cargos_hermanas(hermana_id,categoria)`,
    `ALTER TABLE pagos ADD COLUMN cargo_id INTEGER REFERENCES cargos_hermanas(id)`,
    `CREATE INDEX IF NOT EXISTS ix_pagos_cargo ON pagos(cargo_id,estado)`,
  ]},
  { v: 8, sql: [
    `ALTER TABLE tickets ADD COLUMN comercio TEXT`,
    `ALTER TABLE tickets ADD COLUMN importe_centimos INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE tickets ADD COLUMN forma_pago TEXT NOT NULL DEFAULT 'tarjeta'`,
    `ALTER TABLE tickets ADD COLUMN categoria TEXT`,
    `ALTER TABLE tickets ADD COLUMN cuenta TEXT NOT NULL DEFAULT 'Banco'`,
    `ALTER TABLE tickets ADD COLUMN estado TEXT NOT NULL DEFAULT 'pendiente'`,
  ]},
  { v: 9, sql: [
    `CREATE TABLE IF NOT EXISTS documentos(id INTEGER PRIMARY KEY AUTOINCREMENT,clave TEXT NOT NULL UNIQUE,nombre TEXT NOT NULL,mime TEXT NOT NULL,datos TEXT NOT NULL,tamano INTEGER NOT NULL,subido_por INTEGER REFERENCES hermanas(id),creado TEXT NOT NULL DEFAULT (datetime('now')))`,
  ]},
  { v: 10, sql: [
    `ALTER TABLE cargos_hermanas ADD COLUMN grupo TEXT NOT NULL DEFAULT 'extraordinaria'`,
    `UPDATE cargos_hermanas SET grupo='sabados' WHERE source_key LIKE 'sabado:%'`,
    `ALTER TABLE pagos ADD COLUMN categoria TEXT`,
    `CREATE TABLE IF NOT EXISTS pagos_aplicaciones(id INTEGER PRIMARY KEY AUTOINCREMENT,pago_id INTEGER NOT NULL REFERENCES pagos(id) ON DELETE CASCADE,cuota_id INTEGER REFERENCES cuotas(id),cargo_id INTEGER REFERENCES cargos_hermanas(id),importe_centimos INTEGER NOT NULL CHECK(importe_centimos>0),CHECK((cuota_id IS NOT NULL) != (cargo_id IS NOT NULL)))`,
    `CREATE INDEX IF NOT EXISTS ix_pagos_aplicaciones_cuota ON pagos_aplicaciones(cuota_id,pago_id)`,
    `CREATE INDEX IF NOT EXISTS ix_pagos_aplicaciones_cargo ON pagos_aplicaciones(cargo_id,pago_id)`,
  ]},
  { v: 11, sql: [
    `ALTER TABLE gastos_fijos ADD COLUMN cuenta TEXT NOT NULL DEFAULT 'Banco'`,
    `ALTER TABLE gastos_fijos ADD COLUMN variable INTEGER NOT NULL DEFAULT 0 CHECK(variable IN(0,1))`,
    `ALTER TABLE gastos_fijos ADD COLUMN mes INTEGER NOT NULL DEFAULT 1 CHECK(mes BETWEEN 1 AND 12)`,
    `ALTER TABLE movimientos ADD COLUMN gasto_fijo_id INTEGER REFERENCES gastos_fijos(id)`,
    `ALTER TABLE movimientos ADD COLUMN periodo_fijo TEXT`,
    `CREATE UNIQUE INDEX IF NOT EXISTS ux_movimientos_gasto_fijo_periodo ON movimientos(gasto_fijo_id,periodo_fijo) WHERE gasto_fijo_id IS NOT NULL`,
  ]},
  { v: 12, sql: [
    `CREATE TABLE IF NOT EXISTS lts_alergias_evento(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sabado_id INTEGER NOT NULL REFERENCES sabados(id) ON DELETE CASCADE,
      hermana_id INTEGER NOT NULL REFERENCES hermanas(id) ON DELETE CASCADE,
      persona_tipo TEXT NOT NULL CHECK(persona_tipo IN('hermana','invitada')),
      persona_numero INTEGER NOT NULL DEFAULT 0 CHECK(persona_numero>=0),
      alergias TEXT NOT NULL DEFAULT '',
      observaciones TEXT,
      actualizado TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(sabado_id,hermana_id,persona_tipo,persona_numero)
    )`,
    `CREATE INDEX IF NOT EXISTS ix_lts_alergias_evento ON lts_alergias_evento(sabado_id,hermana_id)`,
    `CREATE TABLE IF NOT EXISTS lts_perfil_alergias(
      hermana_id INTEGER PRIMARY KEY REFERENCES hermanas(id) ON DELETE CASCADE,
      alergias TEXT NOT NULL DEFAULT '',
      observaciones TEXT,
      actualizado TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  ]},

]; 

async function ensureColumn(db, table, column, definition) {
  const info = await db.prepare(`PRAGMA table_info(${table})`).all();
  if (!(info.results || []).some(x => x.name === column)) {
    await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

export async function ensureSchema(db) {
  await db.prepare('CREATE TABLE IF NOT EXISTS meta(clave TEXT PRIMARY KEY,valor TEXT)').run();
  const r = await db.prepare("SELECT valor FROM meta WHERE clave='schema'").first();
  let cur = r ? +r.valor : 0;
  for (const m of MIGRATIONS) {
    if (m.v > cur) {
      await db.batch(m.sql.map(s => db.prepare(s)));
      await db.prepare("INSERT OR REPLACE INTO meta(clave,valor) VALUES('schema',?)").bind(String(m.v)).run();
      cur = m.v;
    }
  }

  // Compatibilidad con tablas de sábados creadas por versiones anteriores.
  // Añade únicamente columnas ausentes; nunca borra ni reemplaza datos.
  const columnas = {
    sabados: {
      hora: 'TEXT',
      titulo: "TEXT NOT NULL DEFAULT 'Sábado'",
      descripcion: 'TEXT',
      categoria: "TEXT NOT NULL DEFAULT 'Cuaresma'",
      estado: "TEXT NOT NULL DEFAULT 'abierto'",
      creado_por: 'INTEGER',
    },
    asistencias_sabado: {
      asiste: 'INTEGER NOT NULL DEFAULT 1',
      acompanantes: 'INTEGER NOT NULL DEFAULT 0',
      detalle_acompanantes: 'TEXT',
      alergias: "TEXT NOT NULL DEFAULT ''",
      observaciones: 'TEXT',
      actualizado: "TEXT NOT NULL DEFAULT ''",
    },
    consumos_sabado: {
      copas: 'INTEGER NOT NULL DEFAULT 0',
      refrescos: 'INTEGER NOT NULL DEFAULT 0',
      actualizado: "TEXT NOT NULL DEFAULT ''",
    },
  };
  for (const [tabla, campos] of Object.entries(columnas)) {
    for (const [columna, definicion] of Object.entries(campos)) {
      await ensureColumn(db, tabla, columna, definicion);
    }
  }

  // Copia histórica de alergias a las tablas nuevas una sola vez.
  const migradas = await db.prepare("SELECT valor FROM meta WHERE clave='lts_alergias_migradas'").first();
  if (!migradas) {
    await db.prepare(`INSERT OR IGNORE INTO lts_perfil_alergias(hermana_id,alergias,observaciones)
      SELECT hermana_id,COALESCE(alergias,''),observaciones FROM alergias_hermanas`).run();
    await db.prepare(`INSERT OR IGNORE INTO lts_alergias_evento(sabado_id,hermana_id,persona_tipo,persona_numero,alergias,observaciones)
      SELECT sabado_id,hermana_id,'hermana',0,COALESCE(alergias,''),observaciones
      FROM asistencias_sabado
      WHERE COALESCE(alergias,'')<>'' OR COALESCE(observaciones,'')<>''`).run();
    await db.prepare("INSERT OR REPLACE INTO meta(clave,valor) VALUES('lts_alergias_migradas','1')").run();
  }
}
