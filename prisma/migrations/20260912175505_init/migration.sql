-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "pending_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "invalid_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "daily_limit" INTEGER,
    "sent_today" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" DATETIME,
    "paused_at" DATETIME,
    "completed_at" DATETIME
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "team_name" TEXT,
    "member_name" TEXT NOT NULL,
    "member_email" TEXT NOT NULL,
    "member_phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "drive_file_id" TEXT,
    "certificate_generated" BOOLEAN NOT NULL DEFAULT false,
    "certificate_path" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" DATETIME,
    "email_message_id" TEXT,
    "email_send_started_at" DATETIME,
    "email_sent_at" DATETIME,
    "error_code" TEXT,
    "error_message" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "batch_id" TEXT NOT NULL,
    CONSTRAINT "Participant_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "Batch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Participant_status_idx" ON "Participant"("status");

-- CreateIndex
CREATE INDEX "Participant_batch_id_idx" ON "Participant"("batch_id");
