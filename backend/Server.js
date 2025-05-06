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
// Use PORT from environment variable for Render compatibility
const PORT = process.env.PORT || 3001;
const dbPath = path.resolve(__dirname, 'memeflix.db'); // DB inside backend/
const JWT_SECRET = process.env.JWT_SECRET || 'YOUR_DEFAULT_SECRET_KEY_HERE'; // Ensure this is set in Render env vars
const SALT_ROUNDS = 10;

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        // Optionally exit if DB connection fails critically on startup
        // process.exit(1);
    } else {
        console.log(`Connected to the SQLite database at ${dbPath}`);
        db.run('PRAGMA foreign_keys = ON;'); // Enable foreign key constraints
    }
});

app.use(cors()); // Enable CORS for all origins (adjust if needed for production)
app.use(express.json()); // Parse JSON request bodies

// --- Middleware ---
// Middleware to extract user info from JWT if present, but doesn't require auth
const getUserIfAuthenticated = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN_VALUE

    if (token == null) {
        req.user = null; // No token, proceed without user
        return next();
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error("JWT verification failed:", err.message); // Log error but don't block
            req.user = null; // Invalid token, treat as not logged in
        } else {
            req.user = user; // Valid token, attach user payload { id, username }
        }
        next(); // Proceed to the next middleware or route handler
    });
};

// Middleware to require authentication
const authenticateToken = (req, res, next) => {
    if (!req.user) {
        // If getUserIfAuthenticated didn't set req.user, deny access
        return res.status(401).json({ error: 'Authentication required' }); // Use 401 Unauthorized
    }
    next(); // User is authenticated, proceed
};


// --- Database Helpers ---
function runDb(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) {
                console.error(`DB run Error on "${sql}" with params:`, params);
                console.error(err.message);
                reject(err);
            } else {
                resolve(this); // 'this' contains lastID, changes
            }
        });
    });
}

function getDb(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                console.error(`DB get Error on "${sql}" with params:`, params);
                console.error(err.message);
                reject(err);
            } else {
                resolve(row); // Returns single row or undefined
            }
        });
    });
}

function allDb(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                console.error(`DB all Error on "${sql}" with params:`, params);
                console.error(err.message);
                reject(err);
            } else {
                resolve(rows); // Returns array of rows (can be empty)
            }
        });
    });
}


// --- Auth Routes ---
app.post('/api/auth/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Username, email, and password are required.' });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        const result = await runDb("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)", [username, email, hashedPassword]);
        res.status(201).json({ message: 'User registered successfully.', userId: result.lastID });
    } catch (err) {
        if (err.message && err.message.includes('UNIQUE constraint failed')) {
             // More specific error messages
             if (err.message.includes('users.username')) {
                 return res.status(409).json({ error: 'Username already exists.' });
             } else if (err.message.includes('users.email')) {
                 return res.status(409).json({ error: 'Email already exists.' });
             } else {
                  return res.status(409).json({ error: 'Username or email already exists.' });
             }
        }
        console.error("DB register error:", err.message);
        return res.status(500).json({ error: 'Database error during registration.' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }
    try {
        const user = await getDb("SELECT id, username, password_hash FROM users WHERE username = ?", [username]);
        if (!user) {
            // Avoid saying "username not found" for security
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const match = await bcrypt.compare(password, user.password_hash);
        if (match) {
            // Don't send password hash back
            const userPayload = { id: user.id, username: user.username };
            // Generate token
            const accessToken = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '1h' }); // Consider refresh tokens for production
            res.json({ accessToken: accessToken, user: userPayload });
        } else {
            res.status(401).json({ error: 'Invalid credentials.' });
        }
    } catch (err) {
        console.error("Login process error:", err.message);
        res.status(500).json({ error: 'Server error during login.' });
    }
});

// Get current user details (protected route)
app.get('/api/auth/me', getUserIfAuthenticated, authenticateToken, async (req, res) => {
    // authenticateToken ensures req.user is set
    try {
        // Select only non-sensitive fields
        const userRow = await getDb("SELECT id, username, email, created_at FROM users WHERE id = ?", [req.user.id]);
        if (!userRow) {
            // This shouldn't happen if token is valid, but handle defensively
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(userRow);
    } catch (err) {
        console.error("DB /me error:", err.message);
        return res.status(500).json({ error: 'Database error retrieving user details' });
    }
});

// --- Base Meme Select Logic ---
const baseMemeSelectFields = (userId) => `
    m.id, m.title, m.description, m.filename, m.type, m.filepath,
    m.upvotes, m.downvotes, m.uploaded_at,
    GROUP_CONCAT(DISTINCT t.name) as tags,
    ${userId ? `MAX(CASE WHEN vh.user_id = ? THEN 1 ELSE 0 END) as is_viewed` : '0 as is_viewed'},
    ${userId ? `COALESCE(uv.vote_type, 0) as user_vote_status` : '0 as user_vote_status'}
`; // Use MAX for is_viewed aggregation

const baseMemeJoins = (userId) => `
    FROM memes m
    LEFT JOIN meme_tags mt ON m.id = mt.meme_id
    LEFT JOIN tags t ON mt.tag_id = t.tag_id
    ${userId ? `LEFT JOIN viewing_history vh ON m.id = vh.meme_id AND vh.user_id = ?` : ''}
    ${userId ? `LEFT JOIN user_votes uv ON m.id = uv.meme_id AND uv.user_id = ?` : ''}
`;

// Helper to add user ID parameters if needed (order matters!)
const addUserIdParamIfNeeded = (baseParams, userId) => {
    let userParams = [];
    if (userId) {
        // Params for SELECT (is_viewed), JOIN (vh.user_id), JOIN (uv.user_id)
        userParams = [userId, userId, userId];
    }
    // Combine user params FIRST, then base query params
    return [...userParams, ...baseParams];
};


// --- Meme Routes ---

// GET /api/memes (Browse/Paginated)
app.get('/api/memes', getUserIfAuthenticated, async (req, res) => {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '12', 10);
    const sortBy = req.query.sort || 'newest'; // Read sort param
    const userId = req.user ? req.user.id : null;

    if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1 || limit > 100) { // Add upper limit safety
        return res.status(400).json({ error: 'Invalid page or limit parameter.' });
    }
    const offset = (page - 1) * limit;

    let orderBySql = 'ORDER BY ';
    switch (sortBy.toLowerCase()) {
        case 'oldest': orderBySql += 'm.uploaded_at ASC'; break;
        case 'score': orderBySql += '(m.upvotes - m.downvotes) DESC, m.uploaded_at DESC'; break;
        case 'newest':
        default: orderBySql += 'm.uploaded_at DESC'; break;
    }

    // Base WHERE clause needed for param consistency if userId is present
    // Add GROUP BY for aggregation functions
    const groupBySql = 'GROUP BY m.id';

    const sqlGetData = `
        SELECT ${baseMemeSelectFields(userId)}
        ${baseMemeJoins(userId)}
        ${groupBySql}
        ${orderBySql}
        LIMIT ? OFFSET ?
    `;
    const sqlGetCount = `SELECT COUNT(DISTINCT m.id) as totalMemes FROM memes m`; // Count distinct memes

    // Pass limit and offset as base params
    const dataParams = addUserIdParamIfNeeded([limit, offset], userId);
    const countParams = []; // No params needed for base count

    try {
        // Run queries in parallel
        const [totalRow, memesForPage] = await Promise.all([
            getDb(sqlGetCount, countParams),
            allDb(sqlGetData, dataParams)
        ]);

        const totalMemes = totalRow?.totalMemes || 0;
        const totalPages = Math.ceil(totalMemes / limit);

        res.status(200).json({
            memes: memesForPage || [],
            pagination: { currentPage: page, totalPages: totalPages, totalMemes: totalMemes, limit: limit }
        });
    } catch (err) {
        // Error already logged in helper functions
        res.status(500).json({ error: 'Failed to retrieve memes.' });
    }
});

// GET /api/memes/random
app.get('/api/memes/random', getUserIfAuthenticated, async (req, res) => {
    const userId = req.user ? req.user.id : null;
    // Need GROUP BY m.id because of GROUP_CONCAT and MAX/COALESCE aggregations
    const sql = `
        SELECT ${baseMemeSelectFields(userId)}
        ${baseMemeJoins(userId)}
        GROUP BY m.id
        ORDER BY RANDOM()
        LIMIT 1
    `;
    const params = addUserIdParamIfNeeded([], userId); // Only user params needed

    try {
        const randomMeme = await getDb(sql, params);
        if (!randomMeme) {
            return res.status(404).json({ error: 'No memes found.' });
        }
        res.status(200).json({ meme: randomMeme }); // Wrap in { meme: ... } object
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve a random meme.' });
    }
});

// --- !!! NEW: GET /api/memes/:id Endpoint !!! ---
app.get('/api/memes/:id', getUserIfAuthenticated, async (req, res) => {
    const memeId = parseInt(req.params.id, 10);
    const userId = req.user ? req.user.id : null;

    if (isNaN(memeId)) {
        return res.status(400).json({ error: 'Invalid Meme ID format.' });
    }

    // We reuse the same select fields and joins logic
    // We add a WHERE clause to filter by the specific meme ID
    const sql = `
        SELECT ${baseMemeSelectFields(userId)}
        ${baseMemeJoins(userId)}
        WHERE m.id = ?
        GROUP BY m.id
    `;
    // Parameters: userId params first (if any), then the memeId for the WHERE clause
    const params = addUserIdParamIfNeeded([memeId], userId);

    try {
        const meme = await getDb(sql, params);
        if (!meme) {
            return res.status(404).json({ error: 'Meme not found.' });
        }
        res.status(200).json({ meme: meme }); // Return the single meme object, wrapped
    } catch (err) {
        // Error logged in helper
        res.status(500).json({ error: 'Failed to retrieve meme details.' });
    }
});
// --- !!! End of NEW Endpoint !!! ---


// GET /api/memes/search
app.get('/api/memes/search', getUserIfAuthenticated, async (req, res) => {
    const query = req.query.q || '';
    const filterType = req.query.type || '';
    const sortBy = req.query.sort || 'newest';
    const filterTag = req.query.tag || '';
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '12', 10);

    if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1 || limit > 100) {
        return res.status(400).json({ error: 'Invalid page or limit parameter.' });
    }
    const offset = (page - 1) * limit;
    const userId = req.user ? req.user.id : null;

    let whereClauses = [];
    let dataFilterParams = []; // Params for the main data query WHERE clause
    let countFilterParams = []; // Params for the COUNT query WHERE clause
    let joins = baseMemeJoins(userId); // Base joins for data query
    let countBaseFrom = `FROM memes m`; // Base FROM for count query
    let countJoins = ''; // Additional joins needed for count query based on filters

    // Query filter (Title, Description, Filename)
    if (query) {
        const condition = `(lower(m.title) LIKE ? OR lower(m.description) LIKE ? OR lower(m.filename) LIKE ?)`;
        whereClauses.push(condition);
        const searchTerm = `%${query.toLowerCase()}%`;
        dataFilterParams.push(searchTerm, searchTerm, searchTerm);
        countFilterParams.push(searchTerm, searchTerm, searchTerm);
    }

    // Type filter
    const validTypes = ['image', 'gif', 'video'];
    if (filterType && validTypes.includes(filterType.toLowerCase())) {
        whereClauses.push(`lower(m.type) = ?`);
        const typeTerm = filterType.toLowerCase();
        dataFilterParams.push(typeTerm);
        countFilterParams.push(typeTerm);
    }

    // Tag filter
    if (filterTag) {
        // Need to join tags table specifically for filtering
        const tagFilterJoin = `INNER JOIN meme_tags mt_filter ON m.id = mt_filter.meme_id INNER JOIN tags t_filter ON mt_filter.tag_id = t_filter.tag_id`;
        // Add this join to both data and count queries if tag filter is active
        joins += ` ${tagFilterJoin} `;
        countJoins += ` ${tagFilterJoin} `;

        whereClauses.push(`lower(t_filter.name) = lower(?)`);
        dataFilterParams.push(filterTag.toLowerCase());
        countFilterParams.push(filterTag.toLowerCase());
    }

    // Construct WHERE clause
    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Construct ORDER BY
    let orderBySql = 'ORDER BY ';
    switch (sortBy.toLowerCase()) {
        case 'oldest': orderBySql += 'm.uploaded_at ASC'; break;
        case 'score': orderBySql += '(m.upvotes - m.downvotes) DESC, m.uploaded_at DESC'; break;
        case 'newest': default: orderBySql += 'm.uploaded_at DESC'; break;
    }

    // Construct final queries
    const groupBySql = 'GROUP BY m.id'; // Always group for data query due to aggregations

    const sqlGetData = `
        SELECT ${baseMemeSelectFields(userId)}
        ${joins}
        ${whereSql}
        ${groupBySql}
        ${orderBySql}
        LIMIT ? OFFSET ?
    `;
    // Add user ID params first, then filter params, then pagination params
    const dataParams = addUserIdParamIfNeeded([...dataFilterParams, limit, offset], userId);

    const sqlGetCount = `
        SELECT COUNT(DISTINCT m.id) as totalMemes
        ${countBaseFrom}
        ${countJoins}
        ${whereSql}
    `;
    // Count query only uses filter params
    // No user ID params needed for count itself

    try {
        const [totalRow, memesForPage] = await Promise.all([
            getDb(sqlGetCount, countFilterParams), // Use countFilterParams here
            allDb(sqlGetData, dataParams)
        ]);

        const totalMemes = totalRow?.totalMemes || 0;
        const totalPages = Math.ceil(totalMemes / limit);
        res.status(200).json({
            memes: memesForPage || [],
            pagination: { currentPage: page, totalPages: totalPages, totalMemes: totalMemes, limit: limit }
        });
    } catch (err) {
        console.error("DB search error:", err.message); // Log specific error
        res.status(500).json({ error: 'Search failed due to a database error.' });
    }
});


// GET /api/memes/:id/related-tags
app.get('/api/memes/:id/related-tags', async (req, res) => {
    const memeId = parseInt(req.params.id, 10);
    const limit = parseInt(req.query.limit || '5', 10);

    if (isNaN(memeId)) {
        return res.status(400).json({ error: 'Invalid Meme ID.' });
    }
    if (isNaN(limit) || limit < 1 || limit > 20) { // Add upper limit
        return res.status(400).json({ error: 'Invalid limit parameter.' });
    }

    try {
        // 1. Get tags of the original meme
        const originalTagsSql = `SELECT tag_id FROM meme_tags WHERE meme_id = ?`;
        const originalTagRows = await allDb(originalTagsSql, [memeId]);
        const originalTagIds = originalTagRows.map(row => row.tag_id);

        if (originalTagIds.length === 0) {
            // If the source meme has no tags, it can't have related tags based on shared tags
            return res.status(200).json({ relatedTags: [] });
        }

        // 2. Find other memes that share at least one tag with the original meme
        // 3. Find tags associated with those other memes, excluding the original meme's tags
        // 4. Count the frequency of these related tags and order by frequency
        const placeholders = originalTagIds.map(() => '?').join(','); // Creates ?,?,?
        const relatedTagsSql = `
            SELECT t.name, COUNT(t.tag_id) as frequency
            FROM meme_tags mt_related -- Tags of related memes
            JOIN tags t ON mt_related.tag_id = t.tag_id
            WHERE
                mt_related.meme_id != ? -- Exclude the original meme itself
                AND mt_related.tag_id NOT IN (${placeholders}) -- Exclude tags the original meme *already* has
                AND mt_related.meme_id IN (
                    -- Find memes (other than the original) that share tags with the original
                    SELECT DISTINCT mt_shared.meme_id
                    FROM meme_tags mt_shared
                    WHERE mt_shared.tag_id IN (${placeholders}) AND mt_shared.meme_id != ?
                )
            GROUP BY mt_related.tag_id -- Group by tag to count frequency
            ORDER BY frequency DESC, t.name ASC -- Order by most frequent, then alphabetically
            LIMIT ? -- Limit the number of related tags returned
        `;

        // Parameters: memeId (exclude original), originalTagIds (exclude tags), originalTagIds (find shared), memeId (exclude original in subquery), limit
        const params = [memeId, ...originalTagIds, ...originalTagIds, memeId, limit];
        const relatedTags = await allDb(relatedTagsSql, params);

        res.status(200).json({ relatedTags: relatedTags.map(row => row.name) || [] });
    } catch (err) {
        console.error(`Error fetching related tags for meme ${memeId}:`, err.message);
        res.status(500).json({ error: 'Failed to retrieve related tags.' });
    }
});

// --- Tag Routes ---
// GET /api/tags/popular
app.get('/api/tags/popular', async (req, res) => {
    const limit = parseInt(req.query.limit || '10', 10);
     if (isNaN(limit) || limit < 1 || limit > 50) { // Add upper limit
        return res.status(400).json({ error: 'Invalid limit parameter.' });
    }
    const sql = `
        SELECT t.name as tag, COUNT(mt.meme_id) as count
        FROM tags t
        JOIN meme_tags mt ON t.tag_id = mt.tag_id
        GROUP BY t.tag_id
        ORDER BY count DESC, t.name ASC
        LIMIT ?
    `;
    try {
        const popularTags = await allDb(sql, [limit]);
        res.status(200).json({ popularTags: popularTags || [] });
    } catch (err) {
        res.status(500).json({ error: 'Database error fetching popular tags.' });
    }
});

// GET /api/tags/all
app.get('/api/tags/all', async (req, res) => {
    const sql = `SELECT name FROM tags ORDER BY name ASC`;
    try {
        const tags = await allDb(sql);
        res.status(200).json({ tags: tags.map(t => t.name) || [] });
    } catch (err) {
        res.status(500).json({ error: 'Database error fetching all tags.' });
    }
});

// GET /api/memes/by-tag/:tag
app.get('/api/memes/by-tag/:tag', getUserIfAuthenticated, async (req, res) => {
    const tag = req.params.tag;
    const limit = parseInt(req.query.limit || '12', 10); // Use same default as browse?
    const userId = req.user ? req.user.id : null;

    if (!tag) {
        return res.status(400).json({ error: 'Tag parameter is required.' });
    }
    if (isNaN(limit) || limit < 1 || limit > 100) { // Add upper limit
        return res.status(400).json({ error: 'Invalid limit parameter.' });
    }

    // Need to join tags specifically for filtering
    const joins = `
        ${baseMemeJoins(userId)}
        INNER JOIN meme_tags mt_filter ON m.id = mt_filter.meme_id
        INNER JOIN tags t_filter ON mt_filter.tag_id = t_filter.tag_id
    `;
    const whereSql = `WHERE lower(t_filter.name) = lower(?)`;
    const groupBySql = 'GROUP BY m.id'; // Still need group by for base selects
    const orderBySql = 'ORDER BY m.uploaded_at DESC'; // Default sort for tag rows

    const sql = `
        SELECT ${baseMemeSelectFields(userId)}
        ${joins}
        ${whereSql}
        ${groupBySql}
        ${orderBySql}
        LIMIT ?
    `;
    const params = addUserIdParamIfNeeded([tag.toLowerCase(), limit], userId);

    try {
        const rows = await allDb(sql, params);
        res.status(200).json({ memes: rows || [] });
    } catch (err) {
        console.error(`Error fetching memes for tag "${tag}":`, err.message);
        return res.status(500).json({ error: 'Database error fetching memes for this tag.' });
    }
});


// --- Vote Endpoints ---
// Refactored vote logic into a reusable function
async function handleVote(userId, memeId, voteTypeInt) {
    // Check if meme exists first (optional but good practice)
    const memeExists = await getDb('SELECT id FROM memes WHERE id = ?', [memeId]);
    if (!memeExists) {
         throw new Error('Meme not found.'); // Custom error type could be used
    }

    const existingVote = await getDb('SELECT vote_type FROM user_votes WHERE user_id = ? AND meme_id = ?', [userId, memeId]);

    let upvoteChange = 0;
    let downvoteChange = 0;
    let message = '';
    let status = 200; // Default status for update/delete

    // Use transaction for atomicity
    await runDb('BEGIN TRANSACTION');
    try {
        if (existingVote) {
            // User is changing or removing their vote
            if (existingVote.vote_type === voteTypeInt) {
                // Removing the same vote
                await runDb('DELETE FROM user_votes WHERE user_id = ? AND meme_id = ?', [userId, memeId]);
                if (voteTypeInt === 1) upvoteChange = -1; else downvoteChange = -1;
                message = 'Vote removed.';
            } else {
                // Changing vote (e.g., upvote to downvote)
                await runDb('UPDATE user_votes SET vote_type = ?, voted_at = CURRENT_TIMESTAMP WHERE user_id = ? AND meme_id = ?', [voteTypeInt, userId, memeId]);
                if (voteTypeInt === 1) { upvoteChange = 1; downvoteChange = -1; } // Changed to upvote
                else { upvoteChange = -1; downvoteChange = 1; } // Changed to downvote
                message = 'Vote changed.';
            }
        } else {
            // New vote
            await runDb('INSERT INTO user_votes (user_id, meme_id, vote_type) VALUES (?, ?, ?)', [userId, memeId, voteTypeInt]);
            if (voteTypeInt === 1) upvoteChange = 1; else downvoteChange = 1;
            message = 'Vote recorded.';
            status = 201; // Status Created for new vote
        }

        // Update the meme's vote counts only if changes occurred
        if (upvoteChange !== 0 || downvoteChange !== 0) {
            await runDb('UPDATE memes SET upvotes = upvotes + ?, downvotes = downvotes + ? WHERE id = ?', [upvoteChange, downvoteChange, memeId]);
        }

        await runDb('COMMIT'); // Commit transaction

        // Fetch the updated vote counts after commit
        const updatedCounts = await getDb('SELECT upvotes, downvotes FROM memes WHERE id = ?', [memeId]);

        return { status, success: true, message, updatedCounts: updatedCounts || { upvotes: 0, downvotes: 0 } };

    } catch (err) {
        await runDb('ROLLBACK'); // Rollback on error
        console.error(`Vote transaction error for user ${userId}, meme ${memeId}:`, err.message);
        // Rethrow specific errors if needed, or a generic one
        if (err.message.includes('FOREIGN KEY constraint failed') && !memeExists) {
             throw new Error('Meme not found.'); // More specific error based on initial check
        }
        throw new Error('Database error during voting process.');
    }
}

// POST /api/memes/:id/upvote
app.post('/api/memes/:id/upvote', getUserIfAuthenticated, authenticateToken, async (req, res) => {
    const memeId = parseInt(req.params.id, 10);
    if (isNaN(memeId)) {
        return res.status(400).json({ error: 'Invalid Meme ID.' });
    }
    try {
        const result = await handleVote(req.user.id, memeId, 1); // 1 for upvote
        res.status(result.status).json({ message: result.message, counts: result.updatedCounts });
    } catch (err) {
        if (err.message === 'Meme not found.') {
             return res.status(404).json({ error: err.message });
        }
        // Logged in handleVote
        res.status(500).json({ error: err.message || 'Failed to process upvote.' });
    }
});

// POST /api/memes/:id/downvote
app.post('/api/memes/:id/downvote', getUserIfAuthenticated, authenticateToken, async (req, res) => {
    const memeId = parseInt(req.params.id, 10);
    if (isNaN(memeId)) {
        return res.status(400).json({ error: 'Invalid Meme ID.' });
    }
    try {
        const result = await handleVote(req.user.id, memeId, -1); // -1 for downvote
        res.status(result.status).json({ message: result.message, counts: result.updatedCounts });
    } catch (err) {
         if (err.message === 'Meme not found.') {
             return res.status(404).json({ error: err.message });
        }
        // Logged in handleVote
        res.status(500).json({ error: err.message || 'Failed to process downvote.' });
    }
});


// --- Favorites Routes (Protected) ---
// GET /api/favorites/ids (Optimized for frontend context)
app.get('/api/favorites/ids', getUserIfAuthenticated, authenticateToken, async (req, res) => {
    try {
        const rows = await allDb("SELECT meme_id FROM user_favorites WHERE user_id = ?", [req.user.id]);
        res.status(200).json({ favoriteMemeIds: rows.map(r => r.meme_id) || [] });
    } catch (err) {
        res.status(500).json({ error: 'Database error fetching favorite IDs.' });
    }
});

// GET /api/favorites (Full favorite meme details)
app.get('/api/favorites', getUserIfAuthenticated, authenticateToken, async (req, res) => {
    const userId = req.user.id;
    // Select favorite memes, ordered by when they were added
    const sql = `
        SELECT ${baseMemeSelectFields(userId)}
        ${baseMemeJoins(userId)}
        INNER JOIN user_favorites uf ON m.id = uf.meme_id AND uf.user_id = ? -- Filter JOIN by current user
        GROUP BY m.id
        ORDER BY uf.added_at DESC
    `;
    // User ID needed for base selects/joins, and again for filtering the uf join
    const params = addUserIdParamIfNeeded([userId], userId);

    try {
        const rows = await allDb(sql, params);
        res.status(200).json({ memes: rows || [] });
    } catch (err) {
        res.status(500).json({ error: 'Database error fetching favorites.' });
    }
});

// POST /api/favorites/:memeId (Add a favorite)
app.post('/api/favorites/:memeId', getUserIfAuthenticated, authenticateToken, async (req, res) => {
    const memeId = parseInt(req.params.memeId, 10);
    if (isNaN(memeId)) {
        return res.status(400).json({ error: 'Invalid Meme ID.' });
    }
    try {
        // Check if meme exists before adding favorite
         const memeExists = await getDb('SELECT id FROM memes WHERE id = ?', [memeId]);
         if (!memeExists) {
             return res.status(404).json({ error: 'Meme not found.' });
         }
        // INSERT OR IGNORE prevents errors if already favorited
        const result = await runDb("INSERT OR IGNORE INTO user_favorites (user_id, meme_id) VALUES (?, ?)", [req.user.id, memeId]);
        res.status(result.changes === 0 ? 200 : 201).json({
            message: result.changes === 0 ? 'Meme already in favorites.' : 'Meme added to favorites.',
            added: result.changes > 0 // Include boolean indicating if add occurred
        });
    } catch (err) {
        // Handle potential foreign key errors if meme somehow deleted between check and insert (unlikely)
        if (err.message.includes('FOREIGN KEY constraint failed')) {
             return res.status(404).json({ error: 'Meme not found.' });
        }
        res.status(500).json({ error: 'Database error adding favorite.' });
    }
});

// DELETE /api/favorites/:memeId (Remove a favorite)
app.delete('/api/favorites/:memeId', getUserIfAuthenticated, authenticateToken, async (req, res) => {
    const memeId = parseInt(req.params.memeId, 10);
    if (isNaN(memeId)) {
        return res.status(400).json({ error: 'Invalid Meme ID.' });
    }
    try {
        const result = await runDb("DELETE FROM user_favorites WHERE user_id = ? AND meme_id = ?", [req.user.id, memeId]);
        if (result.changes === 0) {
            // If nothing was deleted, it wasn't a favorite
            return res.status(404).json({ error: 'Meme not found in favorites.' });
        }
        res.status(200).json({
             message: 'Meme removed from favorites.',
             removed: true // Include boolean indicating removal
        });
    } catch (err) {
        res.status(500).json({ error: 'Database error removing favorite.' });
    }
});

// --- History Routes (Protected) ---
// POST /api/history/:memeId (Record a view)
app.post('/api/history/:memeId', getUserIfAuthenticated, authenticateToken, async (req, res) => {
    const memeId = parseInt(req.params.memeId, 10);
    if (isNaN(memeId)) {
        return res.status(400).json({ error: 'Invalid Meme ID.' });
    }
    try {
        // Check if meme exists before adding history
        const memeExists = await getDb("SELECT id FROM memes WHERE id = ?", [memeId]);
        if (!memeExists) {
            return res.status(404).json({ error: 'Meme not found.' });
        }
        // Simple insert, duplicates are fine and expected for history
        await runDb("INSERT INTO viewing_history (user_id, meme_id) VALUES (?, ?)", [req.user.id, memeId]);
        res.status(201).json({ message: 'View recorded.' });
    } catch (err) {
        // Handle potential foreign key errors
         if (err.message.includes('FOREIGN KEY constraint failed')) {
             return res.status(404).json({ error: 'Meme not found.' });
         }
        res.status(500).json({ error: 'Database error recording viewing history.' });
    }
});

// GET /api/history (Get viewing history)
app.get('/api/history', getUserIfAuthenticated, authenticateToken, async (req, res) => {
    const limit = parseInt(req.query.limit || '50', 10); // Default limit
    const userId = req.user.id;
     if (isNaN(limit) || limit < 1 || limit > 200) { // Add upper limit
        return res.status(400).json({ error: 'Invalid limit parameter.' });
    }

    // Get the most recent view time for each unique meme viewed by the user
    const sql = `
        SELECT ${baseMemeSelectFields(userId)}, h.max_viewed_at
        FROM (
            SELECT meme_id, MAX(viewed_at) as max_viewed_at
            FROM viewing_history
            WHERE user_id = ?
            GROUP BY meme_id
        ) h -- Subquery finds latest view per meme for the user
        JOIN memes m ON m.id = h.meme_id -- Join back to memes table
        ${baseMemeJoins(userId).substring(baseMemeJoins(userId).indexOf("LEFT JOIN"))} /* Reuse joins */
        GROUP BY m.id -- Group results by meme ID
        ORDER BY h.max_viewed_at DESC -- Order by the latest time viewed
        LIMIT ?
    `;
    // User ID needed for subquery, base selects/joins, and limit
    const params = addUserIdParamIfNeeded([userId, limit], userId);

    try {
        const rows = await allDb(sql, params);
        res.status(200).json({ memes: rows || [] });
    } catch (err) {
        res.status(500).json({ error: 'Database error fetching viewing history.' });
    }
});

// DELETE /api/history/clear (Clear all history for the user)
app.delete('/api/history/clear', getUserIfAuthenticated, authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await runDb('DELETE FROM viewing_history WHERE user_id = ?', [userId]);
        console.log(`Cleared ${result.changes} history records for user ${userId}`);
        res.status(200).json({ message: `History cleared successfully. ${result.changes} records removed.` });
    } catch (err) {
        console.error(`Error clearing history for user ${userId}:`, err.message);
        res.status(500).json({ error: 'Failed to clear viewing history.' });
    }
});

// --- Media Route ---
// Serve static files from ../meme_files directory
// IMPORTANT: Ensure ../meme_files is deployed relative to the backend directory on Render
const mediaPath = path.resolve(__dirname, '../meme_files'); // Resolve path once
app.get('/media/:filename', (req, res) => {
    const filename = req.params.filename;

    // Basic security check against directory traversal
    if (!filename || filename.includes('..') || filename.includes('/')) {
        return res.status(400).json({ error: 'Invalid filename.' });
    }

    const filePath = path.join(mediaPath, filename);

    // Check if file exists and is readable *before* sending
    fs.access(filePath, fs.constants.R_OK, (err) => {
        if (err) {
            // Log the error server-side for debugging, but send generic 404 to client
            console.error(`[Media Route] File not found or inaccessible: ${filePath}`, err.code);
            return res.status(404).json({ error: 'Media file not found.' });
        }

        // Use express's sendFile for proper headers (Content-Type, etc.)
        res.sendFile(filePath, (sendFileErr) => {
            if (sendFileErr) {
                // Handle potential errors during file streaming
                if (!res.headersSent) {
                     console.error(`[Media Route] Error sending file ${filename} (before headers):`, sendFileErr);
                     // Don't try to send JSON if headers already sent partially
                     res.status(500).json({ error: 'Failed to send media file.' });
                } else {
                     console.error(`[Media Route] Error sending file ${filename} (after headers):`, sendFileErr);
                     // Can't send JSON, connection might be closed or broken
                }
            }
             // console.log(`[Media Route] Sent file: ${filename}`); // Optional success log
        });
    });
});

// --- Root Route ---
// Simple check to see if the backend is running
app.get('/', (req, res) => {
    res.send('Hello World from Memeflix Backend!');
});


// --- 404 Handler for API routes ---
// This should be placed after all other routes
// app.use('/api/*', (req, res) => {
//     res.status(404).json({ error: 'API endpoint not found.' });
// });


// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Memeflix backend server running on port ${PORT}`);
});

// --- Graceful Shutdown ---
process.on('SIGINT', () => {
    console.log("SIGINT received. Closing database connection...");
    db.close((err) => {
        if (err) {
            console.error('Error closing database on shutdown:', err.message);
            process.exit(1); // Exit with error code
        } else {
            console.log('Database connection closed successfully.');
            process.exit(0); // Exit cleanly
        }
    });
});

process.on('SIGTERM', () => {
     console.log("SIGTERM received. Closing database connection...");
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