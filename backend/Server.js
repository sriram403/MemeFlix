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
const JWT_SECRET = process.env.JWT_SECRET || 'YOUR_DEFAULT_SECRET_KEY_HERE';
const SALT_ROUNDS = 10;

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) { console.error('Error opening database:', err.message); }
  else { console.log(`Connected to the SQLite database at ${dbPath}`); }
});

app.use(cors());
app.use(express.json());

// --- Auth Middleware ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- Auth Routes ---
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'Missing required fields.' });
  try {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const sql = "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)";
    db.run(sql, [username, email, hashedPassword], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Username or email already exists.' });
        console.error("DB register error:", err.message);
        return res.status(500).json({ error: 'Database error.' });
      }
      res.status(201).json({ message: 'User registered.', userId: this.lastID });
    });
  } catch (error) { console.error("Register error:", error); res.status(500).json({ error: 'Server error.' }); }
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields.' });
  const sql = "SELECT * FROM users WHERE username = ?";
  db.get(sql, [username], async (err, user) => {
    if (err) { console.error("DB login error:", err.message); return res.status(500).json({ error: 'Database error.' }); }
    if (!user) return res.status(401).json({ error: 'Invalid credentials.' });
    try {
      const match = await bcrypt.compare(password, user.password_hash);
      if (match) {
        const userPayload = { id: user.id, username: user.username };
        const accessToken = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '1h' });
        res.json({ accessToken: accessToken, user: userPayload });
      } else { res.status(401).json({ error: 'Invalid credentials.' }); }
    } catch (error) { console.error("Compare pwd error:", error); res.status(500).json({ error: 'Server error.' }); }
  });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
   const sql = "SELECT id, username, email, created_at FROM users WHERE id = ?";
   db.get(sql, [req.user.id], (err, userRow) => {
       if (err) { console.error("DB /me error:", err.message); return res.status(500).json({ error: 'Database error' }); }
       if (!userRow) return res.status(404).json({ error: 'User not found' });
       res.json(userRow);
   });
});

// --- Meme Routes ---
app.get('/api/memes', (req, res) => {
  const page = parseInt(req.query.page || '1', 10);
  const limit = parseInt(req.query.limit || '12', 10);
  if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1) return res.status(400).json({ error: 'Invalid page/limit.' });
  const offset = (page - 1) * limit;
  const sqlGetData = `SELECT * FROM memes ORDER BY uploaded_at DESC LIMIT ? OFFSET ?`;
  const sqlGetCount = `SELECT COUNT(*) as totalMemes FROM memes`;
  Promise.all([
    new Promise((resolve, reject) => db.get(sqlGetCount, [], (err, row) => err ? reject(err) : resolve(row?.totalMemes || 0))), // Added fallback for count
    new Promise((resolve, reject) => db.all(sqlGetData, [limit, offset], (err, rows) => err ? reject(err) : resolve(rows)))
  ]).then(([totalMemes, memesForPage]) => {
    const totalPages = Math.ceil(totalMemes / limit);
    res.status(200).json({ memes: memesForPage || [], pagination: { currentPage: page, totalPages: totalPages, totalMemes: totalMemes, limit: limit } }); // Added fallback for memes
  }).catch(err => { console.error("DB fetch memes error:", err.message); res.status(500).json({ error: 'Failed to retrieve memes.' }); });
});

app.get('/api/memes/search', (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'Query "q" required.' });
  const sql = `SELECT * FROM memes WHERE lower(title) LIKE ? OR lower(description) LIKE ? OR lower(tags) LIKE ? ORDER BY uploaded_at DESC`;
  const searchTerm = `%${query.toLowerCase()}%`;
  db.all(sql, [searchTerm, searchTerm, searchTerm], (err, rows) => {
    if (err) { console.error("DB search error:", err.message); return res.status(500).json({ error: 'Search failed.' }); }
    res.status(200).json({ memes: rows || [] }); // Added fallback
  });
});

// --- Vote Routes ---
app.post('/api/memes/:id/upvote', (req, res) => {
  const memeId = parseInt(req.params.id, 10);
  if (isNaN(memeId)) return res.status(400).json({ error: 'Invalid ID.' });
  const sql = `UPDATE memes SET upvotes = upvotes + 1 WHERE id = ?`;
  db.run(sql, [memeId], function(err) {
    if (err) { console.error(`Upvote error ${memeId}:`, err.message); return res.status(500).json({ error: 'DB error.' }); }
    if (this.changes === 0) return res.status(404).json({ error: 'Not found.' });
    res.status(200).json({ message: 'Upvote successful.' });
  });
});
app.post('/api/memes/:id/downvote', (req, res) => {
  const memeId = parseInt(req.params.id, 10);
  if (isNaN(memeId)) return res.status(400).json({ error: 'Invalid ID.' });
  const sql = `UPDATE memes SET downvotes = downvotes + 1 WHERE id = ?`;
  db.run(sql, [memeId], function(err) {
    if (err) { console.error(`Downvote error ${memeId}:`, err.message); return res.status(500).json({ error: 'DB error.' }); }
    if (this.changes === 0) return res.status(404).json({ error: 'Not found.' });
    res.status(200).json({ message: 'Downvote successful.' });
  });
});

// --- Favorites Routes ---
app.get('/api/favorites/ids', authenticateToken, (req, res) => {
    const sql = "SELECT meme_id FROM user_favorites WHERE user_id = ?";
    db.all(sql, [req.user.id], (err, rows) => {
        if (err) { console.error("Fav IDs error:", err.message); return res.status(500).json({ error: 'DB error.' }); }
        res.status(200).json({ favoriteMemeIds: rows.map(r => r.meme_id) || [] }); // Added fallback
    });
});
app.get('/api/favorites', authenticateToken, (req, res) => {
    const sql = `SELECT m.* FROM memes m JOIN user_favorites uf ON m.id = uf.meme_id WHERE uf.user_id = ? ORDER BY uf.added_at DESC`;
    db.all(sql, [req.user.id], (err, rows) => {
        if (err) { console.error("Fetch favs error:", err.message); return res.status(500).json({ error: 'DB error.' }); }
        res.status(200).json({ memes: rows || [] });
    });
});
app.post('/api/favorites/:memeId', authenticateToken, (req, res) => {
    const memeId = parseInt(req.params.memeId, 10);
    if (isNaN(memeId)) return res.status(400).json({ error: 'Invalid ID.' });
    const sql = "INSERT OR IGNORE INTO user_favorites (user_id, meme_id) VALUES (?, ?)";
    db.run(sql, [req.user.id, memeId], function(err) {
        if (err) { console.error("Add fav error:", err.message); return res.status(500).json({ error: 'DB error.' }); }
        res.status(this.changes === 0 ? 200 : 201).json({ message: this.changes === 0 ? 'Already favorite.' : 'Added to favorites.' });
    });
});
app.delete('/api/favorites/:memeId', authenticateToken, (req, res) => {
    const memeId = parseInt(req.params.memeId, 10);
    if (isNaN(memeId)) return res.status(400).json({ error: 'Invalid ID.' });
    const sql = "DELETE FROM user_favorites WHERE user_id = ? AND meme_id = ?";
    db.run(sql, [req.user.id, memeId], function(err) {
        if (err) { console.error("Remove fav error:", err.message); return res.status(500).json({ error: 'DB error.' }); }
        if (this.changes === 0) return res.status(404).json({ error: 'Favorite not found.' });
        res.status(200).json({ message: 'Removed from favorites.' });
    });
});

// --- History Routes ---
app.post('/api/history/:memeId', authenticateToken, (req, res) => {
    const memeId = parseInt(req.params.memeId, 10);
    if (isNaN(memeId)) return res.status(400).json({ error: 'Invalid meme ID.' });
    const sql = "INSERT INTO viewing_history (user_id, meme_id) VALUES (?, ?)";
    db.run(sql, [req.user.id, memeId], function(err) {
        if (err) {
            if (err.message.includes('FOREIGN KEY')) return res.status(404).json({ error: 'Meme not found.' });
            console.error("Record history error:", err.message);
            return res.status(500).json({ error: 'DB error.' });
        }
        res.status(201).json({ message: 'View recorded.' });
    });
});
app.get('/api/history', authenticateToken, (req, res) => {
    const limit = parseInt(req.query.limit || '50', 10);
    const sql = `
        SELECT m.*, h.viewed_at FROM memes m JOIN (
            SELECT meme_id, MAX(viewed_at) as viewed_at FROM viewing_history
            WHERE user_id = ? GROUP BY meme_id
        ) h ON m.id = h.meme_id ORDER BY h.viewed_at DESC LIMIT ?`;
    db.all(sql, [req.user.id, limit], (err, rows) => {
        if (err) { console.error("Fetch history error:", err.message); return res.status(500).json({ error: 'DB error.' }); }
        res.status(200).json({ memes: rows || [] }); // Added fallback
    });
});

// --- Media Route ---
app.get('/media/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, '../meme_files', filename);
  res.sendFile(filePath, (err) => {
    if (err) {
      if (!res.headersSent && !res.writableEnded) {
        if (err.code === "ENOENT") res.status(404).json({ error: 'File not found.' });
        else res.status(500).json({ error: 'Failed to send file.' });
      }
    }
  });
});

// --- Root Route ---
app.get('/', (req, res) => res.send('Hello World from Memeflix Backend!'));

// --- Start Server ---
app.listen(PORT, () => console.log(`Memeflix backend server running on http://localhost:${PORT}`));

// --- Graceful Shutdown ---
process.on('SIGINT', () => {
  console.log("SIGINT received. Closing database connection...");
  db.close((err) => {
    // *** CORRECTED LOGIC ***
    if (err) {
      console.error('Error closing database on shutdown:', err.message);
      process.exit(1); // Exit with error code if closing fails
    } else {
      console.log('Database connection closed successfully.');
      process.exit(0); // Exit cleanly
    }
    // *** END CORRECTION ***
  });
});