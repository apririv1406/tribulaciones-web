
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
    `ALTER TABLE noticias ADD COLUMN visible_web INTEGER NOT NULL DEFAULT 1`,
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
