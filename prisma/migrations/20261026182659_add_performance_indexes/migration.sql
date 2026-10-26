-- CreateIndex
CREATE INDEX "Application_userId_status_idx" ON "Application"("userId", "status");

-- CreateIndex
CREATE INDEX "Application_userId_updatedAt_idx" ON "Application"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Contact_userId_updatedAt_idx" ON "Contact"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Interaction_applicationId_occurredAt_idx" ON "Interaction"("applicationId", "occurredAt");

-- CreateIndex
CREATE INDEX "Interaction_contactId_occurredAt_idx" ON "Interaction"("contactId", "occurredAt");

-- CreateIndex
CREATE INDEX "EmailThread_userId_matchStatus_idx" ON "EmailThread"("userId", "matchStatus");

-- CreateIndex
CREATE INDEX "EmailThread_userId_lastMessageAt_idx" ON "EmailThread"("userId", "lastMessageAt");

