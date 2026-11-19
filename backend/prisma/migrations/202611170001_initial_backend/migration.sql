-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "industryCategory" TEXT,
    "country" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "storageRequirements" TEXT,
    "shelfLifeDays" JSONB NOT NULL,
    "shelfLifeNote" TEXT,
    "lengthMm" JSONB NOT NULL,
    "widthMm" JSONB NOT NULL,
    "heightMm" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactInformation" TEXT,
    "leadTimeCalendarDays" JSONB NOT NULL,
    "minimumOrderPackages" JSONB NOT NULL,
    "quotations" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Supplier_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PackagingMaterial" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "structure" TEXT,
    "supplierId" TEXT,
    "unitCostEuroPerPackage" JSONB NOT NULL,
    "technicalSpecifications" TEXT,
    "foodContactDocumentationStatus" TEXT NOT NULL DEFAULT 'unknown',
    "validationStatus" TEXT NOT NULL DEFAULT 'unvalidated',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PackagingMaterial_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PackagingMaterial_supplierId_companyId_fkey" FOREIGN KEY ("supplierId", "companyId") REFERENCES "Supplier" ("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PackagingFormat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "portionWeightGrams" JSONB NOT NULL,
    "lengthMm" JSONB NOT NULL,
    "widthMm" JSONB NOT NULL,
    "heightMm" JSONB NOT NULL,
    "materialCost" JSONB NOT NULL,
    "commercialStatus" TEXT NOT NULL DEFAULT 'unknown',
    "dataQualityStatus" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PackagingFormat_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PackagingFormat_productId_companyId_fkey" FOREIGN KEY ("productId", "companyId") REFERENCES "Product" ("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PackagingFormat_materialId_companyId_fkey" FOREIGN KEY ("materialId", "companyId") REFERENCES "PackagingMaterial" ("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PackagingMachine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "throughput" JSONB NOT NULL,
    "operators" JSONB NOT NULL,
    "investmentEuro" JSONB NOT NULL,
    "maintenanceEuroPerMonth" JSONB NOT NULL,
    "availableHoursPerMonth" JSONB NOT NULL,
    "dataQualityStatus" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PackagingMachine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PackagingInventory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "formatId" TEXT,
    "materialId" TEXT,
    "currentStockPackages" JSONB NOT NULL,
    "packagesPerProductionKg" JSONB NOT NULL,
    "supplierLeadTimeCalendarDays" JSONB NOT NULL,
    "minimumOrderPackages" JSONB NOT NULL,
    "safetyStockPackages" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PackagingInventory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PackagingInventory_formatId_companyId_fkey" FOREIGN KEY ("formatId", "companyId") REFERENCES "PackagingFormat" ("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PackagingInventory_materialId_companyId_fkey" FOREIGN KEY ("materialId", "companyId") REFERENCES "PackagingMaterial" ("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PackagingInventory_exactly_one_reference" CHECK (("formatId" IS NULL) <> ("materialId" IS NULL))
);

-- CreateTable
CREATE TABLE "ProductionScenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "input" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductionScenario_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScenarioAllocation" (
    "scenarioId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "formatId" TEXT NOT NULL,

    PRIMARY KEY ("scenarioId", "formatId"),
    CONSTRAINT "ScenarioAllocation_scenarioId_companyId_fkey" FOREIGN KEY ("scenarioId", "companyId") REFERENCES "ProductionScenario" ("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScenarioAllocation_formatId_companyId_fkey" FOREIGN KEY ("formatId", "companyId") REFERENCES "PackagingFormat" ("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScenarioMachine" (
    "scenarioId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,

    PRIMARY KEY ("scenarioId", "machineId"),
    CONSTRAINT "ScenarioMachine_scenarioId_companyId_fkey" FOREIGN KEY ("scenarioId", "companyId") REFERENCES "ProductionScenario" ("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScenarioMachine_machineId_companyId_fkey" FOREIGN KEY ("machineId", "companyId") REFERENCES "PackagingMachine" ("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Product_companyId_idx" ON "Product"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_id_companyId_key" ON "Product"("id", "companyId");

-- CreateIndex
CREATE INDEX "Supplier_companyId_idx" ON "Supplier"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_id_companyId_key" ON "Supplier"("id", "companyId");

-- CreateIndex
CREATE INDEX "PackagingMaterial_companyId_idx" ON "PackagingMaterial"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "PackagingMaterial_id_companyId_key" ON "PackagingMaterial"("id", "companyId");

-- CreateIndex
CREATE INDEX "PackagingFormat_companyId_idx" ON "PackagingFormat"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "PackagingFormat_id_companyId_key" ON "PackagingFormat"("id", "companyId");

-- CreateIndex
CREATE INDEX "PackagingMachine_companyId_idx" ON "PackagingMachine"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "PackagingMachine_id_companyId_key" ON "PackagingMachine"("id", "companyId");

-- CreateIndex
CREATE INDEX "PackagingInventory_companyId_idx" ON "PackagingInventory"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "PackagingInventory_id_companyId_key" ON "PackagingInventory"("id", "companyId");

-- CreateIndex
CREATE INDEX "ProductionScenario_companyId_idx" ON "ProductionScenario"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionScenario_id_companyId_key" ON "ProductionScenario"("id", "companyId");
