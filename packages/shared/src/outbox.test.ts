import { loadConfig } from "./config.js";
import { getDatabasePool } from "./db.js";
import { appendOutboxEvent, listPendingOutboxEvents, markOutboxEventFailed } from "./outbox.js";
import type { DomainEventEnvelope } from "./events.js";
import assert from "assert";

async function run() {
  console.log("Starting Outbox DLQ Integration Test...");
  const config = loadConfig();
  const db = getDatabasePool(config);

  const testEventId = `test-event-${Date.now()}`;
  const testEvent: DomainEventEnvelope = {
    eventId: testEventId,
    aggregateType: "transaction",
    aggregateId: "test-batch-123",
    eventType: "transaction.submitted",
    eventKey: "test-batch-123",
    version: 1,
    occurredAt: Date.now(),
    payload: { title: "Test Payout Batch", totalAmount: "100.00" }
  };

  // 1. Insert a pending event
  await appendOutboxEvent(db, testEvent);
  console.log(`- Inserted outbox event with ID: ${testEventId}`);

  // 2. Fetch pending events and assert it is present
  let pending = await listPendingOutboxEvents(config, { limit: 100 });
  let found = pending.find(e => e.event_id === testEventId);
  assert.ok(found, "Inserted event must be present in pending list");
  assert.strictEqual(found.status, "pending", "Initial status should be pending");
  assert.strictEqual(found.attempt_count, 0, "Initial attempt count should be 0");

  // 3. Mark failed 4 times - should remain 'failed'
  for (let i = 1; i <= 4; i++) {
    await markOutboxEventFailed(config, testEventId, `Error occurrence ${i}`);
    pending = await listPendingOutboxEvents(config, { limit: 100 });
    found = pending.find(e => e.event_id === testEventId);
    assert.ok(found, `Event should still be in pending list after attempt ${i}`);
    assert.strictEqual(found.status, "failed", "Status should be failed after first failures");
    assert.strictEqual(found.attempt_count, i, `Attempt count should be ${i}`);
    console.log(`  * Attempt ${i} marked failed. Count: ${found.attempt_count}, Status: ${found.status}`);
  }

  // 4. Mark failed the 5th time - should transition to 'dead_letter'
  await markOutboxEventFailed(config, testEventId, "Fatal 5th attempt error", 5);
  console.log("  * Attempt 5 marked failed.");

  // 5. Fetch pending list again - should NOT be present because status is now 'dead_letter'
  pending = await listPendingOutboxEvents(config, { limit: 100 });
  found = pending.find(e => e.event_id === testEventId);
  assert.ok(!found, "Dead-lettered event must NOT be returned in listPendingOutboxEvents!");
  console.log("- Success: Dead-lettered event was filtered out from pending outbox queue.");

  // 6. Direct query to confirm the database row fields
  const queryResult = await db.query(
    "select status, attempt_count, last_error from outbox_events where event_id = $1",
    [testEventId]
  );
  const row = queryResult.rows[0];
  assert.ok(row, "Event row must exist in DB");
  assert.strictEqual(row.status, "dead_letter", "Database status must be 'dead_letter'");
  assert.strictEqual(row.attempt_count, 5, "Database attempt count must be exactly 5");
  assert.strictEqual(row.last_error, "Fatal 5th attempt error", "Database last error should match");
  console.log("- Success: Database fields correctly verified as 'dead_letter' with attempt_count = 5.");

  // Cleanup
  await db.query("delete from outbox_events where event_id = $1", [testEventId]);
  console.log("Cleanup completed.");

  console.log("\nAll Outbox DLQ Integration Tests Passed Successfully!");
}

run().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
