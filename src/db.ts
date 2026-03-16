import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { config } from './config.js';
import fs from 'fs';
import path from 'path';

import Database from 'better-sqlite3';

// Determinar la ruta de credenciales, soportando Render de forma nativa
const secretRenderPath = '/etc/secrets/service-account.json';
const localPath = config.googleCredentials ? path.resolve(config.googleCredentials) : '';

let finalCredsPath = localPath;
if (fs.existsSync(secretRenderPath)) {
    finalCredsPath = secretRenderPath; // Render inyecta esto automáticamente aquí
}

// Determinar si usamos Firebase o SQLite ( fallback )
const useFirebase = Boolean(finalCredsPath && fs.existsSync(finalCredsPath));

let db: any;
let sqliteDb: any;

if (useFirebase) {
    console.log(`🚀 Conectando a Firebase Cloud Firestore usando credentials en: ${finalCredsPath}`);
    if (!getApps().length) {
        initializeApp({
            credential: cert(finalCredsPath)
        });
    }
    db = getFirestore();
} else {
    console.log('⚠️ No se encontró service-account.json. Usando SQLite local por ahora.');
    sqliteDb = new Database(config.dbPath);
    sqliteDb.pragma('journal_mode = WAL');
    sqliteDb.exec(`
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
}


export interface MessageRow {
    role: string;
    content: string | null;
    tool_calls?: string | null;
    tool_call_id?: string | null;
    created_at?: any;
}

export async function saveMessage(userId: number, message: MessageRow) {
    if (useFirebase) {
        const docRef = db.collection('chats').doc(userId.toString()).collection('messages').doc();
        await docRef.set({
            role: message.role,
            content: message.content || null,
            tool_calls: message.tool_calls || null,
            tool_call_id: message.tool_call_id || null,
            created_at: FieldValue.serverTimestamp()
        });
    } else {
        const stmt = sqliteDb.prepare(`
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
}

export async function getHistory(userId: number, limit: number = 50): Promise<MessageRow[]> {
    if (useFirebase) {
        const snapshot = await db.collection('chats')
            .doc(userId.toString())
            .collection('messages')
            .orderBy('created_at', 'desc')
            .limit(limit)
            .get();

        const messages: MessageRow[] = [];
        snapshot.forEach((doc: any) => {
            const data = doc.data();
            messages.push({
                role: data.role,
                content: data.content,
                tool_calls: data.tool_calls,
                tool_call_id: data.tool_call_id,
                created_at: data.created_at
            });
        });

        return messages.reverse();
    } else {
        const stmt = sqliteDb.prepare(`
            SELECT role, content, tool_calls, tool_call_id 
            FROM messages 
            WHERE user_id = ? 
            ORDER BY id DESC 
            LIMIT ?
        `);
        const results = stmt.all(userId, limit) as MessageRow[];
        return results.reverse();
    }
}
