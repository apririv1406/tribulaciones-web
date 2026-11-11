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
]; 

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
}
