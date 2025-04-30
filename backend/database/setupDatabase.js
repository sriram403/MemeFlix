// 1. Import the sqlite3 library
//    'verbose()' provides more detailed stack traces for debugging errors.
const sqlite3 = require('sqlite3').verbose();
const path = require('path'); // Node.js built-in module for working with file paths

// 2. Define the path to the database file
//    'path.resolve()' creates an absolute path.
//    '__dirname' is the directory where this script (setupDatabase.js) is located.
//    '../' goes up one level (to the 'backend' directory).
//    'memeflix.db' is the name of our database file.
const dbPath = path.resolve(__dirname, '../memeflix.db');

// 3. Create or open the database connection
//    If 'memeflix.db' doesn't exist, it will be created.
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    // Cannot open database
    console.error('Error opening database:', err.message);
    throw err; // Stop the script if we can't open the DB
  } else {
    console.log(`Connected to the SQLite database at ${dbPath}`);
    createTables(); // Call the function to create tables if connection is successful
  }
});

// 4. Function to define and create tables
function createTables() {
  db.serialize(() => {
    console.log('Creating tables if they do not exist...');
    const createMemeTableSql = `
      CREATE TABLE IF NOT EXISTS memes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        filename TEXT UNIQUE NOT NULL,
        type TEXT CHECK(type IN ('image', 'gif', 'video')) NOT NULL,
        tags TEXT,
        filepath TEXT NOT NULL,
        upvotes INTEGER DEFAULT 0 NOT NULL,  -- NEW: Upvote count
        downvotes INTEGER DEFAULT 0 NOT NULL, -- NEW: Downvote count
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;
    db.run(createMemeTableSql, (err) => {
      if (err) { /* ... error handling ... */ }
      else { console.log("Table 'memes' updated or already exists."); }
      closeDatabase(); // Ensure close is called after the operation
    });
  });
}

// Function to close the database connection
function closeDatabase() {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed.');
    }
  });
}