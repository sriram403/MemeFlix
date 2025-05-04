// backend/database/populateDb.js
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.resolve(__dirname, '../memeflix.db');
const csvFilePath = path.resolve(__dirname, 'memes.csv');

let db; // Declare db outside so it can be accessed in finally block

// --- Helper to run single DB query with async/await ---
function runDb(sql, params = []) {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error("Database not connected"));
        db.run(sql, params, function(err) {
            if (err) {
                // console.error(`DB Error on "${sql}" with params:`, params, `Error: ${err.message}`);
                reject(new Error(`DB Error on "${sql}": ${err.message}`));
            } else {
                resolve(this);
            }
        });
    });
}

// --- Helper to get single row ---
function getDb(sql, params = []) {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error("Database not connected"));
        db.get(sql, params, (err, row) => {
            if (err) {
                // console.error(`DB Error on "${sql}" with params:`, params, `Error: ${err.message}`);
                reject(new Error(`DB Error on "${sql}": ${err.message}`));
            } else {
                resolve(row);
            }
        });
    });
}

async function processMemeRow(row, rowIndex) {
    // console.log(`[Row ${rowIndex}] Processing:`, row);
    if (!row.title || !row.filename || !row.type || !row.filepath) {
        console.warn(`[Row ${rowIndex}] Skipping invalid row (missing required fields):`, row.filename || 'N/A');
        return { status: 'skipped_invalid' };
    }

    const memeFilename = row.filename;

    try {
        // 1. Insert the meme
        const insertMemeSql = `INSERT OR IGNORE INTO memes (title, description, filename, type, filepath, upvotes, downvotes) VALUES (?, ?, ?, ?, ?, 0, 0)`;
        const memeInsertResult = await runDb(insertMemeSql, [
            row.title,
            row.description || '',
            memeFilename,
            row.type,
            row.filepath
        ]);

        if (memeInsertResult.changes === 0) {
            // Meme already existed, try to get its ID for tag processing
            const existingMeme = await getDb('SELECT id FROM memes WHERE filename = ?', [memeFilename]);
            if (!existingMeme) {
                 console.error(`[Row ${rowIndex}] Skipped duplicate meme '${memeFilename}', but failed to retrieve its ID.`);
                 return { status: 'skipped_duplicate_meme_no_id' };
            }
            console.log(`[Row ${rowIndex}] Meme '${memeFilename}' already exists (ID: ${existingMeme.id}). Processing tags.`);
             // Now process tags using existingMeme.id
             await processTagsForRow(row, existingMeme.id, rowIndex);
             return { status: 'processed_tags_for_duplicate' };

        } else {
            const memeId = memeInsertResult.lastID;
            console.log(`[Row ${rowIndex}] Inserted meme '${memeFilename}' with ID: ${memeId}.`);
             await processTagsForRow(row, memeId, rowIndex);
             return { status: 'inserted' };
        }

    } catch (error) {
        console.error(`[Row ${rowIndex}] Error processing meme '${memeFilename}':`, error.message);
        return { status: 'error_meme_insert' };
    }
}

async function processTagsForRow(row, memeId, rowIndex) {
     let tagsProcessedCount = 0;
     if (row.tags && typeof row.tags === 'string' && row.tags.trim().length > 0) {
        const tags = row.tags.split(',')
            .map(tag => tag.trim().toLowerCase())
            .filter(tag => tag.length > 0);

        // console.log(`[Row ${rowIndex}, Meme ${memeId}] Found tags:`, tags);

        for (const tagName of tags) {
            try {
                // console.log(`[Row ${rowIndex}, Meme ${memeId}] Processing tag: '${tagName}'`);

                // 2a. Insert tag if it doesn't exist
                const tagInsertResult = await runDb(`INSERT OR IGNORE INTO tags (name) VALUES (?)`, [tagName]);
                // if (tagInsertResult.changes > 0) {
                //     console.log(`[Row ${rowIndex}, Meme ${memeId}] Inserted new tag: '${tagName}'`);
                // }

                // 2b. Get the tag_id (MUST exist now)
                const tagRow = await getDb(`SELECT tag_id FROM tags WHERE name = ?`, [tagName]);

                if (tagRow && tagRow.tag_id) {
                    // console.log(`[Row ${rowIndex}, Meme ${memeId}] Found tag_id ${tagRow.tag_id} for '${tagName}'`);
                    // 2c. Link meme and tag
                    const linkResult = await runDb(`INSERT OR IGNORE INTO meme_tags (meme_id, tag_id) VALUES (?, ?)`, [memeId, tagRow.tag_id]);
                    if (linkResult.changes > 0) {
                         tagsProcessedCount++;
                         // console.log(`[Row ${rowIndex}, Meme ${memeId}] Linked tag_id ${tagRow.tag_id} to meme.`);
                    } else {
                         // console.log(`[Row ${rowIndex}, Meme ${memeId}] Link for tag_id ${tagRow.tag_id} already exists.`);
                    }
                } else {
                     console.warn(`[Row ${rowIndex}, Meme ${memeId}] CRITICAL: Could not find tag_id for tag '${tagName}' after attempting insert.`);
                }
            } catch (tagError) {
                 console.error(`[Row ${rowIndex}, Meme ${memeId}] Error processing tag '${tagName}':`, tagError.message);
                 // Continue to next tag
            }
        }
     } else {
        // console.log(`[Row ${rowIndex}, Meme ${memeId}] No tags found or tags string empty.`);
     }
     return tagsProcessedCount;
}


async function populateMemesFromCSV() {
    const results = { inserted: 0, skipped_invalid: 0, skipped_duplicate_meme_no_id: 0, processed_tags_for_duplicate: 0, error_meme_insert: 0, error_tag_processing: 0, total_csv_rows: 0 };
    const processingPromises = [];
    let rowIndex = 0;

    // Reconnect to ensure clean state
    db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, async (err) => {
        if (err) {
            console.error('Error opening database for population:', err.message);
            throw err;
        }
        console.log('Connected to the SQLite database for population.');

        try {
            await runDb("BEGIN TRANSACTION;"); // Start transaction
            console.log("Transaction started.");

            const stream = fs.createReadStream(csvFilePath)
                .pipe(csv())
                .on('data', (row) => {
                    rowIndex++;
                    results.total_csv_rows++;
                    // Wrap async function call in a promise and add to array
                    processingPromises.push(
                        processMemeRow(row, rowIndex).then(result => {
                            results[result.status]++;
                        }).catch(err => {
                            console.error(`[Row ${rowIndex}] Unhandled promise rejection during row processing:`, err);
                            results.error_tag_processing++; // Or a more general error count
                        })
                    );
                })
                .on('end', async () => {
                    console.log('CSV file reading finished. Waiting for database operations to complete...');

                    // Wait for all row processing promises to settle
                    await Promise.allSettled(processingPromises);
                    console.log('All row processing promises settled.');

                    // Commit or Rollback Transaction
                    try {
                        await runDb("COMMIT;");
                        console.log("Transaction committed successfully.");
                    } catch(commitError) {
                        console.error("FATAL: Failed to commit transaction:", commitError.message);
                        try {
                            await runDb("ROLLBACK;");
                            console.log("Transaction rolled back due to commit error.");
                        } catch (rollbackError) {
                            console.error("FATAL: Failed to rollback transaction after commit error:", rollbackError.message);
                        }
                        results.error_meme_insert += results.inserted; // Assume inserts failed
                        results.inserted = 0;
                    }

                    console.log('--- Population Summary ---');
                    console.log(`Total rows read from CSV: ${results.total_csv_rows}`);
                    console.log(`New Memes inserted: ${results.inserted}`);
                    console.log(`Skipped (invalid data): ${results.skipped_invalid}`);
                    console.log(`Skipped (duplicate meme, failed ID lookup): ${results.skipped_duplicate_meme_no_id}`);
                    console.log(`Skipped (duplicate meme, processed tags): ${results.processed_tags_for_duplicate}`);
                    console.log(`Errors during meme insertion: ${results.error_meme_insert}`);
                    console.log(`Errors during tag processing/linking: ${results.error_tag_processing}`);
                    console.log('-------------------------');

                    closeDatabase();
                })
                .on('error', async (error) => {
                    console.error('FATAL: Error reading CSV file stream:', error);
                    // Attempt rollback if stream fails badly
                    try {
                       await runDb("ROLLBACK;");
                       console.log("Transaction rolled back due to stream error.");
                    } catch(rollbackError) {
                         console.error("FATAL: Failed to rollback transaction after stream error:", rollbackError.message);
                    } finally {
                       closeDatabase();
                    }
                });

        } catch (transactionError) {
             console.error("FATAL: Failed to begin transaction:", transactionError.message);
             closeDatabase();
        }
    });
}

function closeDatabase() {
    if (db) {
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err.message);
            } else {
                console.log('Database connection closed.');
            }
            db = null; // Ensure db object is cleared
        });
    } else {
         console.log("Database already closed or not opened.");
    }
}

// --- Start the process ---
populateMemesFromCSV();