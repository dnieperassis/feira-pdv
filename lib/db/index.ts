import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { migrate } from './schema'

const DB_PATH = path.join(process.cwd(), 'data', 'feira.db')

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
