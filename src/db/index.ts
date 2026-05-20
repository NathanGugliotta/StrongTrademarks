import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// postgres-js connects lazily on first query, so we can construct the client
// at module load even when DATABASE_URL is unset (e.g. during `next build`).
// Queries will fail with a connection error at runtime if the URL is missing
// or wrong — that's the right failure mode.
const connectionString =
  process.env.DATABASE_URL ?? "postgres://unset:unset@localhost:5432/unset";

if (!process.env.DATABASE_URL && process.env.NODE_ENV !== "production") {
  console.warn(
    "[db] DATABASE_URL is not set. Database queries will fail until it's configured.",
  );
}

const client = postgres(connectionString, {
  max: process.env.NODE_ENV === "production" ? 10 : 1,
  prepare: false,
});

export const db = drizzle(client, { schema });
export type DB = typeof db;
export { schema };
