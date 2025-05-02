// backend/database/setupDatabase.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = path.resolve(__dirname, '../memeflix.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    throw err;
  } else {
    console.log(`Connected to the SQLite database at ${dbPath}`);
    createTables();
  }
});

function createTables() {
  db.serialize(async () => {
    console.log('Creating/updating tables if they do not exist...');

    // Memes Table
    const createMemeTableSql = `
      CREATE TABLE IF NOT EXISTS memes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        filename TEXT UNIQUE NOT NULL,
        type TEXT CHECK(type IN ('image', 'gif', 'video')) NOT NULL,
        tags TEXT,
        filepath TEXT NOT NULL,
        upvotes INTEGER DEFAULT 0 NOT NULL,
        downvotes INTEGER DEFAULT 0 NOT NULL,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await new Promise((resolve, reject) => {
        db.run(createMemeTableSql, (err) => {
          if (err) {
              console.error('Error creating/checking memes table:', err.message);
              reject(err);
          } else {
              console.log("Table 'memes' checked/created.");
              resolve();
          }
        });
    });

    // Users Table
    const createUserTableSql = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;
     await new Promise((resolve, reject) => {
        db.run(createUserTableSql, (err) => {
            if (err) {
                console.error('Error creating users table:', err.message);
                reject(err);
            } else {
                console.log("Table 'users' created or already exists.");
                resolve();
            }
        });
     });

    // *** NEW: User Favorites Table ***
    const createUserFavoritesTableSql = `
      CREATE TABLE IF NOT EXISTS user_favorites (
          user_id INTEGER NOT NULL,
          meme_id INTEGER NOT NULL,
          added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
          FOREIGN KEY (meme_id) REFERENCES memes (id) ON DELETE CASCADE,
          PRIMARY KEY (user_id, meme_id) -- Ensure unique combination
      );
    `;
     await new Promise((resolve, reject) => {
        db.run(createUserFavoritesTableSql, (err) => {
            if (err) {
                console.error('Error creating user_favorites table:', err.message);
                reject(err);
            } else {
                console.log("Table 'user_favorites' created or already exists.");
                resolve();
            }
        });
     });

     closeDatabase();
  });
}

function closeDatabase() {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed.');
    }
  });
}