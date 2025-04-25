// 1. Import libraries
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose(); // Import sqlite3
const path = require('path'); // Import path

// 2. Define constants
const app = express();
const PORT = 3001;
// Define path to the database file (relative to server.js location)
const dbPath = path.resolve(__dirname, 'memeflix.db');

// 3. Connect to SQLite Database
//    We open the connection here, and it stays open while the server runs.
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log(`Connected to the SQLite database at ${dbPath}`);
    // We could potentially run setup checks here if needed, but our setup script handles creation.
  }
});

// 4. Apply Middleware
app.use(cors());
// Optional: Middleware to parse JSON request bodies (useful for POST/PUT later)
// app.use(express.json());

// --- API Routes Will Go Here ---
// GET endpoint to fetch all memes
app.get('/api/memes', (req, res) => {
  // SQL query to select all columns (*) from the 'memes' table
  const sql = "SELECT * FROM memes ORDER BY uploaded_at DESC"; // Order by newest first

  // Execute the query using db.all() because we expect multiple rows
  // db.all(sql_query, [parameters], callback_function)
  db.all(sql, [], (err, rows) => {
    if (err) {
      // If there's an error querying the database
      console.error("Error fetching memes:", err.message);
      // Send a 500 Internal Server Error status code and a JSON error message
      res.status(500).json({ error: 'Failed to retrieve memes from database.' });
      return; // Stop further execution in this callback
    }

    // If the query is successful
    // 'rows' will be an array of objects, where each object represents a meme record
    // Send a 200 OK status code and the fetched rows as JSON data
    res.status(200).json({ memes: rows });
  });
});

// *** NEW: GET endpoint to serve specific media files ***
app.get('/media/:filename', (req, res) => {
  // 1. Extract the filename from the URL parameter
  const filename = req.params.filename;

  // 2. Construct the full path to the requested file
  //    __dirname is the directory of server.js (backend)
  //    '../meme_files' goes up one level and then into the meme_files directory
  const filePath = path.join(__dirname, '../meme_files', filename);

  // 3. Send the file back to the client
  //    'res.sendFile()' handles setting the correct Content-Type header
  //    based on the file extension and streaming the file.
  res.sendFile(filePath, (err) => {
    // Optional callback to handle errors during file sending
    if (err) {
      // Log the error on the server side
      console.error(`Error sending file ${filename}:`, err.message);

      // Check if the error is because the file doesn't exist (ENOENT)
      if (err.code === "ENOENT") {
        res.status(404).json({ error: 'File not found.' });
      } else {
        // For other errors (e.g., permissions), send a generic 500 error
        res.status(500).json({ error: 'Failed to send file.' });
      }
    } else {
      // Optional: Log successful file sending
      // console.log(`Sent file: ${filename}`);
    }
  });
});

// Example: Original root route (keep it for testing)
app.get('/', (req, res) => {
  res.send('Hello World from Memeflix Backend!');
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Memeflix backend server is running on http://localhost:${PORT}`);
});

// Optional: Graceful shutdown - close DB connection when server stops
// This is more advanced but good practice
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      return console.error('Error closing database on shutdown:', err.message);
    }
    console.log('Database connection closed due to app termination.');
    process.exit(0);
  });
});