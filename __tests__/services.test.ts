import { BatchService } from "../services/batch.service";
import { ParticipantService } from "../services/participant.service";
import { ParticipantStatus, BatchStatus } from "../types";
import { prisma } from "../lib/prisma";

describe("Services Tests", () => {
  let batchId: string;

  beforeAll(async () => {
    // Ensure we start clean or just create a new batch for these tests
    const batch = await BatchService.createBatch({
      name: "Test Batch",
      daily_limit: 100,
    });
    batchId = batch.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.participant.deleteMany({ where: { batch_id: batchId } });
    await prisma.batch.delete({ where: { id: batchId } });
    await prisma.$disconnect();
  });

  it("should create a batch and return it", async () => {
    const batch = await BatchService.getBatch(batchId);
    expect(batch).toBeDefined();
    expect(batch?.name).toBe("Test Batch");
    expect(batch?.status).toBe(BatchStatus.CREATED);
  });

  it("should update a batch status", async () => {
    await BatchService.updateBatch(batchId, { status: BatchStatus.RUNNING });
    const batch = await BatchService.getBatch(batchId);
    expect(batch?.status).toBe(BatchStatus.RUNNING);
  });

  it("should create a participant with PENDING status", async () => {
    const participant = await ParticipantService.createParticipant({
      batch_id: batchId,
      member_name: "John Doe",
      member_email: "john@example.com",
    });

    expect(participant).toBeDefined();
    expect(participant.status).toBe(ParticipantStatus.PENDING);
    expect(participant.member_name).toBe("John Doe");
  });

  it("should get multiple participants for a batch", async () => {
    await ParticipantService.createParticipant({
      batch_id: batchId,
      member_name: "Jane Doe",
      member_email: "jane@example.com",
    });

    const participants = await ParticipantService.getParticipants(batchId);
    expect(participants.length).toBeGreaterThanOrEqual(2);
  });

  it("should update participant status", async () => {
    const participants = await ParticipantService.getParticipants(batchId);
    const p1 = participants[0];

    const updated = await ParticipantService.updateParticipantStatus(p1.id, ParticipantStatus.GENERATED);
    expect(updated.status).toBe(ParticipantStatus.GENERATED);
  });

  it("should correctly identify next eligible participant, skipping SENT and SKIPPED", async () => {
    // Clear existing for this specific test
    await prisma.participant.deleteMany({ where: { batch_id: batchId } });

    // Create 3 participants
    const p1 = await ParticipantService.createParticipant({
      batch_id: batchId,
      member_name: "Sent User",
      member_email: "sent@example.com",
      status: ParticipantStatus.SENT, // Excluded
    });

    const p2 = await ParticipantService.createParticipant({
      batch_id: batchId,
      member_name: "Skipped User",
      member_email: "skipped@example.com",
      status: ParticipantStatus.SKIPPED, // Excluded
    });

    const p3 = await ParticipantService.createParticipant({
      batch_id: batchId,
      member_name: "Eligible User",
      member_email: "eligible@example.com",
      status: ParticipantStatus.PENDING, // Eligible
    });

    const nextEligible = await ParticipantService.getNextEligibleParticipant(batchId);
    
    expect(nextEligible).toBeDefined();
    expect(nextEligible?.id).toBe(p3.id);
    expect(nextEligible?.member_name).toBe("Eligible User");
  });
});
