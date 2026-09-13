import { NextResponse } from 'next/server';
import { getParticipants, mergeWithSavedStatus } from '@/lib/excel';
import { getTodaySentCount, getDailyLimit } from '@/lib/status';
import type { ParticipantStatus } from '@/lib/status';

export async function GET() {
  try {
    const raw = getParticipants();
    const participants = mergeWithSavedStatus(raw);

    let sent = 0, pending = 0, failed = 0, invalidEmail = 0, certificateNotFound = 0;

    for (const p of participants) {
      switch (p.status) {
        case 'SENT': sent++; break;
        case 'FAILED': failed++; break;
        case 'INVALID_EMAIL': invalidEmail++; break;
        case 'CERTIFICATE_NOT_FOUND': certificateNotFound++; break;
        default: pending++; break;
      }
    }

    return NextResponse.json({
      stats: { total: participants.length, sent, pending, failed, invalidEmail, certificateNotFound },
      dailyCount: { sent: getTodaySentCount(), limit: getDailyLimit() },
      participants: participants.map(p => ({
        teamName: p.teamName,
        memberName: p.memberName,
        memberEmail: p.memberEmail,
        memberPhone: p.memberPhone,
        status: p.status as ParticipantStatus,
      })),
    });
  } catch (error: unknown) {
    console.error('Status API Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
