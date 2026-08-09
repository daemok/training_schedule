-- CreateTable
CREATE TABLE "login_attempts" (
    "login_attempt_id" SERIAL NOT NULL,
    "ip_address" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "succeeded" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("login_attempt_id")
);

-- CreateIndex
CREATE INDEX "login_attempts_ip_address_created_at_idx" ON "login_attempts"("ip_address", "created_at");

-- CreateIndex
CREATE INDEX "login_attempts_email_created_at_idx" ON "login_attempts"("email", "created_at");
