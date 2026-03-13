import Database from 'better-sqlite3';
import { config } from './config.js';

export const db = new Database(config.dbPath);

// Inicializar el esquema de la base de datos
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT,
    tool_calls TEXT,
    tool_call_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);

export interface MessageRow {
    role: string;
    content: string | null;
    tool_calls: string | null;
    tool_call_id: string | null;
}

export function saveMessage(userId: number, message: MessageRow) {
    const stmt = db.prepare(`
        INSERT INTO messages (user_id, role, content, tool_calls, tool_call_id)
        VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(
        userId,
        message.role,
        message.content,
        message.tool_calls,
        message.tool_call_id
    );
}

export function getHistory(userId: number, limit: number = 50): MessageRow[] {
    const stmt = db.prepare(`
        SELECT role, content, tool_calls, tool_call_id 
        FROM messages 
        WHERE user_id = ? 
        ORDER BY id DESC 
        LIMIT ?
    `);
    const results = stmt.all(userId, limit) as MessageRow[];
    return results.reverse(); // Devolver cronológico para el LLM
}
