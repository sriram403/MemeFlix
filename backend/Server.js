// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3001;
const dbPath = path.resolve(__dirname, 'memeflix.db');
const JWT_SECRET = process.env.JWT_SECRET || 'YOUR_DEFAULT_SECRET_KEY_HERE'; // Fallback secret
const SALT_ROUNDS = 10;

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) { console.error('Error opening database:', err.message); }
  else { console.log(`Connected to the SQLite database at ${dbPath}`); }
});

app.use(cors());
app.use(express.json());

// --- Authentication Middleware ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
        console.error("JWT Verification Error:", err.message);
        return res.sendStatus(403);
    }
    req.user = user; // Attach user payload ({ id, username })
    next();
  });
};

// --- Auth Routes ---
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required.' });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const sql = "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)";
    db.run(sql, [username, email, hashedPassword], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(409).json({ error: 'Username or email already exists.' });
        }
        console.error("Database error during registration:", err.message);
        return res.status(500).json({ error: 'Database error during registration.' });
      }
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
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    try {
      const match = await bcrypt.compare(password, user.password_hash);
      if (match) {
        const userPayload = { id: user.id, username: user.username };
        const accessToken = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '1h' });
        res.json({ accessToken: accessToken, user: userPayload });
      } else {
        res.status(401).json({ error: 'Invalid credentials.' });
      }
    } catch (error) {
      console.error("Error comparing passwords:", error);
      res.status(500).json({ error: 'Server error during login.' });
    }
  });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
   const sql = "SELECT id, username, email, created_at FROM users WHERE id = ?";
   db.get(sql, [req.user.id], (err, userRow) => {
       if (err) {
            console.error("Error fetching user details for /me:", err.message);
            return res.status(500).json({ error: 'Database error' });
       }
       if (!userRow) {
           return res.status(404).json({ error: 'User not found' });
       }
       res.json(userRow);
   });
});

// --- Meme Routes ---
app.get('/api/memes', (req, res) => {
  const page = parseInt(req.query.page || '1', 10);
  const limit = parseInt(req.query.limit || '12', 10); // Back to 12 default
  if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1) {
    return res.status(400).json({ error: 'Invalid page or limit parameter.' });
  }
  const offset = (page - 1) * limit;
  const sqlGetData = `SELECT * FROM memes ORDER BY uploaded_at DESC LIMIT ? OFFSET ?`;
  const sqlGetCount = `SELECT COUNT(*) as totalMemes FROM memes`;

  Promise.all([
    new Promise((resolve, reject) => {
      db.get(sqlGetCount, [], (err, row) => err ? reject(err) : resolve(row.totalMemes));
    }),
    new Promise((resolve, reject) => {
      db.all(sqlGetData, [limit, offset], (err, rows) => err ? reject(err) : resolve(rows));
    })
  ])
  .then(([totalMemes, memesForPage]) => {
    const totalPages = Math.ceil(totalMemes / limit);
    res.status(200).json({
      memes: memesForPage,
      pagination: { currentPage: page, totalPages: totalPages, totalMemes: totalMemes, limit: limit }
    });
  })
  .catch(err => {
    console.error("Error fetching paginated memes:", err.message);
    res.status(500).json({ error: 'Failed to retrieve memes.' });
  });
});

app.get('/api/memes/search', (req, res) => {
  const query = req.query.q;
  if (!query) { return res.status(400).json({ error: 'Search query parameter "q" is required.' }); }
  const sql = `SELECT * FROM memes WHERE lower(title) LIKE ? OR lower(description) LIKE ? OR lower(tags) LIKE ? ORDER BY uploaded_at DESC`;
  const searchTerm = `%${query.toLowerCase()}%`;
  db.all(sql, [searchTerm, searchTerm, searchTerm], (err, rows) => {
    if (err) {
      console.error("Error searching memes:", err.message);
      return res.status(500).json({ error: 'Failed to search memes.' });
    }
    res.status(200).json({ memes: rows }); // Note: Search results aren't paginated here
  });
});

// --- Vote Routes ---
app.post('/api/memes/:id/upvote', (req, res) => {
  const memeId = parseInt(req.params.id, 10);
  if (isNaN(memeId)) {
    return res.status(400).json({ error: 'Invalid meme ID.' });
  }
  const sql = `UPDATE memes SET upvotes = upvotes + 1 WHERE id = ?`;
  db.run(sql, [memeId], function(err) {
    if (err) {
      // *** CORRECTED ERROR HANDLING ***
      console.error(`Error upvoting meme ${memeId}:`, err.message);
      return res.status(500).json({ error: 'Database error during upvote.' });
      // *** END CORRECTION ***
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Meme not found.' });
    }
    res.status(200).json({ message: 'Upvote successful.' });
  });
});

// *** Endpoint to DOWNVOTE a meme ***
app.post('/api/memes/:id/downvote', (req, res) => {
  const memeId = parseInt(req.params.id, 10);
  if (isNaN(memeId)) {
    return res.status(400).json({ error: 'Invalid meme ID.' });
  }
  const sql = `UPDATE memes SET downvotes = downvotes + 1 WHERE id = ?`;
  db.run(sql, [memeId], function(err) {
    if (err) {
      // *** CORRECTED ERROR HANDLING ***
      console.error(`Error downvoting meme ${memeId}:`, err.message);
      return res.status(500).json({ error: 'Database error during downvote.' });
      // *** END CORRECTION ***
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Meme not found.' });
    }
    res.status(200).json({ message: 'Downvote successful.' });
  });
});

// --- Favorites Routes (PROTECTED) ---

// GET /api/favorites/ids - Get IDs of favorited memes for the logged-in user
app.get('/api/favorites/ids', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const sql = "SELECT meme_id FROM user_favorites WHERE user_id = ?";
    db.all(sql, [userId], (err, rows) => {
        if (err) {
            console.error("Error fetching favorite IDs:", err.message);
            return res.status(500).json({ error: 'Database error fetching favorite IDs.' });
        }
        const ids = rows.map(row => row.meme_id);
        res.status(200).json({ favoriteMemeIds: ids });
    });
});

// GET /api/favorites - Get full meme details for favorited memes
app.get('/api/favorites', authenticateToken, (req, res) => {
    const userId = req.user.id;
    // Join user_favorites with memes table
    // TODO: Add pagination here as well if the list can get long
    const sql = `
        SELECT m.*
        FROM memes m
        JOIN user_favorites uf ON m.id = uf.meme_id
        WHERE uf.user_id = ?
        ORDER BY uf.added_at DESC
    `;
    db.all(sql, [userId], (err, rows) => {
        if (err) {
            console.error("Error fetching full favorites:", err.message);
            return res.status(500).json({ error: 'Database error fetching favorites.' });
        }
        // Return just the memes array for consistency, maybe add pagination later
        res.status(200).json({ memes: rows });
    });
});

// POST /api/favorites/:memeId - Add a meme to favorites
app.post('/api/favorites/:memeId', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const memeId = parseInt(req.params.memeId, 10);
    if (isNaN(memeId)) return res.status(400).json({ error: 'Invalid meme ID.' });

    const sql = "INSERT OR IGNORE INTO user_favorites (user_id, meme_id) VALUES (?, ?)";
    db.run(sql, [userId, memeId], function(err) {
        if (err) {
            console.error("Error adding favorite:", err.message);
            return res.status(500).json({ error: 'Database error adding favorite.' });
        }
        if (this.changes === 0) {
            // It wasn't inserted, probably already exists (due to OR IGNORE)
             return res.status(200).json({ message: 'Meme already in favorites.' }); // Or 409 Conflict? 200 is fine.
        }
        res.status(201).json({ message: 'Meme added to favorites.' }); // 201 Created (or 200 OK)
    });
});

// DELETE /api/favorites/:memeId - Remove a meme from favorites
app.delete('/api/favorites/:memeId', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const memeId = parseInt(req.params.memeId, 10);
    if (isNaN(memeId)) return res.status(400).json({ error: 'Invalid meme ID.' });

    const sql = "DELETE FROM user_favorites WHERE user_id = ? AND meme_id = ?";
    db.run(sql, [userId, memeId], function(err) {
        if (err) {
            console.error("Error removing favorite:", err.message);
            return res.status(500).json({ error: 'Database error removing favorite.' });
        }
        if (this.changes === 0) {
            // Nothing was deleted, maybe it wasn't favorited in the first place
            return res.status(404).json({ error: 'Favorite not found.' });
        }
        res.status(200).json({ message: 'Meme removed from favorites.' }); // 200 OK or 204 No Content
    });
});


// --- Media Route ---
app.get('/media/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, '../meme_files', filename);
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error(`Error sending file ${filename}:`, err.message);
      if (res.headersSent || res.writableEnded) {
         console.log(`Headers already sent for ${filename}, cannot send error response.`);
         return;
      }
      if (err.code === "ENOENT") {
        res.status(404).json({ error: 'File not found.' });
      } else {
        res.status(500).json({ error: 'Failed to send file.' });
      }
    }
  });
});

// --- Root Route ---
app.get('/', (req, res) => {
  res.send('Hello World from Memeflix Backend!');
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Memeflix backend server is running on http://localhost:${PORT}`);
});

// --- Graceful Shutdown ---
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database on shutdown:', err.message);
    } else {
      console.log('Database connection closed due to app termination.');
    }
    process.exit(0);
  });
});