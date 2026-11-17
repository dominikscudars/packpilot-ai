import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { idSchema } from "../domain/inputs.js";
/** Trusted local administrator command only. Never expose as an HTTP endpoint. */
export async function bootstrapOwner(
  db: PrismaClient,
  companyId: string,
  subject: string,
) {
  idSchema.parse(companyId);
  const userId = z.uuid().parse(subject).toLowerCase();
  return db.$transaction(async (tx) => {
    await tx.company.update({
      where: { id: companyId },
      data: { updatedAt: new Date() },
    });
    if ((await tx.companyMembership.count({ where: { companyId } })) !== 0)
      throw new Error(
        "Company already has memberships; use an authenticated owner to manage access.",
      );
    return tx.companyMembership.create({
      data: { companyId, userId, role: "owner" },
    });
  });
}
