CREATE TABLE "CompanyMembership" (
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL CHECK ("role" IN ('owner', 'member')),
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  PRIMARY KEY ("companyId", "userId"),
  CONSTRAINT "CompanyMembership_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CompanyMembership_userId_idx" ON "CompanyMembership"("userId");
