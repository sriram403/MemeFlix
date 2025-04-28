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
  // 1. Get page and limit from query params, provide defaults
  const page = parseInt(req.query.page || '1', 10); // Default to page 1
  const limit = parseInt(req.query.limit || '2', 10); // Default to 12 memes per page

  // Basic validation for positive integers
  if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1) {
    return res.status(400).json({ error: 'Invalid page or limit parameter.' });
  }

  // 2. Calculate OFFSET for SQL query
  //    OFFSET is how many records to skip (e.g., for page 2 with limit 10, offset is 10)
  const offset = (page - 1) * limit;

  // 3. Define SQL queries
  //    Query to get the subset of memes for the current page
  const sqlGetData = `
    SELECT * FROM memes
    ORDER BY uploaded_at DESC
    LIMIT ?
    OFFSET ?
  `;
  //    Query to get the total count of all memes
  const sqlGetCount = `SELECT COUNT(*) as totalMemes FROM memes`;

  // 4. Execute queries using Promise.all for concurrency (optional but cleaner)
  //    We need both the total count and the page data
  Promise.all([
    // Promise wrapper for db.get (fetches total count)
    new Promise((resolve, reject) => {
      db.get(sqlGetCount, [], (err, row) => {
        if (err) reject(err);
        else resolve(row.totalMemes); // Resolve with the total count number
      });
    }),
    // Promise wrapper for db.all (fetches memes for the current page)
    new Promise((resolve, reject) => {
      db.all(sqlGetData, [limit, offset], (err, rows) => {
        if (err) reject(err);
        else resolve(rows); // Resolve with the array of memes for the page
      });
    })
  ])
  .then(([totalMemes, memesForPage]) => {
    // 5. Calculate total pages
    const totalPages = Math.ceil(totalMemes / limit);

    // 6. Send response with paginated data and metadata
    res.status(200).json({
      memes: memesForPage, // Memes for the current page
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalMemes: totalMemes,
        limit: limit
      }
    });
  })
  .catch(err => {
    // Handle errors from either query
    console.error("Error fetching paginated memes:", err.message);
    res.status(500).json({ error: 'Failed to retrieve memes from database.' });
  });
});

app.get('/api/memes/search', (req, res) => {
  // 1. Get the search query from the URL query parameters (?q=...)
  const query = req.query.q;

  // 2. Basic validation: If no query is provided, return an error or empty list
  if (!query) {
    return res.status(400).json({ error: 'Search query parameter "q" is required.' });
    // Alternatively, you could return all memes or an empty list:
    // return res.status(200).json({ memes: [] });
  }

  // 3. Construct the SQL query for searching using LIKE and wildcards (%)
  //    We'll search in title, description, and tags columns.
  //    Using || for string concatenation (standard SQL, works in SQLite)
  //    Using lower() to make the search case-insensitive.
  const sql = `
    SELECT * FROM memes
    WHERE
      lower(title) LIKE ? OR
      lower(description) LIKE ? OR
      lower(tags) LIKE ?
    ORDER BY uploaded_at DESC
  `;

  // 4. Prepare the search term for LIKE query (add wildcards)
  const searchTerm = `%${query.toLowerCase()}%`; // Convert query to lowercase and add %

  // 5. Execute the query using db.all() with parameterized query
  //    Pass the searchTerm three times, once for each placeholder (?)
  db.all(sql, [searchTerm, searchTerm, searchTerm], (err, rows) => {
    if (err) {
      console.error("Error searching memes:", err.message);
      res.status(500).json({ error: 'Failed to search memes in database.' });
      return;
    }
    // 6. Send back the matching rows as JSON
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