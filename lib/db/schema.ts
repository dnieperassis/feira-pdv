import type Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'

export function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categorias (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      nome      TEXT    NOT NULL,
      ordem     INTEGER DEFAULT 0,
      ativo     INTEGER DEFAULT 1,
      criado_em TEXT    DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS produtos (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      categoria_id      INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
      nome              TEXT    NOT NULL,
      preco             REAL    NOT NULL CHECK(preco >= 0),
      descricao         TEXT,
      disponivel        INTEGER DEFAULT 1,
      estoque_atual     REAL    DEFAULT 0,
      estoque_minimo    REAL    DEFAULT 0,
      controla_estoque  INTEGER DEFAULT 0,
      criado_em         TEXT    DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS mesas (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      numero     INTEGER NOT NULL UNIQUE,
      nome       TEXT,
      status     TEXT    DEFAULT 'livre' CHECK(status IN ('livre','ocupada','aguardando')),
      capacidade INTEGER DEFAULT 4,
      posicao_x  INTEGER DEFAULT 0,
      posicao_y  INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS comandas (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      mesa_id     INTEGER REFERENCES mesas(id) ON DELETE SET NULL,
      tipo        TEXT    DEFAULT 'mesa' CHECK(tipo IN ('mesa','balcao')),
      status      TEXT    DEFAULT 'aberta' CHECK(status IN ('aberta','fechada','cancelada')),
      observacao  TEXT,
      aberta_em   TEXT    DEFAULT (datetime('now','localtime')),
      fechada_em  TEXT,
      total       REAL    DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS comanda_itens (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      comanda_id     INTEGER NOT NULL REFERENCES comandas(id) ON DELETE CASCADE,
      produto_id     INTEGER NOT NULL REFERENCES produtos(id),
      quantidade     REAL    NOT NULL DEFAULT 1 CHECK(quantidade > 0),
      preco_unitario REAL    NOT NULL CHECK(preco_unitario >= 0),
      total          REAL    NOT NULL,
      observacao     TEXT,
      status         TEXT    DEFAULT 'pendente'
                     CHECK(status IN ('pendente','produzindo','pronto','entregue','cancelado')),
      lancado_em     TEXT    DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS pagamentos (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      comanda_id  INTEGER NOT NULL REFERENCES comandas(id) ON DELETE CASCADE,
      forma       TEXT    NOT NULL CHECK(forma IN ('dinheiro','pix','cartao_debito','cartao_credito')),
      valor       REAL    NOT NULL CHECK(valor > 0),
      troco       REAL    DEFAULT 0,
      pago_em     TEXT    DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS movimentacoes_caixa (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo        TEXT    NOT NULL CHECK(tipo IN ('abertura','sangria','reforco','fechamento')),
      valor       REAL    NOT NULL,
      observacao  TEXT,
      criado_em   TEXT    DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS estoque_movimentacoes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      produto_id  INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
      tipo        TEXT    NOT NULL CHECK(tipo IN ('entrada','saida','ajuste')),
      quantidade  REAL    NOT NULL,
      motivo      TEXT,
      criado_em   TEXT    DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS configuracoes (
      chave TEXT PRIMARY KEY,
      valor TEXT
    );

    CREATE TABLE IF NOT EXISTS operadores (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      nome       TEXT    NOT NULL,
      codigo     TEXT    NOT NULL UNIQUE,
      senha_hash TEXT    NOT NULL,
      perfil     TEXT    NOT NULL DEFAULT 'operador' CHECK(perfil IN ('admin','operador')),
      ativo      INTEGER DEFAULT 1,
      criado_em  TEXT    DEFAULT (datetime('now','localtime'))
    );
  `)

  // Migração: coluna perfil em operadores
  const colsOp = db.prepare("PRAGMA table_info(operadores)").all() as { name: string }[]
  if (!colsOp.find(c => c.name === 'perfil')) {
    db.exec("ALTER TABLE operadores ADD COLUMN perfil TEXT NOT NULL DEFAULT 'operador'")
    db.exec("UPDATE operadores SET perfil = 'admin' WHERE codigo = '0000'")
  }

  // Migração: operador_id em comandas (para relatório por garçom)
  const colsCo = db.prepare("PRAGMA table_info(comandas)").all() as { name: string }[]
  if (!colsCo.find(c => c.name === 'operador_id')) {
    db.exec("ALTER TABLE comandas ADD COLUMN operador_id INTEGER REFERENCES operadores(id) ON DELETE SET NULL")
  }

  seedInicial(db)
  seedAdm(db)
}

function seedAdm(db: Database.Database) {
  const adm = db.prepare("SELECT id FROM operadores WHERE codigo = '0000'").get()
  if (adm) return
  const hash = bcrypt.hashSync('0000', 8)
  db.prepare(`
    INSERT INTO operadores (nome, codigo, senha_hash, perfil)
    VALUES ('Administrador', '0000', ?, 'admin')
  `).run(hash)
}

function seedInicial(db: Database.Database) {
  const jaSeeded = db.prepare('SELECT COUNT(*) as c FROM categorias').get() as { c: number }
  if (jaSeeded.c > 0) return

  const insertCat  = db.prepare('INSERT INTO categorias (nome, ordem) VALUES (?, ?)')
  const insertProd = db.prepare('INSERT INTO produtos (categoria_id, nome, preco, disponivel) VALUES (?, ?, ?, 1)')
  const insertMesa = db.prepare('INSERT INTO mesas (numero, nome, capacidade, posicao_x, posicao_y) VALUES (?, ?, ?, ?, ?)')

  db.transaction(() => {
    const salgados   = insertCat.run('Salgados',   1).lastInsertRowid
    const pasteis    = insertCat.run('Pastéis',    2).lastInsertRowid
    const bebidas    = insertCat.run('Bebidas',    3).lastInsertRowid
    const caldos     = insertCat.run('Caldos',     4).lastInsertRowid
    const sobremesas = insertCat.run('Sobremesas', 5).lastInsertRowid

    insertProd.run(salgados,   'Coxinha',              4.00)
    insertProd.run(salgados,   'Esfiha',                3.50)
    insertProd.run(salgados,   'Quibe',                 3.50)
    insertProd.run(salgados,   'Risole',                3.50)
    insertProd.run(salgados,   'Empada',                4.50)
    insertProd.run(pasteis,    'Pastel de Queijo',      7.00)
    insertProd.run(pasteis,    'Pastel de Frango',      8.00)
    insertProd.run(pasteis,    'Pastel de Carne',       8.00)
    insertProd.run(pasteis,    'Pastel de Pizza',       8.50)
    insertProd.run(pasteis,    'Pastel de Camarão',    10.00)
    insertProd.run(bebidas,    'Caldo de Cana',         6.00)
    insertProd.run(bebidas,    'Água 500ml',            3.00)
    insertProd.run(bebidas,    'Refrigerante Lata',     5.00)
    insertProd.run(bebidas,    'Suco Natural',          7.00)
    insertProd.run(caldos,     'Caldo Verde',           8.00)
    insertProd.run(caldos,     'Caldo de Mocotó',       9.00)
    insertProd.run(sobremesas, 'Churros',               5.00)
    insertProd.run(sobremesas, 'Pastel de Doce Leite',  8.00)

    for (let i = 1; i <= 10; i++) {
      insertMesa.run(i, `Mesa ${i}`, 4, ((i - 1) % 5) * 160, Math.floor((i - 1) / 5) * 140)
    }
  })()
}
