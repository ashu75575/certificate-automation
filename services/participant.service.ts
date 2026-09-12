import { prisma } from "../lib/prisma";
import { ParticipantStatus } from "../types";
import { Prisma } from "@prisma/client";

export class ParticipantService {
  static async createParticipant(data: Prisma.ParticipantUncheckedCreateInput) {
    return prisma.participant.create({
      data: {
        ...data,
        status: data.status || ParticipantStatus.PENDING,
      },
    });
  }

  static async getParticipant(id: string) {
    return prisma.participant.findUnique({
      where: { id },
    });
  }

  static async getParticipants(batchId: string) {
    return prisma.participant.findMany({
      where: { batch_id: batchId },
      orderBy: { created_at: "asc" },
    });
  }

  static async updateParticipantStatus(id: string, status: ParticipantStatus) {
    return prisma.participant.update({
      where: { id },
      data: { status },
    });
  }

  static async getNextEligibleParticipant(batchId: string) {
    // Exclude SENT, and other terminal statuses
    const excludedStatuses = [
      ParticipantStatus.SENT,
      ParticipantStatus.SKIPPED,
      ParticipantStatus.INVALID_EMAIL,
    ];

    return prisma.participant.findFirst({
      where: {
        batch_id: batchId,
        status: {
          notIn: excludedStatuses,
        },
      },
      orderBy: {
        created_at: "asc", // Process older entries first
      },
    });
  }
}
