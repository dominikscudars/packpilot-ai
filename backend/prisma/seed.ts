import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { seedDemo } from "../src/shared/seedDemo.js";
const db = new PrismaClient();
try {
  console.log("Demo seed ready:", await seedDemo(db));
} finally {
  await db.$disconnect();
}
