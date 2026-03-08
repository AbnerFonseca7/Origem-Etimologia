import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { initialDatabase } from "./src/data/initialDatabase";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("etymology.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS etymologies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT UNIQUE NOT NULL,
    data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    access_count INTEGER DEFAULT 1
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const normalizeWord = (word: string) => {
  return word
    .toLowerCase()
    .trim();
};

// Seed database with initial words
const seedDatabase = () => {
  const insertStmt = db.prepare("INSERT OR IGNORE INTO etymologies (word, data) VALUES (?, ?)");
  for (const [word, data] of Object.entries(initialDatabase)) {
    insertStmt.run(normalizeWord(word), JSON.stringify(data));
  }
  console.log(`Database seeded with ${Object.keys(initialDatabase).length} words.`);
};

seedDatabase();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/word-of-the-day", (req, res) => {
    try {
      // Try to get a word that hasn't been accessed much or just a random one from initial set
      const row = db.prepare("SELECT * FROM etymologies ORDER BY RANDOM() LIMIT 1").get() as any;
      if (row) {
        res.json({
          ...JSON.parse(row.data),
          created_at: row.created_at,
          access_count: row.access_count
        });
      } else {
        res.status(404).json({ error: "No words in database" });
      }
    } catch (error) {
      console.error("Database error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/etymology/:word", (req, res) => {
    const word = normalizeWord(req.params.word);
    
    try {
      const row = db.prepare("SELECT * FROM etymologies WHERE word = ?").get(word) as any;
      
      if (row) {
        // Increment access count
        db.prepare("UPDATE etymologies SET access_count = access_count + 1 WHERE id = ?").run(row.id);
        res.json({
          ...JSON.parse(row.data),
          created_at: row.created_at,
          access_count: row.access_count + 1
        });
      } else {
        res.status(404).json({ error: "Not found" });
      }
    } catch (error) {
      console.error("Database error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/etymology", (req, res) => {
    const { word, data } = req.body;
    const normalizedWord = normalizeWord(word);
    
    try {
      const existing = db.prepare("SELECT * FROM etymologies WHERE word = ?").get(normalizedWord) as any;
      
      if (existing) {
        db.prepare("UPDATE etymologies SET access_count = access_count + 1 WHERE word = ?").run(normalizedWord);
        const updated = db.prepare("SELECT * FROM etymologies WHERE word = ?").get(normalizedWord) as any;
        res.json({
          ...JSON.parse(updated.data),
          created_at: updated.created_at,
          access_count: updated.access_count,
          isFirstSearch: false
        });
      } else {
        db.prepare("INSERT INTO etymologies (word, data) VALUES (?, ?)").run(normalizedWord, JSON.stringify(data));
        const inserted = db.prepare("SELECT * FROM etymologies WHERE word = ?").get(normalizedWord) as any;
        res.json({
          ...JSON.parse(inserted.data),
          created_at: inserted.created_at,
          access_count: inserted.access_count,
          isFirstSearch: true
        });
      }
    } catch (error) {
      console.error("Database error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/report", (req, res) => {
    const { type, message, email } = req.body;
    try {
      db.prepare("INSERT INTO reports (type, message, email) VALUES (?, ?, ?)").run(type, message, email);
      // In a real production app, you would send an email here using a service like SendGrid or Resend.
      // For now, we store it in the database for the developer to check.
      console.log(`New report received: [${type}] from ${email || 'anonymous'}: ${message}`);
      res.json({ success: true });
    } catch (error) {
      console.error("Report error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
