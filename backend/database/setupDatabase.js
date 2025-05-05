// backend/database/setupDatabase.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../memeflix.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    throw err;
  } else {
    console.log(`Connected to the SQLite database at ${dbPath}`);
    setupSchema();
  }
});

async function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) {
                console.error(`Error running SQL: ${sql}`, params, err.message);
                reject(err);
            } else {
                resolve(this);
            }
        });
    });
}

async function setupSchema() {
    console.log('Creating/updating tables if they do not exist...');

    try {
        // Existing Tables (Keep as is)
        await runQuery(` CREATE TABLE IF NOT EXISTS memes ( id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT, filename TEXT UNIQUE NOT NULL, type TEXT CHECK(type IN ('image', 'gif', 'video')) NOT NULL, filepath TEXT NOT NULL, upvotes INTEGER DEFAULT 0 NOT NULL, downvotes INTEGER DEFAULT 0 NOT NULL, uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP ); `);
        console.log("Table 'memes' checked/created.");
        await runQuery(` CREATE INDEX IF NOT EXISTS idx_memes_uploaded_at ON memes (uploaded_at DESC); `);
        console.log("Index 'idx_memes_uploaded_at' checked/created.");

        await runQuery(` CREATE TABLE IF NOT EXISTS users ( id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP ); `);
        console.log("Table 'users' checked/created.");
        await runQuery(` CREATE INDEX IF NOT EXISTS idx_users_username ON users (username); `);
        console.log("Index 'idx_users_username' checked/created.");
        await runQuery(` CREATE INDEX IF NOT EXISTS idx_users_email ON users (email); `);
        console.log("Index 'idx_users_email' checked/created.");

        await runQuery(` CREATE TABLE IF NOT EXISTS user_favorites ( user_id INTEGER NOT NULL, meme_id INTEGER NOT NULL, added_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE, FOREIGN KEY (meme_id) REFERENCES memes (id) ON DELETE CASCADE, PRIMARY KEY (user_id, meme_id) ); `);
        console.log("Table 'user_favorites' checked/created.");
        await runQuery(` CREATE INDEX IF NOT EXISTS idx_user_favorites_meme_id ON user_favorites (meme_id); `);
        console.log("Index 'idx_user_favorites_meme_id' checked/created.");

        await runQuery(` CREATE TABLE IF NOT EXISTS viewing_history ( id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, meme_id INTEGER NOT NULL, viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE, FOREIGN KEY (meme_id) REFERENCES memes (id) ON DELETE CASCADE ); `);
        console.log("Table 'viewing_history' checked/created.");
        await runQuery(` CREATE INDEX IF NOT EXISTS idx_viewing_history_user_time ON viewing_history (user_id, viewed_at DESC); `);
        console.log("Index 'idx_viewing_history_user_time' checked/created.");
        await runQuery(` CREATE INDEX IF NOT EXISTS idx_viewing_history_meme_id ON viewing_history (meme_id); `);
        console.log("Index 'idx_viewing_history_meme_id' checked/created.");

        await runQuery(` CREATE TABLE IF NOT EXISTS tags ( tag_id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL COLLATE NOCASE ); `);
        console.log("Table 'tags' checked/created.");
        await runQuery(` CREATE INDEX IF NOT EXISTS idx_tags_name ON tags (name); `);
        console.log("Index 'idx_tags_name' checked/created.");

        await runQuery(` CREATE TABLE IF NOT EXISTS meme_tags ( meme_id INTEGER NOT NULL, tag_id INTEGER NOT NULL, FOREIGN KEY (meme_id) REFERENCES memes (id) ON DELETE CASCADE, FOREIGN KEY (tag_id) REFERENCES tags (tag_id) ON DELETE CASCADE, PRIMARY KEY (meme_id, tag_id) ); `);
        console.log("Table 'meme_tags' checked/created.");
        await runQuery(` CREATE INDEX IF NOT EXISTS idx_meme_tags_tag_id ON meme_tags (tag_id); `);
        console.log("Index 'idx_meme_tags_tag_id' checked/created.");

        // --- *** NEW: User Votes Table *** ---
        await runQuery(`
            CREATE TABLE IF NOT EXISTS user_votes (
                user_id INTEGER NOT NULL,
                meme_id INTEGER NOT NULL,
                vote_type INTEGER NOT NULL CHECK(vote_type IN (1, -1)), -- 1 for upvote, -1 for downvote
                voted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (meme_id) REFERENCES memes (id) ON DELETE CASCADE,
                PRIMARY KEY (user_id, meme_id) -- Ensures one vote per user per meme
            );
        `);
        console.log("Table 'user_votes' checked/created.");

        // Optional: Index for quickly finding all votes for a meme (useful for vote counts if needed later)
        await runQuery(`
            CREATE INDEX IF NOT EXISTS idx_user_votes_meme_id ON user_votes (meme_id);
        `);
        console.log("Index 'idx_user_votes_meme_id' checked/created.");
        // Index on user_id is covered by PRIMARY KEY

        console.log('Database schema setup complete.');

    } catch (err) {
        console.error('Error setting up database schema:', err.message);
    } finally {
        closeDatabase();
    }
}

function closeDatabase() {
  db.close((err) => {
    if (err) { console.error('Error closing database:', err.message); }
    else { console.log('Database connection closed after setup.'); }
  });
}