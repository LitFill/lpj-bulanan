import { getDb } from "./database.js";

async function initialize() {
  try {
    const db = await getDb();

    // Insert default user
    await db.run(
      "INSERT OR IGNORE INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)",
      ["admin", "admin123", "Administrator LPJ", "admin"],
    );

    console.log(
      "Database initialized successfully with default user: admin/admin123",
    );
  } catch (error) {
    console.error("Failed to initialize database:", error);
  }
}

initialize();

