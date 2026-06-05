// ── Script de limpeza do banco de dados ─────────────────────────────────────
// Apaga todos os dados operacionais preservando:
//   - configuracoes (nome, cidade, PIX, impressora, etc.)
//   - operador ADM (codigo 0000)
// Uso: node scripts/limpar-banco.js

const path   = require('path')
const fs     = require('fs')

// Localiza o banco SQLite
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'feira.db')

if (!fs.existsSync(DB_PATH)) {
  console.error('❌ Banco não encontrado em:', DB_PATH)
  console.error('   Execute no diretório do projeto ou defina DB_PATH=...')
  process.exit(1)
}

const Database = require('better-sqlite3')
const db = new Database(DB_PATH)

db.pragma('foreign_keys = OFF')  // desativa FK para limpar sem conflitos

console.log('🗑️  Limpando banco de dados...')
console.log('   Arquivo:', DB_PATH)
console.log()

const limpar = db.transaction(() => {
  // 1. Apaga movimentações e histórico financeiro
  const movs = db.prepare('DELETE FROM movimentacoes_caixa').run()
  console.log(`   movimentacoes_caixa: ${movs.changes} registros removidos`)

  const pags = db.prepare('DELETE FROM pagamentos').run()
  console.log(`   pagamentos:          ${pags.changes} registros removidos`)

  const estoq = db.prepare('DELETE FROM estoque_movimentacoes').run()
  console.log(`   estoque_movimentacoes: ${estoq.changes} registros removidos`)

  // 2. Apaga itens das comandas
  const itens = db.prepare('DELETE FROM comanda_itens').run()
  console.log(`   comanda_itens:       ${itens.changes} registros removidos`)

  // 3. Apaga comandas
  const coms = db.prepare('DELETE FROM comandas').run()
  console.log(`   comandas:            ${coms.changes} registros removidos`)

  // 4. Apaga produtos e categorias (dados de exemplo)
  const prods = db.prepare('DELETE FROM produtos').run()
  console.log(`   produtos:            ${prods.changes} registros removidos`)

  const cats = db.prepare('DELETE FROM categorias').run()
  console.log(`   categorias:          ${cats.changes} registros removidos`)

  // 5. Apaga mesas (serão recriadas conforme configuração)
  const mesas = db.prepare('DELETE FROM mesas').run()
  console.log(`   mesas:               ${mesas.changes} registros removidos`)

  // 6. Apaga operadores EXCETO o ADM (codigo 0000)
  const ops = db.prepare("DELETE FROM operadores WHERE codigo != '0000'").run()
  console.log(`   operadores extras:   ${ops.changes} registros removidos`)

  // 7. Marca flag para não re-semear dados de exemplo
  db.prepare(`
    INSERT INTO configuracoes (chave, valor) VALUES ('skip_seed', '1')
    ON CONFLICT(chave) DO UPDATE SET valor = '1'
  `).run()
  console.log(`   skip_seed flag:      ativado (não vai re-popular dados de exemplo)`)

  // 8. Reseta auto-increment
  db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('categorias','produtos','mesas','comandas','comanda_itens','pagamentos','movimentacoes_caixa','estoque_movimentacoes','operadores')").run()
})

limpar()

db.pragma('foreign_keys = ON')

// Compacta o banco (libera espaço em disco)
db.pragma('vacuum')

console.log()
console.log('✅ Banco limpo com sucesso!')
console.log()
console.log('Preservado:')
console.log('   ✓ Configurações (nome, cidade, PIX, impressora...)')
console.log('   ✓ Usuário ADM (código 0000, PIN 0000)')
console.log()
console.log('Próximos passos:')
console.log('   1. Reinicie o servidor (npm start)')
console.log('   2. Acesse Configurações → defina número de mesas')
console.log('   3. Acesse Cardápio → cadastre categorias e produtos')
console.log('   4. Acesse Configurações → cadastre os operadores/garçons')
console.log()
