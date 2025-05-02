// backend/database/populateDb.js
const fs = require('fs');         // Import Node.js File System module
const path = require('path');     // Import path module
const csv = require('csv-parser'); // Import the csv-parser library
const sqlite3 = require('sqlite3').verbose();

// --- Configuration ---
const dbPath = path.resolve(__dirname, '../memeflix.db'); // Path to your SQLite DB
const csvFilePath = path.resolve(__dirname, 'memes.csv'); // Path to your CSV file

// --- Database Connection ---
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    throw err;
  } else {
    console.log('Connected to the SQLite database for population.');
    populateMemesFromCSV(); // Call the CSV processing function
  }
});

// --- Function to Process CSV and Populate DB ---
function populateMemesFromCSV() {
  const rowsFromCsv = []; // Still useful for total count read
  let insertedCount = 0;
  let skippedCount = 0;
  let processedCount = 0; // Track how many rows we attempted to process

  const insertSql = `INSERT OR IGNORE INTO memes (title, description, filename, type, tags, filepath, upvotes, downvotes) VALUES (?, ?, ?, ?, ?, ?, 0, 0)`;

  // Use db.serialize to ensure sequential execution *if* needed, but
  // preparing statement and running within stream might be okay. Let's keep it simpler first.
  const stmt = db.prepare(insertSql);

  console.log(`Reading data from ${csvFilePath}...`);

  fs.createReadStream(csvFilePath)
    .pipe(csv())
    .on('data', (row) => {
      rowsFromCsv.push(row);
      processedCount++; // Increment for every row processed from CSV

      if (!row.title || !row.filename || !row.type || !row.filepath) {
          console.warn(`Skipping invalid row (missing required fields):`, row);
          // Don't increment skippedCount here yet, let the db result determine it
          return;
      }

      // Queue the database operation
      stmt.run(
        row.title,
        row.description || '',
        row.filename,
        row.type,
        row.tags || '',
        row.filepath,
        function(err) { // MUST use function() to access 'this'
          if (err) {
            console.error(`Error processing row for ${row.filename || 'N/A'}:`, err.message);
            // Consider how to track errors separately if needed
          } else {
             // Update counts based on the result of THIS operation
             if (this.changes > 0) {
                insertedCount++;
             } else {
                skippedCount++; // Count ignored duplicates/non-changes as skipped
             }
          }
        }
      );
    })
    .on('end', () => {
      console.log('CSV file reading finished. Waiting for database operations to complete...');

      // Finalize the statement. This waits until all queued 'run' operations
      // associated with 'stmt' have been executed.
      stmt.finalize((err) => {
        if (err) {
          console.error('Error finalizing statement:', err.message);
        }

        console.log('Database operations complete.');
        console.log('--- Population Summary ---');
        // Use processedCount from the 'data' events for total attempts
        console.log(`Total rows processed from CSV: ${processedCount}`);
        console.log(`Rows successfully inserted: ${insertedCount}`);
        // Calculate skipped based on total processed vs inserted
        // Note: skippedCount might be slightly off if validation failed before db call
        // Let's refine the skipped calculation:
        let finalSkipped = processedCount - insertedCount;
        console.log(`Rows skipped/ignored (duplicates, errors, invalid): ${finalSkipped}`);
        console.log('-------------------------');

        closeDatabase(); // Close DB after finalizing and logging
      });
    })
    .on('error', (error) => {
        console.error('Error processing CSV file:', error);
        // It's tricky to ensure finalize runs if stream errors, attempt close
        closeDatabase();
    });
}

// Function to close the database (same as before)
function closeDatabase() {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed.');
    }
  });
}