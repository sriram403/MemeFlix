// 1. Import libraries
require('dotenv').config(); // Load .env variables
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt'); // For password hashing
const jwt = require('jsonwebtoken'); // For JWT

// 2. Define constants
const app = express();
const PORT = 3001;
const dbPath = path.resolve(__dirname, 'memeflix.db');
const JWT_SECRET = process.env.JWT_SECRET; // Get secret from .env
const SALT_ROUNDS = 10; // Cost factor for bcrypt hashing

// 3. Connect to SQLite Database
//    We open the connection here, and it stays open while the server runs.
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) { console.error('Error opening database:', err.message); }
  else { console.log(`Connected to the SQLite database at ${dbPath}`); }
});

// 4. Apply Middleware
app.use(cors());
// Optional: Middleware to parse JSON request bodies (useful for POST/PUT later)
app.use(express.json());

// --- NEW: Authentication Middleware ---
const authenticateToken = (req, res, next) => {
  // Get token from the Authorization header (Bearer TOKEN)
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401); // No token, unauthorized

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
        console.error("JWT Verification Error:", err.message);
        return res.sendStatus(403); // Invalid token, forbidden
    }
    // If token is valid, attach payload (user info) to request object
    req.user = user;
    next(); // Proceed to the next middleware or route handler
  });
};

app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required.' });
  }

  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Insert user into database
    const sql = "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)";
    db.run(sql, [username, email, hashedPassword], function(err) {
      if (err) {
        // Handle potential UNIQUE constraint errors (username/email already exists)
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(409).json({ error: 'Username or email already exists.' }); // 409 Conflict
        }
        console.error("Database error during registration:", err.message);
        return res.status(500).json({ error: 'Database error during registration.' });
      }
      // Return success (maybe user ID? or just success)
      res.status(201).json({ message: 'User registered successfully.', userId: this.lastID });
    });
  } catch (error) {
    console.error("Error during registration:", error);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const sql = "SELECT * FROM users WHERE username = ?";
  db.get(sql, [username], async (err, user) => {
    if (err) {
      console.error("Database error during login:", err.message);
      return res.status(500).json({ error: 'Database error during login.' });
    }
    if (!user) {
      // User not found
      return res.status(401).json({ error: 'Invalid credentials.' }); // Unauthorized
    }

    try {
      // Compare provided password with the stored hash
      const match = await bcrypt.compare(password, user.password_hash);

      if (match) {
        // Passwords match - Generate JWT
        // Payload should contain non-sensitive user info
        const userPayload = { id: user.id, username: user.username };
        const accessToken = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '1h' }); // Token expires in 1 hour

        res.json({ accessToken: accessToken, user: userPayload });
      } else {
        // Passwords don't match
        res.status(401).json({ error: 'Invalid credentials.' }); // Unauthorized
      }
    } catch (error) {
      console.error("Error comparing passwords:", error);
      res.status(500).json({ error: 'Server error during login.' });
    }
  });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  // If middleware passes, req.user contains the payload from the token
  // Fetch full user details if needed, but avoid sending hash
   const sql = "SELECT id, username, email, created_at FROM users WHERE id = ?";
   db.get(sql, [req.user.id], (err, userRow) => {
       if (err) {
            console.error("Error fetching user details for /me:", err.message);
            return res.status(500).json({ error: 'Database error' });
       }
       if (!userRow) {
           return res.status(404).json({ error: 'User not found' }); // Should not happen if token is valid
       }
       res.json(userRow);
   });
});

// --- API Routes Will Go Here ---
// GET endpoint to fetch all memes
app.get('/api/memes', (req, res) => {
  // 1. Get page and limit from query params, provide defaults
  const page = parseInt(req.query.page || '1', 10); // Default to page 1
  const limit = parseInt(req.query.limit || '2', 5); // Default to 12 memes per page

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

// *** NEW: Endpoint to UPVOTE a meme ***
app.post('/api/memes/:id/upvote', (req, res) => {
  const memeId = parseInt(req.params.id, 10);
  if (isNaN(memeId)) {
    return res.status(400).json({ error: 'Invalid meme ID.' });
  }

  // SQL to increment the upvotes count for the specific meme ID
  // Using 'upvotes + 1' directly in the SET clause
  const sql = `UPDATE memes SET upvotes = upvotes + 1 WHERE id = ?`;

  db.run(sql, [memeId], function(err) { // Use function() to access this.changes
    if (err) {
      console.error(`Error upvoting meme ${memeId}:`, err.message);
      return res.status(500).json({ error: 'Database error during upvote.' });
    }
    // Check if any row was actually updated
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Meme not found.' });
    }
    // Optionally, fetch the updated meme data and return it
    // For now, just return success status
    res.status(200).json({ message: 'Upvote successful.' /* , updatedVotes: ... */ });
  });
});

// *** NEW: Endpoint to DOWNVOTE a meme ***
app.post('/api/memes/:id/downvote', (req, res) => {
  const memeId = parseInt(req.params.id, 10);
  if (isNaN(memeId)) {
    return res.status(400).json({ error: 'Invalid meme ID.' });
  }

  // SQL to increment the downvotes count
  const sql = `UPDATE memes SET downvotes = downvotes + 1 WHERE id = ?`;

  db.run(sql, [memeId], function(err) {
    if (err) {
      console.error(`Error downvoting meme ${memeId}:`, err.message);
      return res.status(500).json({ error: 'Database error during downvote.' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Meme not found.' });
    }
    res.status(200).json({ message: 'Downvote successful.' });
  });
});

// *** NEW: GET endpoint to serve specific media files ***
app.get('/media/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, '../meme_files', filename);

  res.sendFile(filePath, (err) => {
    // Updated error handling
    if (err) {
      // Log the error regardless
      console.error(`Error sending file ${filename}:`, err.message);

      // Check if headers have *already* been sent or if response finished
      if (res.headersSent || res.writableEnded) {
         // If headers are sent or stream finished/aborted, we can't send a new response.
         // The error is logged, just end the request cycle here if possible.
         console.log(`Headers already sent for ${filename}, cannot send error response.`);
         // Optionally try ending the response if it's still writable in some error states
         // if (res.writable) res.end(); // Be cautious with this
         return;
      }

      // If headers haven't been sent, we CAN send a proper error response
      if (err.code === "ENOENT") {
        res.status(404).json({ error: 'File not found.' });
      } else {
        // For other errors before sending started (e.g., permissions)
        res.status(500).json({ error: 'Failed to send file.' });
      }
    } else {
      // Optional: Log successful sending
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