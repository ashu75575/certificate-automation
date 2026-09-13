import { Participant, validateEmail } from './excel';
import { getParticipantCertificate, getCertificateContent } from './drive';
import { sendCertificateEmail } from './email';
import { setParticipantStatus, getParticipantKey, incrementTodaySentCount, type ParticipantStatus } from './status';

export interface ProcessResult {
  email: string;
  name: string;
  team: string;
  status: ParticipantStatus;
  action: string;
}

/**
 * Process a single participant: validate → find certificate → send email → update status.
 * Returns the result. Never throws — all errors are caught and returned as status updates.
 */
export async function processParticipant(participant: Participant): Promise<ProcessResult> {
  const totalStart = performance.now();
  const { memberEmail, memberName, teamName } = participant;
  const key = getParticipantKey(memberName, teamName, memberEmail);

  // 1. Skip if already sent
  if (participant.status === 'SENT') {
    return { email: memberEmail, name: memberName, team: teamName, status: 'SENT', action: 'Already sent — skipped' };
  }

  // 2. Validate email
  if (!validateEmail(memberEmail)) {
    setParticipantStatus(key, 'INVALID_EMAIL');
    return { email: memberEmail, name: memberName, team: teamName, status: 'INVALID_EMAIL', action: 'Invalid email address' };
  }

  // 3. Find certificate on Google Drive
  let certificateId: string;
  try {
    const driveSearchStart = performance.now();
    const meta = await getParticipantCertificate(participant);
    console.log(`[PERF] Drive search (find certificate): ${(performance.now() - driveSearchStart).toFixed(0)}ms`);
    certificateId = meta.id;
  } catch {
    setParticipantStatus(key, 'CERTIFICATE_NOT_FOUND');
    return { email: memberEmail, name: memberName, team: teamName, status: 'CERTIFICATE_NOT_FOUND', action: 'Certificate not found on Drive' };
  }

  // 4. Download certificate content
  let fileStream: NodeJS.ReadableStream;
  try {
    const driveDownloadStart = performance.now();
    fileStream = await getCertificateContent(certificateId) as NodeJS.ReadableStream;
    console.log(`[PERF] Drive download (get content): ${(performance.now() - driveDownloadStart).toFixed(0)}ms`);
  } catch {
    setParticipantStatus(key, 'FAILED');
    return { email: memberEmail, name: memberName, team: teamName, status: 'FAILED', action: 'Failed to download certificate' };
  }

  // 5. Send email
  try {
    const emailStart = performance.now();
    const sanitizedName = memberName.replace(/[^a-zA-Z0-9]/g, '_');
    const attachmentFilename = `NexHack_Certificate_${sanitizedName}.pdf`;
    await sendCertificateEmail(participant, memberEmail, fileStream, attachmentFilename);
    console.log(`[PERF] Email send: ${(performance.now() - emailStart).toFixed(0)}ms`);
  } catch {
    setParticipantStatus(key, 'FAILED');
    return { email: memberEmail, name: memberName, team: teamName, status: 'FAILED', action: 'Failed to send email' };
  }

  // 6. Success
  setParticipantStatus(key, 'SENT');
  incrementTodaySentCount();

  console.log(`[PERF] Total for ${memberName}: ${(performance.now() - totalStart).toFixed(0)}ms`);
  return { email: memberEmail, name: memberName, team: teamName, status: 'SENT', action: 'Email sent successfully' };
}
