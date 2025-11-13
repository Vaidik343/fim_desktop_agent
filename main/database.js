const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'fim_agent.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT,
      event_type TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS files_baseline (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT UNIQUE,
      hash TEXT,
      size INTEGER,
      modifiedAt DATETIME
    )
  `);
});

function insertEvent(filePath, eventType) {
  db.run(`INSERT INTO events (file_path, event_type) VALUES (?, ?)`, [filePath, eventType]);
}

function getAllEvents(callback) {
  db.all(`SELECT * FROM events ORDER BY timestamp DESC`, callback);
}

function getBaselineHash(filePath, callback) {
  db.get(`SELECT * FROM files_baseline WHERE file_path = ?`, [filePath], callback);
}

function updateBaseline(filePath, hash, size, modifiedAt) {
  db.run(
    `INSERT INTO files_baseline (file_path, hash, size, modifiedAt)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(file_path) DO UPDATE SET hash = excluded.hash, size = excluded.size, modifiedAt = excluded.modifiedAt`,
    [filePath, hash, size, modifiedAt]
  );
}

function removeBaseline(filePath) {
  db.run(`DELETE FROM files_baseline WHERE file_path = ?`, [filePath]);
}

module.exports = {
  insertEvent,
  getAllEvents,
  getBaselineHash,
  updateBaseline,
  removeBaseline
};
