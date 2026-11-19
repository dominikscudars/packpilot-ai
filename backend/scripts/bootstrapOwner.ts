import { PrismaClient } from "@prisma/client";
import { loadConfig } from "../src/config/env.js";
import { bootstrapOwner } from "../src/auth/bootstrap.js";
const db = new PrismaClient({ datasourceUrl: loadConfig().DATABASE_URL });
try {
  const [companyId, userId] = process.argv.slice(2);
  if (!companyId || !userId)
    throw new Error(
      "Usage: npm run members:bootstrap -- <company-id> <verified-user-uuid>",
    );
  await bootstrapOwner(db, companyId, userId);
  console.log(
    "Initial owner assigned. Existing companies are never claimed automatically.",
  );
} finally {
  await db.$disconnect();
}
