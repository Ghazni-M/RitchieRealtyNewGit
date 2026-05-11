// src/db.ts
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import fs from 'fs';

// ───────────────────────────────────────────────────────────────
// IMAGE PATHS
// ───────────────────────────────────────────────────────────────
const images = {
  main: '/images/Active-RitchieMain.jpg',
  r01: '/images/Active-Ritchie-01.jpg',
  r02: '/images/Active-Ritchie-02.jpg',
  r03: '/images/Active-Ritchie-03.jpg',
  r04: '/images/Active-Ritchie-04.jpg',
  rhmain: '/images/Ritchie-Har-Main.jpg',
  rh01: '/images/Ritchie-Har-01.jpg',
  rh02: '/images/Ritchie-Har-02.jpg',
  rh03: '/images/Ritchie-Har-03.jpg',
  rh04: '/images/Ritchie-Har-04.jpg',        // Fixed duplicate
} as const;

// ───────────────────────────────────────────────────────────────
// PATH SETUP
// ───────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Persistent Database Path (Critical for Render / Production)
const dbPath = process.env.NODE_ENV === 'production'
  ? '/opt/render/project/src/database/database.db'   // Render persistent disk
  : path.resolve(__dirname, '../database.db');       // Local

console.log(`📁 Using SQLite database at: ${dbPath}`);

// Ensure database directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log(`📁 Created database directory: ${dbDir}`);
}

const db = new Database(dbPath, {
  verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
});

// ───────────────────────────────────────────────────────────────
// PRAGMAS
// ───────────────────────────────────────────────────────────────
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

// ───────────────────────────────────────────────────────────────
// SCHEMA
// ───────────────────────────────────────────────────────────────
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL COLLATE NOCASE,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('owner', 'agent')) DEFAULT 'agent',
  reset_token TEXT,
  reset_token_expiry INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS properties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  price REAL NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT NOT NULL,
  beds INTEGER NOT NULL DEFAULT 0,
  baths REAL NOT NULL DEFAULT 0,
  sqft INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Available',
  featured INTEGER DEFAULT 0,
  imageUrl TEXT,
  images TEXT NOT NULL DEFAULT '[]',
  videoUrl TEXT,
  virtualTourUrl TEXT,
  description TEXT NOT NULL DEFAULT '',
  features TEXT NOT NULL DEFAULT '[]',
  acreage REAL DEFAULT 0,
  zoning TEXT,
  agent_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS inquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'New',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  excerpt TEXT NOT NULL,
  content TEXT NOT NULL,
  imageUrl TEXT,
  author_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  source TEXT DEFAULT 'blog_post',
  subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  confirmed BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  property_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, property_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (property_id) REFERENCES properties(id)
);

CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_featured ON properties(featured);
CREATE INDEX IF NOT EXISTS idx_properties_agent_id ON properties(agent_id);
CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);
CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON inquiries(created_at);
`);

// ───────────────────────────────────────────────────────────────
// TRIGGERS
// ───────────────────────────────────────────────────────────────
db.exec(`
CREATE TRIGGER IF NOT EXISTS trg_properties_updated
AFTER UPDATE ON properties
FOR EACH ROW
BEGIN
  UPDATE properties SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_posts_updated
AFTER UPDATE ON posts
FOR EACH ROW
BEGIN
  UPDATE posts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
`);

// ───────────────────────────────────────────────────────────────
// MIGRATION HELPER
// ───────────────────────────────────────────────────────────────
function addColumnIfNotExists(table: string, column: string, definition: string) {
  try {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
    if (!columns.some((c: any) => c.name === column)) {
      db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
      console.log(`✅ Added column ${column} to ${table}`);
    }
  } catch (err) {
    console.warn(`Migration skipped for ${table}.${column}`);
  }
}

// Run migrations
addColumnIfNotExists('users', 'reset_token', 'TEXT');
addColumnIfNotExists('users', 'reset_token_expiry', 'INTEGER');

// ───────────────────────────────────────────────────────────────
// SEEDING (Idempotent)
// ───────────────────────────────────────────────────────────────
const seedTables = ['users', 'properties', 'posts'] as const;

for (const table of seedTables) {
  const count = (db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as any).count;

  if (count > 0) continue;

  console.log(`🌱 Seeding ${table}...`);

  if (table === 'users') {
    const hash = (p: string) => bcrypt.hashSync(p, 12);

    db.prepare(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`)
      .run('Administrator', 'admin@ritchierealty.com', hash('admin123'), 'owner');

    db.prepare(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`)
      .run('Janet Stanley', 'janet@ritchierealty.com', hash('janet123'), 'agent');
  }

  if (table === 'properties') {
    // First Property
    db.prepare(`
      INSERT INTO properties (title, price, address, city, state, zip, beds, baths, sqft, type, status, featured, 
        imageUrl, images, description, features, acreage, zoning, agent_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'Serene Riverside Villa',
      35000,
      '43 Carroll St',
      'Cairo',
      'WV',
      '26337',
      3, 2, 1370,
      'Residential',
      'Available',
      1,
      images.main,
      JSON.stringify([images.r01, images.r02, images.r03, images.r04]),
      'This charming 2-story home is located just moments from the scenic Hughes River...',
      JSON.stringify(['Nine Rooms', 'Updated Kitchen', 'Central A/C', 'River View', 'and More.']),
      0.5,
      'Residential',
      2
    );

    // Second Property (New Brick Ranch)
    db.prepare(`
      INSERT INTO properties (title, price, address, city, state, zip, beds, baths, sqft, type, status, featured, 
        imageUrl, images, description, features, acreage, zoning, agent_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'Charming Brick Ranch with Spacious Yard',
      48900,
      '429 N Penn Ave',
      'Harrisville',
      'WV',
      '26362',
      2, 1.5, 1840,
      'Residential',
      'Available',
      1,
      images.rhmain,
      JSON.stringify([images.rh01, images.rh02, images.rh03, images.rh04]),
      'Welcome to this charming brick ranch home offering single-level living at its finest. Featuring a spacious yard, attached garage, and classic curb appeal.',
      JSON.stringify([
        'Spacious Rooms',
        'First Floor Primary Bedroom',
        'Central A/C',
        'Natural Gas',
        'Detached Garage'
      ]),
      0.8,
      'Residential',
      2
    );
  }

  if (table === 'posts') {
    const postContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Real Estate Investment Tips for Beginners in Pennsboro, WV</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background: #f9f9f9; color: #333; }
    .container { max-width: 900px; margin: auto; padding: 20px; background: #fff; }
    h1, h2, h3 { color: #0B1F3B; }
    h1 { border-bottom: 3px solid #F5B301; padding-bottom: 10px; }
    .tip { background: #e8f4ff; padding: 10px; border-left: 5px solid #0B1F3B; margin: 15px 0; }
    .warning { background: #ffeaea; padding: 10px; border-left: 5px solid #E74C3C; margin: 15px 0; }
    .highlight { background: #fff8e1; padding: 10px; border-left: 5px solid #F5B301; margin: 15px 0; }
  </style>
</head>
<body>
<div class="container">
  <h1>🏡 Real Estate Investment Tips for Beginners in Pennsboro, WV</h1>
  <p>Starting your journey in real estate can feel overwhelming—especially if you're new...</p>
  <!-- Full content here (kept short for brevity) -->
</div>
</body>
</html>`;

    db.prepare(`
      INSERT INTO posts (title, slug, excerpt, content, imageUrl, author_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      'Real Estate Investment Tips for Beginners',
      'real-estate-investment-tips-beginners',
      'New to real estate investing? Learn essential tips...',
      postContent,
      'https://images.unsplash.com/photo-1560518883-ce09059eeffa',
      1
    );
  }
}

console.log('✅ Database initialized successfully with persistent storage support');

export default db;
