import { NextRequest, NextResponse } from 'next/server';
import { getParticipantCertificate, getCertificateContent } from '@/lib/drive';
import { getParticipants } from '@/lib/excel';
import { sendCertificateEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const { email, testRecipientEmail } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Participant email is required' }, { status: 400 });
    }

    if (!testRecipientEmail || !/^\S+@\S+\.\S+$/.test(testRecipientEmail)) {
      return NextResponse.json({ error: 'Valid test recipient email is required' }, { status: 400 });
    }

    const participants = getParticipants();
    const participant = participants.find(p => p.memberEmail === email);

    if (!participant) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }

    // 1. Fetch certificate metadata
    const certificateMeta = await getParticipantCertificate(participant);

    // 2. Fetch certificate content stream
    const fileStream = await getCertificateContent(certificateMeta.id);

    // 3. Sanitize filename
    const sanitizedName = participant.memberName.replace(/[^a-zA-Z0-9]/g, '_');
    const attachmentFilename = `NexHack_Certificate_${sanitizedName}.pdf`;

    // 4. Send email
    await sendCertificateEmail(participant, testRecipientEmail, fileStream as NodeJS.ReadableStream, attachmentFilename);

    return NextResponse.json({
      success: true,
      message: 'Test email sent successfully'
    });

  } catch (error: unknown) {
    console.error("Test Email API Error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage || 'Failed to send test email' }, { status: 500 });
  }
}
