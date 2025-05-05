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
  else { console.log(`Connected to the SQLite database at ${dbPath}`); db.run('PRAGMA foreign_keys = ON;'); }
});

app.use(cors());
app.use(express.json());

// Middleware (Unchanged)
const getUserIfAuthenticated = (req, res, next) => { const authHeader = req.headers['authorization']; const token = authHeader && authHeader.split(' ')[1]; if (token == null) { req.user = null; return next(); } jwt.verify(token, JWT_SECRET, (err, user) => { if (err) { req.user = null; } else { req.user = user; } next(); }); };
const authenticateToken = (req, res, next) => { if (!req.user) { return res.sendStatus(401); } next(); };

// Database Helpers (Unchanged)
function runDb(sql, params = []) { return new Promise((resolve, reject) => { db.run(sql, params, function(err) { if (err) reject(err); else resolve(this); }); }); }
function getDb(sql, params = []) { return new Promise((resolve, reject) => { db.get(sql, params, (err, row) => { if (err) reject(err); else resolve(row); }); }); }
function allDb(sql, params = []) { return new Promise((resolve, reject) => { db.all(sql, params, (err, rows) => { if (err) reject(err); else resolve(rows); }); }); }

// Auth Routes (Unchanged)
app.post('/api/auth/register', async (req, res) => { const { username, email, password } = req.body; if (!username || !email || !password) return res.status(400).json({ error: 'Missing required fields.' }); try { const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS); const result = await runDb("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)", [username, email, hashedPassword]); res.status(201).json({ message: 'User registered.', userId: result.lastID }); } catch (err) { if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Username or email already exists.' }); console.error("DB register error:", err.message); return res.status(500).json({ error: 'Database error.' }); } });
app.post('/api/auth/login', async (req, res) => { const { username, password } = req.body; if (!username || !password) return res.status(400).json({ error: 'Missing fields.' }); try { const user = await getDb("SELECT * FROM users WHERE username = ?", [username]); if (!user) return res.status(401).json({ error: 'Invalid credentials.' }); const match = await bcrypt.compare(password, user.password_hash); if (match) { const userPayload = { id: user.id, username: user.username }; const accessToken = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '1h' }); res.json({ accessToken: accessToken, user: userPayload }); } else { res.status(401).json({ error: 'Invalid credentials.' }); } } catch (err) { console.error("Login process error:", err.message); res.status(500).json({ error: 'Server error during login.' }); } });
app.get('/api/auth/me', getUserIfAuthenticated, authenticateToken, async (req, res) => { try { const userRow = await getDb("SELECT id, username, email, created_at FROM users WHERE id = ?", [req.user.id]); if (!userRow) return res.status(404).json({ error: 'User not found' }); res.json(userRow); } catch (err) { console.error("DB /me error:", err.message); return res.status(500).json({ error: 'Database error' }); } });


// --- *** UPDATED Base Meme Select Logic *** ---
// Select fields now include conditional is_viewed AND user_vote_status
const baseMemeSelectFields = (userId) => `
    m.id, m.title, m.description, m.filename, m.type, m.filepath,
    m.upvotes, m.downvotes, m.uploaded_at,
    GROUP_CONCAT(DISTINCT t.name) as tags,
    ${userId ? `MAX(CASE WHEN vh.user_id = ? THEN 1 ELSE 0 END) as is_viewed` : '0 as is_viewed'},
    ${userId ? `COALESCE(uv.vote_type, 0) as user_vote_status` : '0 as user_vote_status'}
`;
// Joins now conditionally include viewing_history AND user_votes if userId is provided
const baseMemeJoins = (userId) => `
    FROM memes m
    LEFT JOIN meme_tags mt ON m.id = mt.meme_id
    LEFT JOIN tags t ON mt.tag_id = t.tag_id
    ${userId ? `LEFT JOIN viewing_history vh ON m.id = vh.meme_id AND vh.user_id = ?` : ''}
    ${userId ? `LEFT JOIN user_votes uv ON m.id = uv.meme_id AND uv.user_id = ?` : ''}
`;

// Helper to add user ID parameter(s) if needed
const addUserIdParamIfNeeded = (baseParams, userId) => {
    const params = [...baseParams];
    if (userId) {
        // Order matters: Add params for JOINs first, then SELECT's CASE
        params.unshift(userId); // For user_votes JOIN condition
        params.unshift(userId); // For viewing_history JOIN condition
        params.unshift(userId); // For is_viewed CASE statement in SELECT
    }
    return params;
};
// Helper for cases where user ID is only needed for SELECT (like random)
const addUserIdParamForSelectOnly = (baseParams, userId) => {
    const params = [...baseParams];
    if (userId) {
        params.unshift(userId); // For is_viewed CASE statement ONLY
        // user_vote_status is handled by the main join helper now
    }
    return params;
}


// --- UPDATED Meme Routes to use new base select/join ---
app.get('/api/memes', getUserIfAuthenticated, async (req, res) => {
  const page = parseInt(req.query.page || '1', 10);
  const limit = parseInt(req.query.limit || '12', 10);
  if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1) return res.status(400).json({ error: 'Invalid page/limit.' });
  const offset = (page - 1) * limit;
  const userId = req.user ? req.user.id : null;

  const sqlGetData = ` SELECT ${baseMemeSelectFields(userId)} ${baseMemeJoins(userId)} GROUP BY m.id ORDER BY m.uploaded_at DESC LIMIT ? OFFSET ? `;
  const sqlGetCount = `SELECT COUNT(*) as totalMemes FROM memes`;
  const params = addUserIdParamIfNeeded([limit, offset], userId);

  try { const [totalRow, memesForPage] = await Promise.all([ getDb(sqlGetCount), allDb(sqlGetData, params) ]); const totalMemes = totalRow?.totalMemes || 0; const totalPages = Math.ceil(totalMemes / limit); res.status(200).json({ memes: memesForPage || [], pagination: { currentPage: page, totalPages: totalPages, totalMemes: totalMemes, limit: limit } }); } catch (err) { console.error("DB fetch memes error:", err.message); res.status(500).json({ error: 'Failed to retrieve memes.' }); }
});

app.get('/api/memes/random', getUserIfAuthenticated, async (req, res) => {
    const userId = req.user ? req.user.id : null;
    const sql = ` SELECT ${baseMemeSelectFields(userId)} ${baseMemeJoins(userId)} WHERE m.id IS NOT NULL GROUP BY m.id ORDER BY RANDOM() LIMIT 1 `;
    const params = addUserIdParamIfNeeded([], userId); // Pass user ID for joins/select
    try { const randomMeme = await getDb(sql, params); if (!randomMeme) { return res.status(404).json({ error: 'No memes found.' }); } res.status(200).json({ meme: randomMeme }); } catch (err) { console.error("DB fetch random meme error:", err.message); res.status(500).json({ error: 'Failed to retrieve a random meme.' }); }
});

app.get('/api/memes/search', getUserIfAuthenticated, async (req, res) => {
    const query = req.query.q || ''; const filterType = req.query.type || ''; const sortBy = req.query.sort || 'newest'; const filterTag = req.query.tag || ''; const page = parseInt(req.query.page || '1', 10); const limit = parseInt(req.query.limit || '12', 10); if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1) { return res.status(400).json({ error: 'Invalid page or limit parameter.' }); } const offset = (page - 1) * limit;
    const userId = req.user ? req.user.id : null;

    let whereClauses = []; let filterParams = []; let countParams = [];
    let joins = baseMemeJoins(userId); // Base joins include conditional user joins
    let countJoins = baseMemeJoins(null); // Count joins don't need user joins

    if (query) { const condition = `(lower(m.title) LIKE ? OR lower(m.description) LIKE ? OR lower(m.filename) LIKE ?)`; whereClauses.push(condition); const searchTerm = `%${query.toLowerCase()}%`; filterParams.push(searchTerm, searchTerm, searchTerm); countParams.push(searchTerm, searchTerm, searchTerm); }
    const validTypes = ['image', 'gif', 'video']; if (filterType && validTypes.includes(filterType.toLowerCase())) { whereClauses.push(`lower(m.type) = ?`); filterParams.push(filterType.toLowerCase()); countParams.push(filterType.toLowerCase()); }
    if (filterTag) {
        // Adjust joins: INNER for filtering, LEFT for getting all tags/user data
        joins = ` FROM memes m INNER JOIN meme_tags mt_filter ON m.id = mt_filter.meme_id INNER JOIN tags t_filter ON mt_filter.tag_id = t_filter.tag_id LEFT JOIN meme_tags mt ON m.id = mt.meme_id LEFT JOIN tags t ON mt.tag_id = t.tag_id ${userId ? `LEFT JOIN viewing_history vh ON m.id = vh.meme_id AND vh.user_id = ?` : ''} ${userId ? `LEFT JOIN user_votes uv ON m.id = uv.meme_id AND uv.user_id = ?` : ''} `;
        countJoins = ` FROM memes m INNER JOIN meme_tags mt_filter ON m.id = mt_filter.meme_id INNER JOIN tags t_filter ON mt_filter.tag_id = t_filter.tag_id `;
        whereClauses.push(`lower(t_filter.name) = lower(?)`); filterParams.push(filterTag); countParams.push(filterTag);
    }

    const baseCondition = 'm.id IS NOT NULL'; const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : `WHERE ${baseCondition}`;
    let orderBySql = 'ORDER BY '; switch (sortBy.toLowerCase()) { case 'oldest': orderBySql += 'm.uploaded_at ASC'; break; case 'score': orderBySql += '(m.upvotes - m.downvotes) DESC, m.uploaded_at DESC'; break; case 'newest': default: orderBySql += 'm.uploaded_at DESC'; break; }

    const sqlGetData = ` SELECT ${baseMemeSelectFields(userId)} ${joins} ${whereSql} GROUP BY m.id ${orderBySql} LIMIT ? OFFSET ? `;
    const dataParams = addUserIdParamIfNeeded([...filterParams, limit, offset], userId);
    const sqlGetCount = ` SELECT COUNT(DISTINCT m.id) as totalMemes ${countJoins} ${whereSql} `;

    try { const [totalRow, memesForPage] = await Promise.all([ getDb(sqlGetCount, countParams), allDb(sqlGetData, dataParams) ]); const totalMemes = totalRow?.totalMemes || 0; const totalPages = Math.ceil(totalMemes / limit); res.status(200).json({ memes: memesForPage || [], pagination: { currentPage: page, totalPages: totalPages, totalMemes: totalMemes, limit: limit } });
    } catch (err) { console.error("DB search error:", err.message); console.error("SQL Count:", sqlGetCount); console.error("Count Params:", countParams); console.error("SQL Data:", sqlGetData); console.error("Data Params:", dataParams); return res.status(500).json({ error: 'Search failed due to database error.' }); }
});


// Related Tags Endpoint (Unchanged)
app.get('/api/memes/:id/related-tags', async (req, res) => { const memeId = parseInt(req.params.id, 10); const limit = parseInt(req.query.limit || '5', 10); if (isNaN(memeId)) return res.status(400).json({ error: 'Invalid Meme ID.' }); if (isNaN(limit) || limit < 1) return res.status(400).json({ error: 'Invalid limit.' }); try { const originalTagsSql = `SELECT tag_id FROM meme_tags WHERE meme_id = ?`; const originalTagRows = await allDb(originalTagsSql, [memeId]); const originalTagIds = originalTagRows.map(row => row.tag_id); if (originalTagIds.length === 0) { return res.status(200).json({ relatedTags: [] }); } const placeholders = originalTagIds.map(() => '?').join(','); const relatedTagsSql = ` SELECT t.name, COUNT(t.tag_id) as frequency FROM meme_tags mt_sibling JOIN tags t ON mt_sibling.tag_id = t.tag_id WHERE mt_sibling.meme_id != ? AND mt_sibling.tag_id NOT IN (${placeholders}) AND mt_sibling.meme_id IN ( SELECT DISTINCT meme_id FROM meme_tags WHERE tag_id IN (${placeholders}) AND meme_id != ? ) GROUP BY mt_sibling.tag_id ORDER BY frequency DESC, t.name ASC LIMIT ? `; const params = [memeId, ...originalTagIds, ...originalTagIds, memeId, limit]; const relatedTags = await allDb(relatedTagsSql, params); res.status(200).json({ relatedTags: relatedTags.map(row => row.name) || [] }); } catch (err) { console.error(`Error fetching related tags for meme ${memeId}:`, err.message); res.status(500).json({ error: 'Failed to retrieve related tags.' }); } });
// Other Tag Routes (Unchanged)
app.get('/api/tags/popular', async (req, res) => { const limit = parseInt(req.query.limit || '10', 10); const sql = ` SELECT t.name as tag, COUNT(mt.meme_id) as count FROM tags t JOIN meme_tags mt ON t.tag_id = mt.tag_id GROUP BY t.tag_id ORDER BY count DESC, t.name ASC LIMIT ? `; try { const popularTags = await allDb(sql, [limit]); res.status(200).json({ popularTags: popularTags || [] }); } catch (err) { console.error("Error fetching popular tags:", err.message); return res.status(500).json({ error: 'Database error fetching tags.' }); } });
app.get('/api/tags/all', async (req, res) => { const sql = `SELECT name FROM tags ORDER BY name ASC`; try { const tags = await allDb(sql); res.status(200).json({ tags: tags.map(t => t.name) || [] }); } catch (err) { console.error("Error fetching all tags:", err.message); return res.status(500).json({ error: 'Database error fetching all tags.' }); } });
app.get('/api/memes/by-tag/:tag', getUserIfAuthenticated, async (req, res) => { const tag = req.params.tag; const limit = parseInt(req.query.limit || '10', 10); if (!tag) return res.status(400).json({ error: 'Tag parameter is required.' }); if (isNaN(limit) || limit < 1) return res.status(400).json({ error: 'Invalid limit parameter.' }); const userId = req.user ? req.user.id : null; const joins = ` FROM memes m INNER JOIN meme_tags mt_filter ON m.id = mt_filter.meme_id INNER JOIN tags t_filter ON mt_filter.tag_id = t_filter.tag_id LEFT JOIN meme_tags mt ON m.id = mt.meme_id LEFT JOIN tags t ON mt.tag_id = t.tag_id ${userId ? `LEFT JOIN viewing_history vh ON m.id = vh.meme_id AND vh.user_id = ?` : ''} ${userId ? `LEFT JOIN user_votes uv ON m.id = uv.meme_id AND uv.user_id = ?` : ''} `; const whereSql = `WHERE lower(t_filter.name) = lower(?)`; const sql = ` SELECT ${baseMemeSelectFields(userId)} ${joins} ${whereSql} GROUP BY m.id ORDER BY RANDOM() LIMIT ?`; const params = addUserIdParamIfNeeded([tag, limit], userId); try { const rows = await allDb(sql, params); res.status(200).json({ memes: rows || [] }); } catch (err) { console.error(`Error fetching tag "${tag}":`, err.message); return res.status(500).json({ error: 'DB error fetching tag memes.' }); } });

// Vote Endpoints (Unchanged logic, but added authentication middleware)
async function handleVote(userId, memeId, voteTypeInt) { const existingVote = await getDb('SELECT vote_type FROM user_votes WHERE user_id = ? AND meme_id = ?', [userId, memeId]); let upvoteChange = 0; let downvoteChange = 0; let message = ''; let status = 200; await runDb('BEGIN TRANSACTION'); try { if (existingVote) { if (existingVote.vote_type === voteTypeInt) { await runDb('DELETE FROM user_votes WHERE user_id = ? AND meme_id = ?', [userId, memeId]); if (voteTypeInt === 1) upvoteChange = -1; else downvoteChange = -1; message = 'Vote removed.'; } else { await runDb('UPDATE user_votes SET vote_type = ?, voted_at = CURRENT_TIMESTAMP WHERE user_id = ? AND meme_id = ?', [voteTypeInt, userId, memeId]); if (voteTypeInt === 1) { upvoteChange = 1; downvoteChange = -1; } else { upvoteChange = -1; downvoteChange = 1; } message = 'Vote changed.'; } } else { await runDb('INSERT INTO user_votes (user_id, meme_id, vote_type) VALUES (?, ?, ?)', [userId, memeId, voteTypeInt]); if (voteTypeInt === 1) upvoteChange = 1; else downvoteChange = 1; message = 'Vote recorded.'; status = 201; } if (upvoteChange !== 0 || downvoteChange !== 0) { await runDb('UPDATE memes SET upvotes = upvotes + ?, downvotes = downvotes + ? WHERE id = ?', [upvoteChange, downvoteChange, memeId]); } await runDb('COMMIT'); return { status, success: true, message }; } catch (err) { await runDb('ROLLBACK'); console.error(`Vote transaction error for user ${userId}, meme ${memeId}:`, err.message); throw new Error('Database error during voting process.'); } }
app.post('/api/memes/:id/upvote', getUserIfAuthenticated, authenticateToken, async (req, res) => { const memeId = parseInt(req.params.id, 10); if (isNaN(memeId)) return res.status(400).json({ error: 'Invalid Meme ID.' }); try { const result = await handleVote(req.user.id, memeId, 1); res.status(result.status).json({ message: result.message }); } catch (err) { if (err.message.includes('FOREIGN KEY constraint failed')) { return res.status(404).json({ error: 'Meme not found.' }); } res.status(500).json({ error: err.message || 'Failed to process upvote.' }); } });
app.post('/api/memes/:id/downvote', getUserIfAuthenticated, authenticateToken, async (req, res) => { const memeId = parseInt(req.params.id, 10); if (isNaN(memeId)) return res.status(400).json({ error: 'Invalid Meme ID.' }); try { const result = await handleVote(req.user.id, memeId, -1); res.status(result.status).json({ message: result.message }); } catch (err) { if (err.message.includes('FOREIGN KEY constraint failed')) { return res.status(404).json({ error: 'Meme not found.' }); } res.status(500).json({ error: err.message || 'Failed to process downvote.' }); } });

// Favorites Routes (Needs authentication)
app.get('/api/favorites/ids', getUserIfAuthenticated, authenticateToken, async (req, res) => { try { const rows = await allDb("SELECT meme_id FROM user_favorites WHERE user_id = ?", [req.user.id]); res.status(200).json({ favoriteMemeIds: rows.map(r => r.meme_id) || [] }); } catch (err) { console.error("Fav IDs error:", err.message); return res.status(500).json({ error: 'DB error fetching favorite IDs.' }); } });
app.get('/api/favorites', getUserIfAuthenticated, authenticateToken, async (req, res) => { const userId = req.user.id; const sql = ` SELECT ${baseMemeSelectFields(userId)} ${baseMemeJoins(userId)} JOIN user_favorites uf ON m.id = uf.meme_id WHERE uf.user_id = ? GROUP BY m.id ORDER BY uf.added_at DESC `; const params = addUserIdParamIfNeeded([userId], userId); try { const rows = await allDb(sql, params); res.status(200).json({ memes: rows || [] }); } catch (err) { console.error("Fetch favs error:", err.message); return res.status(500).json({ error: 'DB error fetching favorites.' }); } });
app.post('/api/favorites/:memeId', getUserIfAuthenticated, authenticateToken, async (req, res) => { const memeId = parseInt(req.params.memeId, 10); if (isNaN(memeId)) return res.status(400).json({ error: 'Invalid ID.' }); try { const result = await runDb("INSERT OR IGNORE INTO user_favorites (user_id, meme_id) VALUES (?, ?)", [req.user.id, memeId]); res.status(result.changes === 0 ? 200 : 201).json({ message: result.changes === 0 ? 'Already favorite.' : 'Added to favorites.' }); } catch (err) { console.error("Add fav error:", err.message); return res.status(500).json({ error: 'Database error adding favorite.' }); } });
app.delete('/api/favorites/:memeId', getUserIfAuthenticated, authenticateToken, async (req, res) => { const memeId = parseInt(req.params.memeId, 10); if (isNaN(memeId)) return res.status(400).json({ error: 'Invalid ID.' }); try { const result = await runDb("DELETE FROM user_favorites WHERE user_id = ? AND meme_id = ?", [req.user.id, memeId]); if (result.changes === 0) return res.status(404).json({ error: 'Favorite not found.' }); res.status(200).json({ message: 'Removed from favorites.' }); } catch (err) { console.error("Remove fav error:", err.message); return res.status(500).json({ error: 'Database error removing favorite.' }); } });

// History Routes (Needs authentication)
app.post('/api/history/:memeId', getUserIfAuthenticated, authenticateToken, async (req, res) => { const memeId = parseInt(req.params.memeId, 10); if (isNaN(memeId)) return res.status(400).json({ error: 'Invalid ID.' }); try { const memeExists = await getDb("SELECT id FROM memes WHERE id = ?", [memeId]); if (!memeExists) { return res.status(404).json({ error: 'Meme not found.' }); } await runDb("INSERT INTO viewing_history (user_id, meme_id) VALUES (?, ?)", [req.user.id, memeId]); res.status(201).json({ message: 'View recorded.' }); } catch (err) { console.error("Record history error:", err.message); return res.status(500).json({ error: 'DB error recording history.' }); } });
app.get('/api/history', getUserIfAuthenticated, authenticateToken, async (req, res) => { const limit = parseInt(req.query.limit || '50', 10); const userId = req.user.id; const sql = ` SELECT ${baseMemeSelectFields(userId)}, h.viewed_at FROM ( SELECT meme_id, MAX(viewed_at) as viewed_at FROM viewing_history WHERE user_id = ? GROUP BY meme_id ) h JOIN memes m ON m.id = h.meme_id ${baseMemeJoins(userId).substring(baseMemeJoins(userId).indexOf("LEFT JOIN"))} /* Reuse joins for tags/votes */ GROUP BY m.id ORDER BY h.viewed_at DESC LIMIT ? `; const params = addUserIdParamIfNeeded([userId, limit], userId); try { const rows = await allDb(sql, params); res.status(200).json({ memes: rows || [] }); } catch (err) { console.error("Fetch history error:", err.message); res.status(500).json({ error: 'Database error fetching history.' }); } });
app.delete('/api/history/clear', getUserIfAuthenticated, authenticateToken, async (req, res) => { const userId = req.user.id; try { const result = await runDb('DELETE FROM viewing_history WHERE user_id = ?', [userId]); console.log(`Cleared ${result.changes} history records for user ${userId}`); res.status(200).json({ message: `History cleared successfully. ${result.changes} records removed.` }); } catch (err) { console.error(`Error clearing history for user ${userId}:`, err.message); res.status(500).json({ error: 'Failed to clear viewing history.' }); } });

// Media Route (Unchanged)
app.get('/media/:filename', (req, res) => { const filename = req.params.filename; if (filename.includes('..') || filename.includes('/')) { return res.status(400).json({ error: 'Invalid filename.' }); } const filePath = path.join(__dirname, '../meme_files', filename); fs.access(filePath, fs.constants.R_OK, (err) => { if (err) { return res.status(404).json({ error: 'Media file not found.' }); } res.sendFile(filePath, (sendFileErr) => { if (sendFileErr) { if (!res.headersSent) { console.error(`[Media Route] Error sending file ${filename} (sendfile, headers not sent):`, sendFileErr); res.status(500).json({ error: 'Failed to send media file.' }); } else { console.error(`[Media Route] Error sending file ${filename} (sendfile, headers sent):`, sendFileErr); } } }); }); });
// Root Route (Unchanged)
app.get('/', (req, res) => res.send('Hello World from Memeflix Backend!'));
// Start Server (Unchanged)
app.listen(PORT, () => console.log(`Memeflix backend server running on http://localhost:${PORT}`));
// Graceful Shutdown (Unchanged)
process.on('SIGINT', () => { console.log("SIGINT received. Closing database connection..."); db.close((err) => { if (err) { console.error('Error closing database on shutdown:', err.message); process.exit(1); } else { console.log('Database connection closed successfully.'); process.exit(0); } }); });