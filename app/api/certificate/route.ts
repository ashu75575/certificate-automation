import { NextRequest, NextResponse } from 'next/server';
import { getParticipantCertificate } from '@/lib/drive';
import { getParticipants } from '@/lib/excel';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const participants = getParticipants();
    const participant = participants.find(p => p.memberEmail === email);

    if (!participant) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }

    const certificateMeta = await getParticipantCertificate(participant);

    return NextResponse.json({
      success: true,
      metadata: certificateMeta
    });

  } catch (error: unknown) {
    console.error("Certificate API Error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage || 'Failed to fetch certificate' }, { status: 500 });
  }
}
