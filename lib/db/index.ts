import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { migrate } from './schema'

// Em produção (Railway/Render), definir DB_PATH via variável de ambiente
// apontando para o volume persistente. Ex: DB_PATH=/data/feira.db
const DB_PATH = process.env.DB_PATH
  ? process.env.DB_PATH
  : path.join(process.cwd(), 'data', 'feira.db')

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (_db) return _db

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

  _db = new Database(DB_PATH)
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')
  _db.pragma('synchronous = NORMAL')

  migrate(_db)

  return _db
}
