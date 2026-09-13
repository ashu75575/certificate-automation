import { Participant, validateEmail } from './excel';
import { getParticipantCertificate, getCertificateContent } from './drive';
import { sendCertificateEmail } from './email';
import { setParticipantStatus, incrementTodaySentCount, type ParticipantStatus } from './status';

export interface ProcessResult {
  email: string;
  name: string;
  status: ParticipantStatus;
  action: string;
}

/**
 * Process a single participant: validate → find certificate → send email → update status.
 * Returns the result. Never throws — all errors are caught and returned as status updates.
 */
export async function processParticipant(participant: Participant): Promise<ProcessResult> {
  const { memberEmail, memberName } = participant;

  // 1. Skip if already sent
  if (participant.status === 'SENT') {
    return { email: memberEmail, name: memberName, status: 'SENT', action: 'Already sent — skipped' };
  }

  // 2. Validate email
  if (!validateEmail(memberEmail)) {
    setParticipantStatus(memberEmail, 'INVALID_EMAIL');
    return { email: memberEmail, name: memberName, status: 'INVALID_EMAIL', action: 'Invalid email address' };
  }

  // 3. Find certificate on Google Drive
  let certificateId: string;
  let certificateName: string;
  try {
    const meta = await getParticipantCertificate(participant);
    certificateId = meta.id;
    certificateName = meta.name;
  } catch {
    setParticipantStatus(memberEmail, 'CERTIFICATE_NOT_FOUND');
    return { email: memberEmail, name: memberName, status: 'CERTIFICATE_NOT_FOUND', action: 'Certificate not found on Drive' };
  }

  // 4. Download certificate content
  let fileStream: NodeJS.ReadableStream;
  try {
    fileStream = await getCertificateContent(certificateId) as NodeJS.ReadableStream;
  } catch {
    setParticipantStatus(memberEmail, 'FAILED');
    return { email: memberEmail, name: memberName, status: 'FAILED', action: 'Failed to download certificate' };
  }

  // 5. Send email
  try {
    const sanitizedName = memberName.replace(/[^a-zA-Z0-9]/g, '_');
    const attachmentFilename = `NexHack_Certificate_${sanitizedName}.pdf`;
    await sendCertificateEmail(participant, memberEmail, fileStream, attachmentFilename);
  } catch {
    setParticipantStatus(memberEmail, 'FAILED');
    return { email: memberEmail, name: memberName, status: 'FAILED', action: 'Failed to send email' };
  }

  // 6. Success
  setParticipantStatus(memberEmail, 'SENT');
  incrementTodaySentCount();

  void certificateName; // used for logging context only

  return { email: memberEmail, name: memberName, status: 'SENT', action: 'Email sent successfully' };
}
