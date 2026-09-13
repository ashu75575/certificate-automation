import * as XLSX from 'xlsx';
import path from 'path';

export interface Participant {
  teamName: string;
  memberName: string;
  memberEmail: string;
  memberPhone: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  isValidEmail: boolean;
}

import fs from 'fs';

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
      const statusRaw = String(row['Status'] || '').trim().toUpperCase();
      let status: Participant['status'] = 'PENDING';

      if (statusRaw === 'SENT') status = 'SENT';
      else if (statusRaw === 'FAILED') status = 'FAILED';

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const isValidEmail = email !== '' && emailRegex.test(email);

      return {
        teamName: String(row['Team Name'] || '').trim(),
        memberName: String(row['Member Name'] || '').trim(),
        memberEmail: email,
        memberPhone: String(row['Member Phone Number'] || '').trim(),
        status,
        isValidEmail,
      };
    });
  } catch (error) {
    console.error("Error reading Excel file:", error);
    return [];
  }
}
