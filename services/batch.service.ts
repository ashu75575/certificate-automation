import { prisma } from "../lib/prisma";
import { BatchStatus } from "../types";
import { Prisma } from "@prisma/client";

export class BatchService {
  static async createBatch(data: { name: string; daily_limit?: number }) {
    return prisma.batch.create({
      data: {
        name: data.name,
        daily_limit: data.daily_limit,
        status: BatchStatus.CREATED,
      },
    });
  }

  static async getBatch(id: string) {
    return prisma.batch.findUnique({
      where: { id },
    });
  }

  static async updateBatch(id: string, data: Prisma.BatchUpdateInput) {
    return prisma.batch.update({
      where: { id },
      data,
    });
  }
}
