// backend/database/setupDatabase.js
// You can copy-paste the whole file content below

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt'); // Import bcrypt

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
  db.serialize(async () => { // Make serialize callback async for bcrypt
    console.log('Creating/updating tables if they do not exist...');

    // Memes Table (ensure columns exist, might need manual ALTER if run before)
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
    // Use a Promise to wait for table creation if needed
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


    // *** NEW: Users Table ***
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


    // *** Optional: Add a default admin user (example) ***
    // const adminUsername = 'admin';
    // const adminEmail = 'admin@example.com';
    // const adminPassword = 'password123'; // CHANGE THIS IN A REAL APP
    // const saltRounds = 10;

    // // Check if admin exists
    // db.get("SELECT id FROM users WHERE username = ?", [adminUsername], async (err, row) => {
    //     if (err) {
    //         console.error("Error checking for admin user:", err.message);
    //     } else if (!row) {
    //         // Admin doesn't exist, create one
    //         console.log("Admin user not found, creating one...");
    //         try {
    //             const hashedPassword = await bcrypt.hash(adminPassword, saltRounds);
    //             db.run("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
    //                 [adminUsername, adminEmail, hashedPassword],
    //                 (insertErr) => {
    //                     if (insertErr) {
    //                         console.error("Error creating admin user:", insertErr.message);
    //                     } else {
    //                         console.log("Default admin user created.");
    //                     }
    //                     closeDatabase(); // Close after attempting creation
    //                 }
    //             );
    //         } catch (hashError) {
    //             console.error("Error hashing admin password:", hashError);
    //             closeDatabase(); // Close on hash error
    //         }
    //     } else {
    //         // Admin exists, just close DB
    //         console.log("Admin user already exists.");
    //         closeDatabase();
    //     }
    // });
     // If not adding admin user logic above, close DB here:
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