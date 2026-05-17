import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('sprout-about.db');

export function initDatabase() {
  db.execSync(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );`
  );
}

export async function hashPassword(password: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);
}

export async function registerUser(
  username: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const hash = await hashPassword(password);
    db.runSync(
      'INSERT INTO users (username, password_hash) VALUES (?, ?);',
      username,
      hash
    );
    return { success: true };
  } catch (e: any) {
    if (e?.message?.includes('UNIQUE constraint failed')) {
      return { success: false, error: 'Username is already taken.' };
    }
    return { success: false, error: 'Something went wrong. Please try again.' };
  }
}

export async function loginUser(
  username: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const hash = await hashPassword(password);
    const user = db.getFirstSync<{ id: number }>(
      'SELECT id FROM users WHERE username = ? AND password_hash = ?;',
      username,
      hash
    );
    if (user) {
      return { success: true };
    }
    return { success: false, error: 'Invalid username or password.' };
  } catch {
    return { success: false, error: 'Something went wrong. Please try again.' };
  }
}
