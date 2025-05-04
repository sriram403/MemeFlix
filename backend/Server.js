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

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
  if (err) { console.error('Error opening database:', err.message); }
  else { console.log(`Connected to the SQLite database at ${dbPath}`); }
});

app.use(cors());
app.use(express.json());

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
        return res.sendStatus(403);
    }
    req.user = user;
    next();
  });
};

// --- Database Helper Functions ---
function runDb(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err); else resolve(this);
      });
    });
}
function getDb(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err); else resolve(row);
      });
    });
}
function allDb(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err); else resolve(rows);
      });
    });
}


// --- Auth Routes (Unchanged) ---
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'Missing required fields.' });
  try {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await runDb("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)", [username, email, hashedPassword]);
    res.status(201).json({ message: 'User registered.', userId: result.lastID });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Username or email already exists.' });
    console.error("DB register error:", err.message); return res.status(500).json({ error: 'Database error.' });
  }
});
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields.' });
  try {
    const user = await getDb("SELECT * FROM users WHERE username = ?", [username]);
    if (!user) return res.status(401).json({ error: 'Invalid credentials.' });
    const match = await bcrypt.compare(password, user.password_hash);
    if (match) {
      const userPayload = { id: user.id, username: user.username };
      const accessToken = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '1h' });
      res.json({ accessToken: accessToken, user: userPayload });
    } else { res.status(401).json({ error: 'Invalid credentials.' }); }
  } catch (err) {
    console.error("Login process error:", err.message);
    res.status(500).json({ error: 'Server error during login.' });
  }
});
app.get('/api/auth/me', authenticateToken, async (req, res) => {
   try {
       const userRow = await getDb("SELECT id, username, email, created_at FROM users WHERE id = ?", [req.user.id]);
       if (!userRow) return res.status(404).json({ error: 'User not found' });
       res.json(userRow);
   } catch (err) {
       console.error("DB /me error:", err.message);
       return res.status(500).json({ error: 'Database error' });
   }
});

// --- Base Meme Select Query with Tags ---
const baseMemeSelectFields = `
    m.id, m.title, m.description, m.filename, m.type, m.filepath,
    m.upvotes, m.downvotes, m.uploaded_at,
    GROUP_CONCAT(t.name) as tags
`;
const baseMemeJoins = `
    FROM memes m
    LEFT JOIN meme_tags mt ON m.id = mt.meme_id
    LEFT JOIN tags t ON mt.tag_id = t.tag_id
`;

// --- Meme Routes ---
app.get('/api/memes', async (req, res) => {
  const page = parseInt(req.query.page || '1', 10);
  const limit = parseInt(req.query.limit || '12', 10);
  if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1) return res.status(400).json({ error: 'Invalid page/limit.' });
  const offset = (page - 1) * limit;

  const sqlGetData = `
      SELECT ${baseMemeSelectFields}
      ${baseMemeJoins}
      GROUP BY m.id
      ORDER BY m.uploaded_at DESC
      LIMIT ? OFFSET ?
  `;
  const sqlGetCount = `SELECT COUNT(*) as totalMemes FROM memes`;

  try {
    const [totalRow, memesForPage] = await Promise.all([
      getDb(sqlGetCount),
      allDb(sqlGetData, [limit, offset])
    ]);
    const totalMemes = totalRow?.totalMemes || 0;
    const totalPages = Math.ceil(totalMemes / limit);
    res.status(200).json({
        memes: memesForPage || [],
        pagination: { currentPage: page, totalPages: totalPages, totalMemes: totalMemes, limit: limit }
    });
  } catch (err) {
    console.error("DB fetch memes error:", err.message);
    res.status(500).json({ error: 'Failed to retrieve memes.' });
  }
});

app.get('/api/memes/search', async (req, res) => {
    const query = req.query.q || '';
    const filterType = req.query.type || '';
    const sortBy = req.query.sort || 'newest';
    const filterTag = req.query.tag || ''; // Read tag from query param

    let whereClauses = [];
    let params = [];
    let joins = baseMemeJoins; // Start with base joins

    // Text search condition
    if (query) {
        whereClauses.push(`(lower(m.title) LIKE ? OR lower(m.description) LIKE ?)`);
        const searchTerm = `%${query.toLowerCase()}%`;
        params.push(searchTerm, searchTerm);
    }

    // Type filter condition
    const validTypes = ['image', 'gif', 'video'];
    if (filterType && validTypes.includes(filterType.toLowerCase())) {
        whereClauses.push(`lower(m.type) = ?`);
        params.push(filterType.toLowerCase());
    }

     // Tag filter condition
    if (filterTag) {
        // Need INNER JOIN for filtering specifically by tag
        joins = `
            FROM memes m
            INNER JOIN meme_tags mt_filter ON m.id = mt_filter.meme_id
            INNER JOIN tags t_filter ON mt_filter.tag_id = t_filter.tag_id
            LEFT JOIN meme_tags mt ON m.id = mt.meme_id
            LEFT JOIN tags t ON mt.tag_id = t.tag_id
        `;
        whereClauses.push(`lower(t_filter.name) = lower(?)`);
        params.push(filterTag);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    let orderBySql = 'ORDER BY ';
    switch (sortBy.toLowerCase()) {
        case 'oldest': orderBySql += 'm.uploaded_at ASC'; break;
        case 'score': orderBySql += '(m.upvotes - m.downvotes) DESC, m.uploaded_at DESC'; break;
        case 'newest': default: orderBySql += 'm.uploaded_at DESC'; break;
    }

    const sql = `
        SELECT ${baseMemeSelectFields}
        ${joins}
        ${whereSql}
        GROUP BY m.id
        ${orderBySql}
    `;

    try {
        const rows = await allDb(sql, params);
        res.status(200).json({ memes: rows || [] });
    } catch (err) {
        console.error("DB search error:", err.message);
        console.error("SQL:", sql);
        console.error("Params:", params);
        return res.status(500).json({ error: 'Search failed due to database error.' });
    }
});

// --- Tag Routes ---
app.get('/api/tags/popular', async (req, res) => {
    const limit = parseInt(req.query.limit || '10', 10);
    const sql = `
        SELECT t.name as tag, COUNT(mt.meme_id) as count
        FROM tags t
        JOIN meme_tags mt ON t.tag_id = mt.tag_id
        GROUP BY t.tag_id
        ORDER BY count DESC, t.name ASC /* Add secondary sort by name */
        LIMIT ?
    `;
    try {
        const popularTags = await allDb(sql, [limit]);
        res.status(200).json({ popularTags: popularTags || [] });
    } catch (err) {
        console.error("Error fetching popular tags:", err.message);
        return res.status(500).json({ error: 'Database error fetching tags.' });
    }
});

// --- NEW: Get All Tags Route ---
app.get('/api/tags/all', async (req, res) => {
    const sql = `SELECT name FROM tags ORDER BY name ASC`;
    try {
        const tags = await allDb(sql);
        res.status(200).json({ tags: tags.map(t => t.name) || [] }); // Return just an array of names
    } catch (err) {
        console.error("Error fetching all tags:", err.message);
        return res.status(500).json({ error: 'Database error fetching all tags.' });
    }
});

app.get('/api/memes/by-tag/:tag', async (req, res) => {
    const tag = req.params.tag;
    const limit = parseInt(req.query.limit || '10', 10);

    if (!tag) return res.status(400).json({ error: 'Tag parameter is required.' });
    if (isNaN(limit) || limit < 1) return res.status(400).json({ error: 'Invalid limit parameter.' });

    const sql = `
        SELECT ${baseMemeSelectFields}
        FROM memes m
        INNER JOIN meme_tags mt_filter ON m.id = mt_filter.meme_id
        INNER JOIN tags t_filter ON mt_filter.tag_id = t_filter.tag_id
        LEFT JOIN meme_tags mt ON m.id = mt.meme_id
        LEFT JOIN tags t ON mt.tag_id = t.tag_id
        WHERE lower(t_filter.name) = lower(?)
        GROUP BY m.id
        ORDER BY RANDOM()
        LIMIT ?`;

    try {
        const rows = await allDb(sql, [tag, limit]);
        res.status(200).json({ memes: rows || [] });
    } catch (err) {
        console.error(`Error fetching tag "${tag}":`, err.message);
        return res.status(500).json({ error: 'DB error fetching tag memes.' });
    }
});


// --- Vote Routes (Unchanged) ---
app.post('/api/memes/:id/upvote', async (req, res) => {
  const memeId = parseInt(req.params.id, 10); if (isNaN(memeId)) return res.status(400).json({ error: 'Invalid ID.' });
  try {
    const result = await runDb(`UPDATE memes SET upvotes = upvotes + 1 WHERE id = ?`, [memeId]);
    if (result.changes === 0) return res.status(404).json({ error: 'Meme not found.' });
    res.status(200).json({ message: 'Upvote successful.' });
  } catch (err) {
    console.error(`Upvote error ${memeId}:`, err.message);
    return res.status(500).json({ error: 'Database error during upvote.' });
  }
});
app.post('/api/memes/:id/downvote', async (req, res) => {
  const memeId = parseInt(req.params.id, 10); if (isNaN(memeId)) return res.status(400).json({ error: 'Invalid ID.' });
  try {
    const result = await runDb(`UPDATE memes SET downvotes = downvotes + 1 WHERE id = ?`, [memeId]);
    if (result.changes === 0) return res.status(404).json({ error: 'Meme not found.' });
    res.status(200).json({ message: 'Downvote successful.' });
  } catch (err) {
    console.error(`Downvote error ${memeId}:`, err.message);
    return res.status(500).json({ error: 'Database error during downvote.' });
  }
});

// --- Favorites Routes (Unchanged) ---
app.get('/api/favorites/ids', authenticateToken, async (req, res) => {
    try {
        const rows = await allDb("SELECT meme_id FROM user_favorites WHERE user_id = ?", [req.user.id]);
        res.status(200).json({ favoriteMemeIds: rows.map(r => r.meme_id) || [] });
    } catch (err) {
        console.error("Fav IDs error:", err.message);
        return res.status(500).json({ error: 'DB error fetching favorite IDs.' });
    }
});
app.get('/api/favorites', authenticateToken, async (req, res) => {
    const sql = `
        SELECT ${baseMemeSelectFields}
        ${baseMemeJoins}
        JOIN user_favorites uf ON m.id = uf.meme_id
        WHERE uf.user_id = ?
        GROUP BY m.id
        ORDER BY uf.added_at DESC
    `;
    try {
        const rows = await allDb(sql, [req.user.id]);
        res.status(200).json({ memes: rows || [] });
    } catch (err) {
        console.error("Fetch favs error:", err.message);
        return res.status(500).json({ error: 'DB error fetching favorites.' });
    }
});
app.post('/api/favorites/:memeId', authenticateToken, async (req, res) => {
    const memeId = parseInt(req.params.memeId, 10); if (isNaN(memeId)) return res.status(400).json({ error: 'Invalid ID.' });
    try {
        const result = await runDb("INSERT OR IGNORE INTO user_favorites (user_id, meme_id) VALUES (?, ?)", [req.user.id, memeId]);
        res.status(result.changes === 0 ? 200 : 201).json({ message: result.changes === 0 ? 'Already favorite.' : 'Added to favorites.' });
    } catch (err) {
        console.error("Add fav error:", err.message);
        return res.status(500).json({ error: 'Database error adding favorite.' });
    }
});
app.delete('/api/favorites/:memeId', authenticateToken, async (req, res) => {
    const memeId = parseInt(req.params.memeId, 10); if (isNaN(memeId)) return res.status(400).json({ error: 'Invalid ID.' });
    try {
        const result = await runDb("DELETE FROM user_favorites WHERE user_id = ? AND meme_id = ?", [req.user.id, memeId]);
        if (result.changes === 0) return res.status(404).json({ error: 'Favorite not found.' });
        res.status(200).json({ message: 'Removed from favorites.' });
    } catch (err) {
        console.error("Remove fav error:", err.message);
        return res.status(500).json({ error: 'Database error removing favorite.' });
    }
});

// --- History Routes (Unchanged) ---
app.post('/api/history/:memeId', authenticateToken, async (req, res) => {
    const memeId = parseInt(req.params.memeId, 10); if (isNaN(memeId)) return res.status(400).json({ error: 'Invalid ID.' });
    try {
        const memeExists = await getDb("SELECT id FROM memes WHERE id = ?", [memeId]);
        if (!memeExists) {
            return res.status(404).json({ error: 'Meme not found.' });
        }
        await runDb("INSERT INTO viewing_history (user_id, meme_id) VALUES (?, ?)", [req.user.id, memeId]);
        res.status(201).json({ message: 'View recorded.' });
    } catch (err) {
        console.error("Record history error:", err.message);
        return res.status(500).json({ error: 'DB error recording history.' });
    }
});
app.get('/api/history', authenticateToken, async (req, res) => {
    const limit = parseInt(req.query.limit || '50', 10);
    const sql = `
        SELECT
            ${baseMemeSelectFields},
            h.viewed_at
        FROM (
             SELECT meme_id, MAX(viewed_at) as viewed_at
             FROM viewing_history
             WHERE user_id = ?
             GROUP BY meme_id
        ) h
        JOIN memes m ON m.id = h.meme_id
        LEFT JOIN meme_tags mt ON m.id = mt.meme_id
        LEFT JOIN tags t ON mt.tag_id = t.tag_id
        GROUP BY m.id
        ORDER BY h.viewed_at DESC
        LIMIT ?
    `;
    try {
        const rows = await allDb(sql, [req.user.id, limit]);
        res.status(200).json({ memes: rows || [] });
    } catch (err) {
        console.error("Fetch history error:", err.message);
        return res.status(500).json({ error: 'Database error fetching history.' });
    }
});


// --- Media Route (Unchanged) ---
app.get('/media/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, '../meme_files', filename);
  res.sendFile(filePath, (err) => {
      if (err) {
          if (!res.headersSent && !res.writableEnded) {
              if (err.code === "ENOENT") {
                  // Don't log 404s as errors unless debugging
                  // console.error(`File not found: ${filename}`);
                  res.status(404).json({ error: 'File not found.' });
              } else {
                  console.error(`Error sending file ${filename}:`, err);
                  res.status(500).json({ error: 'Failed to send file.' });
              }
          } else {
               // Error occurred after stream started
               console.error(`Error sending file ${filename} (headers sent):`, err);
          }
      }
  });
});

// --- Root Route (Unchanged) ---
app.get('/', (req, res) => res.send('Hello World from Memeflix Backend!'));

// --- Start Server (Unchanged) ---
app.listen(PORT, () => console.log(`Memeflix backend server running on http://localhost:${PORT}`));

// --- Graceful Shutdown (Unchanged) ---
process.on('SIGINT', () => {
  console.log("SIGINT received. Closing database connection...");
  db.close((err) => {
    if (err) {
      console.error('Error closing database on shutdown:', err.message);
      process.exit(1);
    } else {
      console.log('Database connection closed successfully.');
      process.exit(0);
    }
  });
});