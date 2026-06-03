import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";

const sqlite = new Database("sqlite.db");

export const db = drizzle(sqlite);

export async function initializeDatabase() {
  await migrate();
}

async function migrate() {
  const { migrate } = await import("drizzle-orm/bun-sqlite/migrator");
  migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Database migrations completed");
}
