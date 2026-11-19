import type { PrismaClient } from "@prisma/client";
import { HttpError } from "./crud.js";
/** SELECT 1 alone also succeeds on a new, unmigrated SQLite file. */
export async function assertDatabaseReady(db: PrismaClient) {
  try {
    await db.companyMembership.findFirst({ select: { userId: true } });
  } catch {
    throw new HttpError(
      503,
      "Database is unavailable or migrations are not ready.",
    );
  }
}
