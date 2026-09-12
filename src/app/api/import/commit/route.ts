import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { BatchStatus } from "../../../../../types";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { summary, records } = body;

    if (!summary || !records || !Array.isArray(records)) {
      return NextResponse.json({ error: "Invalid payload format." }, { status: 400 });
    }

    // Insert all records including intentional duplicates
    const validRecordsToInsert = records;

    // Create the batch
    const batch = await prisma.batch.create({
      data: {
        name: `Import Batch ${new Date().toISOString().split("T")[0]}`,
        status: BatchStatus.CREATED,
        total_count: summary.total,
        pending_count: summary.pending,
        invalid_count: summary.invalid,
        sent_count: summary.alreadySent,
        skipped_count: summary.duplicates, // Duplicates are skipped
      }
    });

    // Prepare participants data
    const participantsData = validRecordsToInsert.map(r => ({
      team_name: r.teamName,
      member_name: r.memberName,
      member_email: r.memberEmail,
      member_phone: r.phone,
      status: r.status,
      batch_id: batch.id,
    }));

    // Bulk insert
    // SQLite supports createMany
    const createdParticipants = await prisma.participant.createMany({
      data: participantsData,
    });

    return NextResponse.json({
      success: true,
      batch,
      insertedCount: createdParticipants.count,
    });

  } catch (error) {
    console.error("Commit error:", error);
    return NextResponse.json({ error: "Failed to commit import." }, { status: 500 });
  }
}
