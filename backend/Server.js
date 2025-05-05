// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');

const app = express();
const PORT = 3001;
const dbPath = path.resolve(__dirname, 'memeflix.db');
const JWT_SECRET = process.env.JWT_SECRET || 'YOUR_DEFAULT_SECRET_KEY_HERE';
const SALT_ROUNDS = 10;

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
  if (err) { console.error('Error opening database:', err.message); }
  else { console.log(`Connected to the SQLite database at ${dbPath}`); db.run('PRAGMA foreign_keys = ON;'); } // Enable foreign keys
});

app.use(cors());
app.use(express.json());

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) { return res.sendStatus(403); }
    req.user = user; next();
  });
};

// Database Helpers (Unchanged)
function runDb(sql, params = []) { return new Promise((resolve, reject) => { db.run(sql, params, function(err) { if (err) reject(err); else resolve(this); }); }); }
function getDb(sql, params = []) { return new Promise((resolve, reject) => { db.get(sql, params, (err, row) => { if (err) reject(err); else resolve(row); }); }); }
function allDb(sql, params = []) { return new Promise((resolve, reject) => { db.all(sql, params, (err, rows) => { if (err) reject(err); else resolve(rows); }); }); }

// Auth Routes (Unchanged)
app.post('/api/auth/register', async (req, res) => { const { username, email, password } = req.body; if (!username || !email || !password) return res.status(400).json({ error: 'Missing required fields.' }); try { const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS); const result = await runDb("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)", [username, email, hashedPassword]); res.status(201).json({ message: 'User registered.', userId: result.lastID }); } catch (err) { if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Username or email already exists.' }); console.error("DB register error:", err.message); return res.status(500).json({ error: 'Database error.' }); } });
app.post('/api/auth/login', async (req, res) => { const { username, password } = req.body; if (!username || !password) return res.status(400).json({ error: 'Missing fields.' }); try { const user = await getDb("SELECT * FROM users WHERE username = ?", [username]); if (!user) return res.status(401).json({ error: 'Invalid credentials.' }); const match = await bcrypt.compare(password, user.password_hash); if (match) { const userPayload = { id: user.id, username: user.username }; const accessToken = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '1h' }); res.json({ accessToken: accessToken, user: userPayload }); } else { res.status(401).json({ error: 'Invalid credentials.' }); } } catch (err) { console.error("Login process error:", err.message); res.status(500).json({ error: 'Server error during login.' }); } });
app.get('/api/auth/me', authenticateToken, async (req, res) => { try { const userRow = await getDb("SELECT id, username, email, created_at FROM users WHERE id = ?", [req.user.id]); if (!userRow) return res.status(404).json({ error: 'User not found' }); res.json(userRow); } catch (err) { console.error("DB /me error:", err.message); return res.status(500).json({ error: 'Database error' }); } });

// Base Meme Select Query (Unchanged)
const baseMemeSelectFields = ` m.id, m.title, m.description, m.filename, m.type, m.filepath, m.upvotes, m.downvotes, m.uploaded_at, GROUP_CONCAT(t.name) as tags `;
const baseMemeJoins = ` FROM memes m LEFT JOIN meme_tags mt ON m.id = mt.meme_id LEFT JOIN tags t ON mt.tag_id = t.tag_id `;

// Meme Routes (Unchanged)
app.get('/api/memes', async (req, res) => { const page = parseInt(req.query.page || '1', 10); const limit = parseInt(req.query.limit || '12', 10); if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1) return res.status(400).json({ error: 'Invalid page/limit.' }); const offset = (page - 1) * limit; const sqlGetData = ` SELECT ${baseMemeSelectFields} ${baseMemeJoins} GROUP BY m.id ORDER BY m.uploaded_at DESC LIMIT ? OFFSET ? `; const sqlGetCount = `SELECT COUNT(*) as totalMemes FROM memes`; try { const [totalRow, memesForPage] = await Promise.all([ getDb(sqlGetCount), allDb(sqlGetData, [limit, offset]) ]); const totalMemes = totalRow?.totalMemes || 0; const totalPages = Math.ceil(totalMemes / limit); res.status(200).json({ memes: memesForPage || [], pagination: { currentPage: page, totalPages: totalPages, totalMemes: totalMemes, limit: limit } }); } catch (err) { console.error("DB fetch memes error:", err.message); res.status(500).json({ error: 'Failed to retrieve memes.' }); } });
app.get('/api/memes/random', async (req, res) => { const sql = `SELECT ${baseMemeSelectFields} ${baseMemeJoins} WHERE m.id IS NOT NULL GROUP BY m.id ORDER BY RANDOM() LIMIT 1`; try { const randomMeme = await getDb(sql); if (!randomMeme) { return res.status(404).json({ error: 'No memes found.' }); } res.status(200).json({ meme: randomMeme }); } catch (err) { console.error("DB fetch random meme error:", err.message); res.status(500).json({ error: 'Failed to retrieve a random meme.' }); } });
app.get('/api/memes/search', async (req, res) => { const query = req.query.q || ''; const filterType = req.query.type || ''; const sortBy = req.query.sort || 'newest'; const filterTag = req.query.tag || ''; const page = parseInt(req.query.page || '1', 10); const limit = parseInt(req.query.limit || '12', 10); if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1) { return res.status(400).json({ error: 'Invalid page or limit parameter.' }); } const offset = (page - 1) * limit; let whereClauses = []; let params = []; let joins = baseMemeJoins; let countParams = []; if (query) { const condition = `(lower(m.title) LIKE ? OR lower(m.description) LIKE ? OR lower(m.filename) LIKE ?)`; whereClauses.push(condition); const searchTerm = `%${query.toLowerCase()}%`; params.push(searchTerm, searchTerm, searchTerm); countParams.push(searchTerm, searchTerm, searchTerm); } const validTypes = ['image', 'gif', 'video']; if (filterType && validTypes.includes(filterType.toLowerCase())) { whereClauses.push(`lower(m.type) = ?`); params.push(filterType.toLowerCase()); countParams.push(filterType.toLowerCase()); } if (filterTag) { joins = ` FROM memes m INNER JOIN meme_tags mt_filter ON m.id = mt_filter.meme_id INNER JOIN tags t_filter ON mt_filter.tag_id = t_filter.tag_id LEFT JOIN meme_tags mt ON m.id = mt.meme_id LEFT JOIN tags t ON mt.tag_id = t.tag_id `; whereClauses.push(`lower(t_filter.name) = lower(?)`); params.push(filterTag); countParams.push(filterTag); } else { joins = baseMemeJoins; } const baseCondition = 'm.id IS NOT NULL'; const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : `WHERE ${baseCondition}`; let orderBySql = 'ORDER BY '; switch (sortBy.toLowerCase()) { case 'oldest': orderBySql += 'm.uploaded_at ASC'; break; case 'score': orderBySql += '(m.upvotes - m.downvotes) DESC, m.uploaded_at DESC'; break; case 'newest': default: orderBySql += 'm.uploaded_at DESC'; break; } const sqlGetData = ` SELECT ${baseMemeSelectFields} ${joins} ${whereSql} GROUP BY m.id ${orderBySql} LIMIT ? OFFSET ? `; const dataParams = [...params, limit, offset]; const sqlGetCount = ` SELECT COUNT(DISTINCT m.id) as totalMemes ${joins.replace(/LEFT JOIN meme_tags mt.*?LEFT JOIN tags t.*?$/s, '')} ${whereSql} `; try { const [totalRow, memesForPage] = await Promise.all([ getDb(sqlGetCount, countParams), allDb(sqlGetData, dataParams) ]); const totalMemes = totalRow?.totalMemes || 0; const totalPages = Math.ceil(totalMemes / limit); res.status(200).json({ memes: memesForPage || [], pagination: { currentPage: page, totalPages: totalPages, totalMemes: totalMemes, limit: limit } }); } catch (err) { console.error("DB search error:", err.message); console.error("SQL Count:", sqlGetCount); console.error("Count Params:", countParams); console.error("SQL Data:", sqlGetData); console.error("Data Params:", dataParams); return res.status(500).json({ error: 'Search failed due to database error.' }); } });

// Related Tags Endpoint (Unchanged)
app.get('/api/memes/:id/related-tags', async (req, res) => { const memeId = parseInt(req.params.id, 10); const limit = parseInt(req.query.limit || '5', 10); if (isNaN(memeId)) return res.status(400).json({ error: 'Invalid Meme ID.' }); if (isNaN(limit) || limit < 1) return res.status(400).json({ error: 'Invalid limit.' }); try { const originalTagsSql = `SELECT tag_id FROM meme_tags WHERE meme_id = ?`; const originalTagRows = await allDb(originalTagsSql, [memeId]); const originalTagIds = originalTagRows.map(row => row.tag_id); if (originalTagIds.length === 0) { return res.status(200).json({ relatedTags: [] }); } const placeholders = originalTagIds.map(() => '?').join(','); const relatedTagsSql = ` SELECT t.name, COUNT(t.tag_id) as frequency FROM meme_tags mt_sibling JOIN tags t ON mt_sibling.tag_id = t.tag_id WHERE mt_sibling.meme_id != ? AND mt_sibling.tag_id NOT IN (${placeholders}) AND mt_sibling.meme_id IN ( SELECT DISTINCT meme_id FROM meme_tags WHERE tag_id IN (${placeholders}) AND meme_id != ? ) GROUP BY mt_sibling.tag_id ORDER BY frequency DESC, t.name ASC LIMIT ? `; const params = [memeId, ...originalTagIds, ...originalTagIds, memeId, limit]; const relatedTags = await allDb(relatedTagsSql, params); res.status(200).json({ relatedTags: relatedTags.map(row => row.name) || [] }); } catch (err) { console.error(`Error fetching related tags for meme ${memeId}:`, err.message); res.status(500).json({ error: 'Failed to retrieve related tags.' }); } });
// Other Tag Routes (Unchanged)
app.get('/api/tags/popular', async (req, res) => { const limit = parseInt(req.query.limit || '10', 10); const sql = ` SELECT t.name as tag, COUNT(mt.meme_id) as count FROM tags t JOIN meme_tags mt ON t.tag_id = mt.tag_id GROUP BY t.tag_id ORDER BY count DESC, t.name ASC LIMIT ? `; try { const popularTags = await allDb(sql, [limit]); res.status(200).json({ popularTags: popularTags || [] }); } catch (err) { console.error("Error fetching popular tags:", err.message); return res.status(500).json({ error: 'Database error fetching tags.' }); } });
app.get('/api/tags/all', async (req, res) => { const sql = `SELECT name FROM tags ORDER BY name ASC`; try { const tags = await allDb(sql); res.status(200).json({ tags: tags.map(t => t.name) || [] }); } catch (err) { console.error("Error fetching all tags:", err.message); return res.status(500).json({ error: 'Database error fetching all tags.' }); } });
app.get('/api/memes/by-tag/:tag', async (req, res) => { const tag = req.params.tag; const limit = parseInt(req.query.limit || '10', 10); if (!tag) return res.status(400).json({ error: 'Tag parameter is required.' }); if (isNaN(limit) || limit < 1) return res.status(400).json({ error: 'Invalid limit parameter.' }); const sql = ` SELECT ${baseMemeSelectFields} FROM memes m INNER JOIN meme_tags mt_filter ON m.id = mt_filter.meme_id INNER JOIN tags t_filter ON mt_filter.tag_id = t_filter.tag_id LEFT JOIN meme_tags mt ON m.id = mt.meme_id LEFT JOIN tags t ON mt.tag_id = t.tag_id WHERE lower(t_filter.name) = lower(?) GROUP BY m.id ORDER BY RANDOM() LIMIT ?`; try { const rows = await allDb(sql, [tag, limit]); res.status(200).json({ memes: rows || [] }); } catch (err) { console.error(`Error fetching tag "${tag}":`, err.message); return res.status(500).json({ error: 'DB error fetching tag memes.' }); } });


// --- Vote Endpoints - UPDATED ---
// Helper function to handle vote logic
async function handleVote(userId, memeId, voteTypeInt) {
    const existingVote = await getDb(
        'SELECT vote_type FROM user_votes WHERE user_id = ? AND meme_id = ?',
        [userId, memeId]
    );

    let upvoteChange = 0;
    let downvoteChange = 0;
    let message = '';
    let status = 200;

    await runDb('BEGIN TRANSACTION'); // Start transaction for atomic updates

    try {
        if (existingVote) {
            // User has voted before
            if (existingVote.vote_type === voteTypeInt) {
                // User is clicking the same vote again - remove the vote
                await runDb('DELETE FROM user_votes WHERE user_id = ? AND meme_id = ?', [userId, memeId]);
                if (voteTypeInt === 1) upvoteChange = -1; else downvoteChange = -1;
                message = 'Vote removed.';
            } else {
                // User is changing their vote
                await runDb('UPDATE user_votes SET vote_type = ?, voted_at = CURRENT_TIMESTAMP WHERE user_id = ? AND meme_id = ?',
                           [voteTypeInt, userId, memeId]);
                if (voteTypeInt === 1) { // Changing to upvote (was downvote)
                    upvoteChange = 1;
                    downvoteChange = -1;
                } else { // Changing to downvote (was upvote)
                    upvoteChange = -1;
                    downvoteChange = 1;
                }
                message = 'Vote changed.';
            }
        } else {
            // User is voting for the first time
            await runDb('INSERT INTO user_votes (user_id, meme_id, vote_type) VALUES (?, ?, ?)',
                       [userId, memeId, voteTypeInt]);
            if (voteTypeInt === 1) upvoteChange = 1; else downvoteChange = 1;
            message = 'Vote recorded.';
            status = 201; // Created new vote
        }

        // Update the counts in the memes table if changes occurred
        if (upvoteChange !== 0 || downvoteChange !== 0) {
            await runDb(
                'UPDATE memes SET upvotes = upvotes + ?, downvotes = downvotes + ? WHERE id = ?',
                [upvoteChange, downvoteChange, memeId]
            );
        }

        await runDb('COMMIT'); // Commit transaction
        return { status, success: true, message };

    } catch (err) {
        await runDb('ROLLBACK'); // Rollback on any error
        console.error(`Vote transaction error for user ${userId}, meme ${memeId}:`, err.message);
        throw new Error('Database error during voting process.'); // Re-throw for endpoint handler
    }
}

app.post('/api/memes/:id/upvote', authenticateToken, async (req, res) => {
  const memeId = parseInt(req.params.id, 10);
  if (isNaN(memeId)) return res.status(400).json({ error: 'Invalid Meme ID.' });

  try {
    const result = await handleVote(req.user.id, memeId, 1); // voteTypeInt = 1 for upvote
    res.status(result.status).json({ message: result.message });
  } catch (err) {
    // Handle potential FK constraint error if meme doesn't exist
    if (err.message.includes('FOREIGN KEY constraint failed')) {
        return res.status(404).json({ error: 'Meme not found.' });
    }
    res.status(500).json({ error: err.message || 'Failed to process upvote.' });
  }
});

app.post('/api/memes/:id/downvote', authenticateToken, async (req, res) => {
  const memeId = parseInt(req.params.id, 10);
  if (isNaN(memeId)) return res.status(400).json({ error: 'Invalid Meme ID.' });

  try {
    const result = await handleVote(req.user.id, memeId, -1); // voteTypeInt = -1 for downvote
    res.status(result.status).json({ message: result.message });
  } catch (err) {
     if (err.message.includes('FOREIGN KEY constraint failed')) {
        return res.status(404).json({ error: 'Meme not found.' });
    }
    res.status(500).json({ error: err.message || 'Failed to process downvote.' });
  }
});
// --- End Vote Endpoints ---


// Favorites Routes (Unchanged)
app.get('/api/favorites/ids', authenticateToken, async (req, res) => { try { const rows = await allDb("SELECT meme_id FROM user_favorites WHERE user_id = ?", [req.user.id]); res.status(200).json({ favoriteMemeIds: rows.map(r => r.meme_id) || [] }); } catch (err) { console.error("Fav IDs error:", err.message); return res.status(500).json({ error: 'DB error fetching favorite IDs.' }); } });
app.get('/api/favorites', authenticateToken, async (req, res) => { const sql = ` SELECT ${baseMemeSelectFields} ${baseMemeJoins} JOIN user_favorites uf ON m.id = uf.meme_id WHERE uf.user_id = ? GROUP BY m.id ORDER BY uf.added_at DESC `; try { const rows = await allDb(sql, [req.user.id]); res.status(200).json({ memes: rows || [] }); } catch (err) { console.error("Fetch favs error:", err.message); return res.status(500).json({ error: 'DB error fetching favorites.' }); } });
app.post('/api/favorites/:memeId', authenticateToken, async (req, res) => { const memeId = parseInt(req.params.memeId, 10); if (isNaN(memeId)) return res.status(400).json({ error: 'Invalid ID.' }); try { const result = await runDb("INSERT OR IGNORE INTO user_favorites (user_id, meme_id) VALUES (?, ?)", [req.user.id, memeId]); res.status(result.changes === 0 ? 200 : 201).json({ message: result.changes === 0 ? 'Already favorite.' : 'Added to favorites.' }); } catch (err) { console.error("Add fav error:", err.message); return res.status(500).json({ error: 'Database error adding favorite.' }); } });
app.delete('/api/favorites/:memeId', authenticateToken, async (req, res) => { const memeId = parseInt(req.params.memeId, 10); if (isNaN(memeId)) return res.status(400).json({ error: 'Invalid ID.' }); try { const result = await runDb("DELETE FROM user_favorites WHERE user_id = ? AND meme_id = ?", [req.user.id, memeId]); if (result.changes === 0) return res.status(404).json({ error: 'Favorite not found.' }); res.status(200).json({ message: 'Removed from favorites.' }); } catch (err) { console.error("Remove fav error:", err.message); return res.status(500).json({ error: 'Database error removing favorite.' }); } });
// History Routes (Unchanged)
app.post('/api/history/:memeId', authenticateToken, async (req, res) => { const memeId = parseInt(req.params.memeId, 10); if (isNaN(memeId)) return res.status(400).json({ error: 'Invalid ID.' }); try { const memeExists = await getDb("SELECT id FROM memes WHERE id = ?", [memeId]); if (!memeExists) { return res.status(404).json({ error: 'Meme not found.' }); } await runDb("INSERT INTO viewing_history (user_id, meme_id) VALUES (?, ?)", [req.user.id, memeId]); res.status(201).json({ message: 'View recorded.' }); } catch (err) { console.error("Record history error:", err.message); return res.status(500).json({ error: 'DB error recording history.' }); } });
app.get('/api/history', authenticateToken, async (req, res) => { const limit = parseInt(req.query.limit || '50', 10); const sql = ` SELECT ${baseMemeSelectFields}, h.viewed_at FROM ( SELECT meme_id, MAX(viewed_at) as viewed_at FROM viewing_history WHERE user_id = ? GROUP BY meme_id ) h JOIN memes m ON m.id = h.meme_id LEFT JOIN meme_tags mt ON m.id = mt.meme_id LEFT JOIN tags t ON mt.tag_id = t.tag_id GROUP BY m.id ORDER BY h.viewed_at DESC LIMIT ? `; try { const rows = await allDb(sql, [req.user.id, limit]); res.status(200).json({ memes: rows || [] }); } catch (err) { console.error("Fetch history error:", err.message); return res.status(500).json({ error: 'Database error fetching history.' }); } });
// Media Route (Unchanged)
app.get('/media/:filename', (req, res) => { const filename = req.params.filename; if (filename.includes('..') || filename.includes('/')) { return res.status(400).json({ error: 'Invalid filename.' }); } const filePath = path.join(__dirname, '../meme_files', filename); fs.access(filePath, fs.constants.R_OK, (err) => { if (err) { return res.status(404).json({ error: 'Media file not found.' }); } res.sendFile(filePath, (sendFileErr) => { if (sendFileErr) { if (!res.headersSent) { console.error(`[Media Route] Error sending file ${filename} (sendfile, headers not sent):`, sendFileErr); res.status(500).json({ error: 'Failed to send media file.' }); } else { console.error(`[Media Route] Error sending file ${filename} (sendfile, headers sent):`, sendFileErr); } } }); }); });
// Root Route (Unchanged)
app.get('/', (req, res) => res.send('Hello World from Memeflix Backend!'));
// Start Server (Unchanged)
app.listen(PORT, () => console.log(`Memeflix backend server running on http://localhost:${PORT}`));
// Graceful Shutdown (Unchanged)
process.on('SIGINT', () => { console.log("SIGINT received. Closing database connection..."); db.close((err) => { if (err) { console.error('Error closing database on shutdown:', err.message); process.exit(1); } else { console.log('Database connection closed successfully.'); process.exit(0); } }); });