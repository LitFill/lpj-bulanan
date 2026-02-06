import { serialize, prepare } from "./database";

serialize(() => {
  // Insert default user
  const stmt = prepare(
    "INSERT OR IGNORE INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)",
  );
  stmt.run("admin", "admin123", "Administrator LPJ", "admin");
  stmt.finalize();
  console.log("Database initialized with default user: admin/admin123");
});
