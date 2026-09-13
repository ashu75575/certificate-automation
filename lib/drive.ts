import { google } from 'googleapis';
import { Participant } from './excel';

export function normalizeName(name: string, team: string): string {
  const cleanName = name.replace(/\s+/g, '').toLowerCase();
  const cleanTeam = team.replace(/\s+/g, '').toLowerCase();
  return `${cleanName}${cleanTeam}.pdf`;
}

export async function getParticipantCertificate(participant: Participant) {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

  if (!folderId || !privateKey || !clientEmail) {
    throw new Error("Google Drive credentials are not fully configured.");
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  const drive = google.drive({ version: 'v3', auth });
  
  const expectedFileName = normalizeName(participant.memberName, participant.teamName);

  const response = await drive.files.list({
    q: `'${folderId}' in parents and name = '${expectedFileName}' and trashed = false`,
    fields: 'files(id, name, mimeType, size)',
    spaces: 'drive',
  });

  const files = response.data.files || [];

  if (files.length === 0) {
    throw new Error(`Certificate not found. Expected filename: ${expectedFileName}`);
  }

  if (files.length > 1) {
    throw new Error(`Multiple matching certificates found for ${expectedFileName}. Cannot proceed automatically.`);
  }

  const file = files[0];

  if (file.mimeType !== 'application/pdf') {
    throw new Error(`Certificate file is not a PDF (found ${file.mimeType}). Expected filename: ${expectedFileName}`);
  }

  return {
    id: file.id!,
    name: file.name!,
    mimeType: file.mimeType!,
    size: file.size ? parseInt(file.size, 10) : 0,
    expectedFileName
  };
}

export async function getCertificateContent(fileId: string) {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  const drive = google.drive({ version: 'v3', auth });

  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  );

  return response.data;
}
