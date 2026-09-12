import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import * as xlsx from "xlsx";
import { ParticipantStatus } from "../../../../../types";
import { prisma } from "../../../../../lib/prisma";

export async function POST() {
  try {
    // 1. Path to the local excel file
    const filePath = path.join(process.cwd(), "data", "test_participants.xlsx");
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json({ error: "Local Excel file (data/test_participants.xlsx) not found." }, { status: 404 });
    }

    // 2. Parse workbook
    const fileBuffer = await fs.readFile(filePath);
    const workbook = xlsx.read(fileBuffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Read rows
    const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

    // 3. Column Validation
    if (rows.length === 0) {
      return NextResponse.json({ error: "Excel file is empty." }, { status: 400 });
    }

    const requiredColumns = [
      "Team Name",
      "Member Name",
      "Member Email",
      "Member Phone Number",
      "Status"
    ];

    const firstRowKeys = Object.keys(rows[0]).map(k => k.trim());
    for (const col of requiredColumns) {
      if (!firstRowKeys.includes(col)) {
        return NextResponse.json({ error: `Missing required column: ${col}` }, { status: 400 });
      }
    }

    // 4. Data Normalization & Validation
    let validCount = 0;
    let invalidCount = 0;
    let duplicateCount = 0;
    let alreadySentCount = 0;
    let pendingCount = 0;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    const parsedRecords = [];

    // Pre-fetch existing participants to check for SENT status
    const existingParticipants = await prisma.participant.findMany({
      select: {
        team_name: true,
        member_name: true,
        member_email: true,
        status: true,
      }
    });

    for (const row of rows) {
      // Normalization
      const teamName = String(row["Team Name"] || "").trim();
      const memberName = String(row["Member Name"] || "").trim();
      let memberEmail = String(row["Member Email"] || "").trim();
      const phone = String(row["Member Phone Number"] || "").trim();
      const statusStr = String(row["Status"] || "").trim().toUpperCase();

      // Skip empty rows
      if (!teamName && !memberName && !memberEmail) {
        continue;
      }

      // Email normalization
      if (memberEmail) {
        const parts = memberEmail.split("@");
        if (parts.length === 2) {
          memberEmail = `${parts[0]}@${parts[1].toLowerCase()}`;
        }
      }

      // Base status mapping
      let finalStatus = ParticipantStatus.PENDING;
      if (statusStr === "SENT") {
        finalStatus = ParticipantStatus.SENT;
      }

      // Email validation
      let isInvalid = false;
      if (!memberEmail || memberEmail.includes(" ") || !emailRegex.test(memberEmail)) {
        finalStatus = ParticipantStatus.INVALID_EMAIL;
        isInvalid = true;
      }

      // Duplicate detection within the file (disabled for testing)
      const isDuplicate = false;

      // Check against existing database for SENT status preservation
      const existingMatch = existingParticipants.find(p => 
        p.team_name === teamName && 
        p.member_name === memberName && 
        p.member_email === memberEmail
      );

      let isAlreadySent = false;
      if (existingMatch && existingMatch.status === ParticipantStatus.SENT) {
        finalStatus = ParticipantStatus.SENT;
        isAlreadySent = true;
      }

      // Update counters based on the calculated status / logic
      if (isDuplicate) {
        duplicateCount++;
      } else if (isAlreadySent) {
        alreadySentCount++;
      } else if (isInvalid) {
        invalidCount++;
      } else if (finalStatus === ParticipantStatus.SENT) {
        alreadySentCount++; // If they came in as SENT from Excel
      } else {
        validCount++;
        pendingCount++;
      }

      parsedRecords.push({
        teamName,
        memberName,
        memberEmail,
        phone,
        status: finalStatus,
        isDuplicate,
        isAlreadySent,
        isInvalid
      });
    }

    return NextResponse.json({
      summary: {
        total: parsedRecords.length,
        valid: validCount,
        invalid: invalidCount,
        duplicates: duplicateCount,
        alreadySent: alreadySentCount,
        pending: pendingCount
      },
      records: parsedRecords
    });

  } catch (error) {
    console.error("Preview error:", error);
    return NextResponse.json({ error: "Failed to preview import." }, { status: 500 });
  }
}
