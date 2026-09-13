import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { loadStatus, type ParticipantStatus } from './status';

export interface Participant {
  teamName: string;
  memberName: string;
  memberEmail: string;
  memberPhone: string;
  status: ParticipantStatus;
}

const INVALID_EMAIL_VALUES = ['', 'undefined', 'null', 'na', 'n/a', '-'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (INVALID_EMAIL_VALUES.includes(normalized)) return false;
  return EMAIL_REGEX.test(normalized);
}

export function getParticipants(): Participant[] {
  try {
    const filePath = path.join(process.cwd(), 'data', 'testDataOnlineCertificates.xlsx');
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];

    return rows.map(row => {
      const email = String(row['Member Email'] || '').trim().toLowerCase();

      return {
        teamName: String(row['Team Name'] || '').trim(),
        memberName: String(row['Member Name'] || '').trim(),
        memberEmail: email,
        memberPhone: String(row['Member Phone Number'] || '').trim(),
        status: 'PENDING' as ParticipantStatus,
      };
    });
  } catch (error) {
    console.error("Error reading Excel file:", error);
    return [];
  }
}

/**
 * Merge Excel participants with saved status from data/status.json.
 * This ensures restarts never lose status — SENT participants stay SENT.
 */
export function mergeWithSavedStatus(participants: Participant[]): Participant[] {
  const savedStatus = loadStatus();

  return participants.map(p => {
    const saved = savedStatus.participants[p.memberEmail];
    if (saved) {
      return { ...p, status: saved };
    }
    return p;
  });
}
