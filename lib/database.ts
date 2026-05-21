import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('sprout-about.db');

export function initDatabase() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS garden_beds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS plants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bed_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      planted_date TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS plant_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plant_id INTEGER NOT NULL,
      photo_uri TEXT NOT NULL,
      taken_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS fertilizer_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plant_id INTEGER NOT NULL,
      fertilizer_type TEXT NOT NULL,
      fertilized_at TEXT NOT NULL,
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS plant_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plant_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS plant_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plant_id INTEGER NOT NULL UNIQUE,
      scheduled_for TEXT NOT NULL,
      notification_id TEXT,
      repeat_days INTEGER,
      notification_time TEXT
    );
    CREATE TABLE IF NOT EXISTS garden_layout (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      canvas_width_ft REAL DEFAULT 20,
      canvas_height_ft REAL DEFAULT 15
    );
    CREATE TABLE IF NOT EXISTS layout_shapes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      bed_id INTEGER,
      shape_type TEXT NOT NULL DEFAULT 'rectangle',
      x REAL NOT NULL DEFAULT 0,
      y REAL NOT NULL DEFAULT 0,
      width_ft REAL NOT NULL DEFAULT 4,
      height_ft REAL NOT NULL DEFAULT 4,
      label TEXT,
      color TEXT DEFAULT '#c8e6c9',
      rotation REAL DEFAULT 0
    );
  `);
  // Migrate existing installs that predate the repeat columns
  try { db.execSync('ALTER TABLE plant_schedules ADD COLUMN repeat_days INTEGER;'); } catch {}
  try { db.execSync('ALTER TABLE plant_schedules ADD COLUMN notification_time TEXT;'); } catch {}
  try { db.execSync('ALTER TABLE layout_shapes ADD COLUMN rotation REAL DEFAULT 0;'); } catch {}
}

async function hashPassword(password: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);
}

export async function registerUser(
  username: string,
  password: string
): Promise<{ success: boolean; userId?: number; error?: string }> {
  try {
    const hash = await hashPassword(password);
    db.runSync('INSERT INTO users (username, password_hash) VALUES (?, ?);', username, hash);
    const user = db.getFirstSync<{ id: number }>('SELECT id FROM users WHERE username = ?;', username);
    return { success: true, userId: user?.id };
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
): Promise<{ success: boolean; userId?: number; error?: string }> {
  try {
    const hash = await hashPassword(password);
    const user = db.getFirstSync<{ id: number }>(
      'SELECT id FROM users WHERE username = ? AND password_hash = ?;',
      username,
      hash
    );
    if (user) {
      return { success: true, userId: user.id };
    }
    return { success: false, error: 'Invalid username or password.' };
  } catch {
    return { success: false, error: 'Something went wrong. Please try again.' };
  }
}

// Garden Beds

export type GardenBed = { id: number; name: string; created_at: string };

export function getGardenBeds(userId: number): GardenBed[] {
  return db.getAllSync<GardenBed>(
    'SELECT id, name, created_at FROM garden_beds WHERE user_id = ? ORDER BY created_at ASC;',
    userId
  );
}

export function getGardenBed(id: number): GardenBed | null {
  return db.getFirstSync<GardenBed>('SELECT id, name, created_at FROM garden_beds WHERE id = ?;', id) ?? null;
}

export function addGardenBed(userId: number, name: string): void {
  db.runSync('INSERT INTO garden_beds (user_id, name) VALUES (?, ?);', userId, name);
}

export function renameGardenBed(id: number, name: string): void {
  db.runSync('UPDATE garden_beds SET name = ? WHERE id = ?;', name, id);
}

export function deleteGardenBed(id: number): void {
  const plants = db.getAllSync<{ id: number }>('SELECT id FROM plants WHERE bed_id = ?;', id);
  for (const plant of plants) {
    deletePlant(plant.id);
  }
  db.runSync('DELETE FROM garden_beds WHERE id = ?;', id);
}

// Plants

export type Plant = {
  id: number;
  bed_id: number;
  name: string;
  planted_date: string | null;
  notes: string | null;
  created_at: string;
};

export function getPlants(bedId: number): Plant[] {
  return db.getAllSync<Plant>(
    'SELECT id, bed_id, name, planted_date, notes, created_at FROM plants WHERE bed_id = ? ORDER BY created_at ASC;',
    bedId
  );
}

export function getPlant(id: number): Plant | null {
  return db.getFirstSync<Plant>('SELECT * FROM plants WHERE id = ?;', id) ?? null;
}

export function addPlant(bedId: number, name: string): void {
  db.runSync('INSERT INTO plants (bed_id, name) VALUES (?, ?);', bedId, name);
}

export function updatePlant(id: number, name: string, plantedDate: string | null, notes: string | null): void {
  db.runSync(
    'UPDATE plants SET name = ?, planted_date = ?, notes = ? WHERE id = ?;',
    name, plantedDate, notes, id
  );
}

export function deletePlant(id: number): void {
  db.runSync('DELETE FROM plant_photos WHERE plant_id = ?;', id);
  db.runSync('DELETE FROM fertilizer_logs WHERE plant_id = ?;', id);
  db.runSync('DELETE FROM plant_notes WHERE plant_id = ?;', id);
  db.runSync('DELETE FROM plant_schedules WHERE plant_id = ?;', id);
  db.runSync('DELETE FROM plants WHERE id = ?;', id);
}

// Plant Photos

export type PlantPhoto = { id: number; plant_id: number; photo_uri: string; taken_at: string };

export function getPlantPhotos(plantId: number): PlantPhoto[] {
  return db.getAllSync<PlantPhoto>(
    'SELECT id, plant_id, photo_uri, taken_at FROM plant_photos WHERE plant_id = ? ORDER BY taken_at ASC;',
    plantId
  );
}

export function addPlantPhoto(plantId: number, photoUri: string): void {
  db.runSync('INSERT INTO plant_photos (plant_id, photo_uri) VALUES (?, ?);', plantId, photoUri);
}

export function deletePlantPhoto(id: number): void {
  db.runSync('DELETE FROM plant_photos WHERE id = ?;', id);
}

// Fertilizer Logs

export type FertilizerLog = {
  id: number;
  plant_id: number;
  fertilizer_type: string;
  fertilized_at: string;
  notes: string | null;
};

export function getFertilizerLogs(plantId: number): FertilizerLog[] {
  return db.getAllSync<FertilizerLog>(
    'SELECT * FROM fertilizer_logs WHERE plant_id = ? ORDER BY fertilized_at DESC;',
    plantId
  );
}

export function addFertilizerLog(
  plantId: number,
  fertilizerType: string,
  fertilizedAt: string,
  notes: string | null
): void {
  db.runSync(
    'INSERT INTO fertilizer_logs (plant_id, fertilizer_type, fertilized_at, notes) VALUES (?, ?, ?, ?);',
    plantId, fertilizerType, fertilizedAt, notes
  );
}

export function deleteFertilizerLog(id: number): void {
  db.runSync('DELETE FROM fertilizer_logs WHERE id = ?;', id);
}

export const MISSED_FERTILIZER_TYPE = 'Missed scheduled fertilization';

export function updateFertilizerLog(
  id: number,
  fertilizerType: string,
  fertilizedAt: string,
  notes: string | null
): void {
  db.runSync(
    'UPDATE fertilizer_logs SET fertilizer_type = ?, fertilized_at = ?, notes = ? WHERE id = ?;',
    fertilizerType, fertilizedAt, notes, id
  );
}

// Plant Notes

export type PlantNote = {
  id: number;
  plant_id: number;
  content: string;
  created_at: string;
};

export function getPlantNotes(plantId: number): PlantNote[] {
  return db.getAllSync<PlantNote>(
    'SELECT * FROM plant_notes WHERE plant_id = ? ORDER BY created_at DESC;',
    plantId
  );
}

export function addPlantNote(plantId: number, content: string): void {
  db.runSync('INSERT INTO plant_notes (plant_id, content) VALUES (?, ?);', plantId, content);
}

export function deletePlantNote(id: number): void {
  db.runSync('DELETE FROM plant_notes WHERE id = ?;', id);
}

// Fertilizer Schedules

export type PlantSchedule = {
  plant_id: number;
  scheduled_for: string;
  notification_id: string | null;
  repeat_days: number | null;
  notification_time: string | null;
};

export function getPlantSchedule(plantId: number): PlantSchedule | null {
  return db.getFirstSync<PlantSchedule>('SELECT * FROM plant_schedules WHERE plant_id = ?;', plantId) ?? null;
}

export function upsertPlantSchedule(
  plantId: number,
  scheduledFor: string,
  notificationId: string | null,
  repeatDays: number | null,
  notificationTime: string | null
): void {
  db.runSync(
    `INSERT OR REPLACE INTO plant_schedules
       (plant_id, scheduled_for, notification_id, repeat_days, notification_time)
     VALUES (?, ?, ?, ?, ?);`,
    plantId, scheduledFor, notificationId, repeatDays, notificationTime
  );
}

export function clearPlantSchedule(plantId: number): void {
  db.runSync('DELETE FROM plant_schedules WHERE plant_id = ?;', plantId);
}

// Garden Layout

export type GardenLayout = {
  id: number;
  user_id: number;
  canvas_width_ft: number;
  canvas_height_ft: number;
};

export type LayoutShape = {
  id: number;
  user_id: number;
  bed_id: number | null;
  shape_type: 'rectangle' | 'circle';
  x: number;
  y: number;
  width_ft: number;
  height_ft: number;
  label: string | null;
  color: string;
  rotation: number;
};

export function getOrCreateLayout(userId: number): GardenLayout {
  let layout = db.getFirstSync<GardenLayout>(
    'SELECT * FROM garden_layout WHERE user_id = ?;', userId
  );
  if (!layout) {
    db.runSync(
      'INSERT INTO garden_layout (user_id, canvas_width_ft, canvas_height_ft) VALUES (?, 20, 15);',
      userId
    );
    layout = db.getFirstSync<GardenLayout>(
      'SELECT * FROM garden_layout WHERE user_id = ?;', userId
    )!;
  }
  return layout;
}

export function updateLayoutCanvas(userId: number, widthFt: number, heightFt: number): void {
  db.runSync(
    'UPDATE garden_layout SET canvas_width_ft = ?, canvas_height_ft = ? WHERE user_id = ?;',
    widthFt, heightFt, userId
  );
}

export function getLayoutShapes(userId: number): LayoutShape[] {
  return db.getAllSync<LayoutShape>(
    'SELECT * FROM layout_shapes WHERE user_id = ? ORDER BY id ASC;', userId
  );
}

export function addLayoutShape(
  userId: number,
  shapeType: 'rectangle' | 'circle',
  x: number, y: number,
  widthFt: number, heightFt: number,
  label: string | null,
  color: string
): void {
  db.runSync(
    `INSERT INTO layout_shapes (user_id, shape_type, x, y, width_ft, height_ft, label, color)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    userId, shapeType, x, y, widthFt, heightFt, label, color
  );
}

export function updateLayoutShape(
  id: number,
  label: string | null,
  widthFt: number,
  heightFt: number,
  color: string,
  bedId: number | null
): void {
  db.runSync(
    'UPDATE layout_shapes SET label = ?, width_ft = ?, height_ft = ?, color = ?, bed_id = ? WHERE id = ?;',
    label, widthFt, heightFt, color, bedId, id
  );
}

export function updateShapeTransform(id: number, x: number, y: number, rotation: number): void {
  db.runSync('UPDATE layout_shapes SET x = ?, y = ?, rotation = ? WHERE id = ?;', x, y, rotation, id);
}

export function deleteLayoutShape(id: number): void {
  db.runSync('DELETE FROM layout_shapes WHERE id = ?;', id);
}