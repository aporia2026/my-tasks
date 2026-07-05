import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { env } from "@/lib/env";
import * as schema from "./schema";

type Db = ReturnType<typeof createDb>;

function createDb() {
  return drizzle(neon(env("DATABASE_URL")), { schema });
}

let instance: Db | null = null;

/**
 * Lazy proxy: the connection (and the DATABASE_URL read) happens on first
 * query, not at import time, so builds work without runtime env vars.
 */
export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    instance ??= createDb();
    const value = Reflect.get(instance, prop);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
