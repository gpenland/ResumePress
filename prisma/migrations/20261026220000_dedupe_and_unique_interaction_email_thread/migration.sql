-- Dedupe any existing Interaction rows that share (userId, emailThreadId)
-- before adding the unique index below. createInteractionFromEmailThreadIfMissing
-- in emailThreads.ts used to be a non-atomic check-then-insert, so two
-- concurrent syncs for the same account (possible before the Gmail-sync
-- Cancel control was fixed to actually cancel a live run) could both pass
-- the "no existing interaction yet" check and double-insert. Keeps the
-- oldest row per pair (the first one a sync ever created) and removes the
-- rest; expected to delete 0 rows in the common case.
DELETE FROM "Interaction"
WHERE "ctid" IN (
  SELECT "ctid" FROM (
    SELECT "ctid",
           ROW_NUMBER() OVER (
             PARTITION BY "userId", "emailThreadId"
             ORDER BY "createdAt" ASC, "id" ASC
           ) AS rn
    FROM "Interaction"
    WHERE "emailThreadId" IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- CreateIndex
-- Postgres unique indexes treat NULL as distinct from every other value, so
-- this only enforces "at most one Interaction per Gmail thread per user" —
-- it doesn't restrict how many non-email Interactions (NULL emailThreadId)
-- a user can have.
CREATE UNIQUE INDEX "Interaction_userId_emailThreadId_key" ON "Interaction"("userId", "emailThreadId");
