ALTER TABLE "AuditLog"
ADD COLUMN "subjectPartnerId" TEXT;

ALTER TABLE "AuditLog"
ADD CONSTRAINT "AuditLog_subjectPartnerId_fkey"
FOREIGN KEY ("subjectPartnerId") REFERENCES "Partner"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AuditLog_subjectPartnerId_createdAt_idx"
ON "AuditLog"("subjectPartnerId", "createdAt");
