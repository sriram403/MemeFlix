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
  // Use 'db.serialize()' to ensure statements run sequentially (one after another)
  db.serialize(() => {
    console.log('Creating tables if they do not exist...');

    // SQL command to create the 'memes' table
    // 'IF NOT EXISTS' prevents errors if the script is run again
    const createMemeTableSql = `
      CREATE TABLE IF NOT EXISTS memes (
        id INTEGER PRIMARY KEY AUTOINCREMENT, -- Unique ID for each meme, automatically generated
        title TEXT NOT NULL,                  -- Title of the meme (must have a value)
        description TEXT,                     -- Optional description
        filename TEXT UNIQUE NOT NULL,        -- The unique name of the image/gif/video file (must have a value and be unique)
        type TEXT CHECK(type IN ('image', 'gif', 'video')) NOT NULL, -- Type of meme (image, gif, or video, must be one of these)
        tags TEXT,                            -- Comma-separated tags for searching/filtering (optional)
        filepath TEXT NOT NULL,               -- Relative path or identifier for finding the file (we might just use filename)
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP -- When the record was added (defaults to now)
      );
    `;

    // Execute the SQL command
    db.run(createMemeTableSql, (err) => {
      if (err) {
        console.error('Error creating memes table:', err.message);
      } else {
        console.log("Table 'memes' created or already exists.");
        // You could add more db.run() calls here for other tables (e.g., users, categories)
        // in sequence within this serialize block.
      }

      // 5. Close the database connection *after* all operations are done
      closeDatabase();
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