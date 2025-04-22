const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Path to the database file (same as in setupDatabase.js and server.js)
const dbPath = path.resolve(__dirname, '../memeflix.db');

// Connect to the database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    throw err;
  } else {
    console.log('Connected to the SQLite database for population.');
    populateMemes(); // Start the population process
  }
});

// --- Define Your Meme Data Here ---
// Add objects to this array for each meme file you have in 'meme_files'.
// Ensure 'filename' matches the actual file name exactly.
const memesToInsert = [
  {
    title: "Painting",
    description: "Painting of an image",
    filename: "img1.png", // MAKE SURE THIS FILE EXISTS in meme_files
    type: "image",
    tags: "painting,wowfactore,artistic",
    filepath: "img1.png" // Store filename as filepath for now
  },
  {
    title: "Cat Choosing Card",
    description: "A Cat choosing a card for germany",
    filename: "gif1.gif", // MAKE SURE THIS FILE EXISTS in meme_files
    type: "gif",
    tags: "funny,cute,germany,twist",
    filepath: "gif1.gif"
  },
  {
    title: "California Sky",
    description: "A Gradient looking sky but in real life",
    filename: "img2.jpg", // MAKE SURE THIS FILE EXISTS
    type: "image",
    tags: "wowfactore,georgeus,lookinggood",
    filepath: "img2.jpg"
  },
  {
    title: "Hickies",
    description: "A Women got hickies in her neck",
    filename: "img3.jpg",    // MAKE SURE THIS FILE EXISTS
    type: "image",
    tags: "funny,denial,chaos",
    filepath: "img3.jpg"
  },
  {
    title: "Playing with Child Face",
    description: "A person playing with the child face and it's making sound",
    filename: "child1.mp4",      // MAKE SURE THIS FILE EXISTS
    type: "video",
    tags: "music,funny,child,laughing",
    filepath: "child1.mp4"
  },
  {
    title: "Child Crying",
    description: "Child crying for something",
    filename: "child_crying.mp4",      // MAKE SURE THIS FILE EXISTS
    type: "video",
    tags: "music,funny,child,crying",
    filepath: "child_crying.mp4"
  },
  {
    title: "Cat Drinking milk",
    description: "A grown ass cat drinking milk with it's children",
    filename: "cat_drinking_milk.mp4",      // MAKE SURE THIS FILE EXISTS
    type: "video",
    tags: "cat,funny,childrens,laughing",
    filepath: "cat_drinking_milk.mp4"
  },
  {
    title: "Map",
    description: "Indian and pakistan border",
    filename: "img4.jpg",    // MAKE SURE THIS FILE EXISTS
    type: "image",
    tags: "wowfactore,chaos,beautiful",
    filepath: "img4.jpg"
  },
  {
    title: "Meme Hoddie",
    description: "A man wearing a maths hoddie",
    filename: "img5.jpg",    // MAKE SURE THIS FILE EXISTS
    type: "image",
    tags: "funny,clever",
    filepath: "img5.jpg"
  }
];
// --- End of Meme Data Definition ---

function populateMemes() {
  // SQL statement for inserting data.
  // Using 'OR IGNORE' means if a meme with the same unique filename already exists,
  // this specific insert command will be skipped without causing an error.
  const insertSql = `INSERT OR IGNORE INTO memes (title, description, filename, type, tags, filepath) VALUES (?, ?, ?, ?, ?, ?)`;

  // Use db.serialize to run insertions sequentially
  db.serialize(() => {
    // Prepare the statement for better performance and security with multiple inserts
    const stmt = db.prepare(insertSql);

    console.log(`Attempting to insert ${memesToInsert.length} memes...`);

    // Loop through each meme object in the array
    memesToInsert.forEach((meme) => {
      // Run the prepared statement with the data from the current meme object
      stmt.run(
        meme.title,
        meme.description,
        meme.filename,
        meme.type,
        meme.tags,
        meme.filepath,
        (err) => {
          if (err) {
            // This error likely won't happen for duplicates because of 'OR IGNORE',
            // but could happen for other reasons (e.g., violating NOT NULL).
            console.error(`Error inserting meme ${meme.filename}:`, err.message);
          } else {
            // 'this.changes' reports the number of rows affected by the last statement.
            // If it's 1, the insert happened. If 0, it was ignored (likely duplicate).
            if (this.changes > 0) {
              console.log(`Successfully inserted meme: ${meme.filename}`);
            } else {
              console.log(`Skipped duplicate meme: ${meme.filename}`);
            }
          }
        }
      );
    });

    // Finalize the statement after all insertions are queued
    stmt.finalize((err) => {
      if (err) {
        console.error('Error finalizing statement:', err.message);
      }
      // Close the database connection after finalizing
      closeDatabase();
    });
  });
}

function closeDatabase() {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed after population.');
    }
  });
}