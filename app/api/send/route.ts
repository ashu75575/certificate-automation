import { NextResponse } from 'next/server';
import { getParticipants, mergeWithSavedStatus } from '@/lib/excel';
import { getTodaySentCount, getDailyLimit } from '@/lib/status';
import { processParticipant } from '@/lib/sender';
import type { ParticipantStatus } from '@/lib/status';

function computeStats(participants: { status: ParticipantStatus }[]) {
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

  return { total: participants.length, sent, pending, failed, invalidEmail, certificateNotFound };
}

export async function POST() {
  try {
    // 1. Load participants with saved status
    const raw = getParticipants();
    const participants = mergeWithSavedStatus(raw);

    // 2. Check daily limit
    const dailyLimit = getDailyLimit();
    const todaySent = getTodaySentCount();

    if (todaySent >= dailyLimit) {
      const stats = computeStats(participants);
      return NextResponse.json({
        processed: null,
        stats,
        dailyCount: { sent: todaySent, limit: dailyLimit },
        hasMore: false,
        stopped: true,
        stopReason: 'DAILY_LIMIT_REACHED',
      });
    }

    // 3. Find next eligible participant (not SENT, INVALID_EMAIL, or CERTIFICATE_NOT_FOUND)
    const next = participants.find(p =>
      p.status !== 'SENT' && p.status !== 'INVALID_EMAIL' && p.status !== 'CERTIFICATE_NOT_FOUND'
    );

    if (!next) {
      const stats = computeStats(participants);
      return NextResponse.json({
        processed: null,
        stats,
        dailyCount: { sent: todaySent, limit: dailyLimit },
        hasMore: false,
        stopped: true,
        stopReason: 'ALL_PROCESSED',
      });
    }

    // 4. Process this single participant
    const result = await processParticipant(next);

    // 5. Re-read to get updated stats
    const updatedParticipants = mergeWithSavedStatus(getParticipants());
    const stats = computeStats(updatedParticipants);
    const updatedTodaySent = getTodaySentCount();

    // 6. Check if there are more to process
    const hasMore = updatedParticipants.some(p =>
      p.status !== 'SENT' && p.status !== 'INVALID_EMAIL' && p.status !== 'CERTIFICATE_NOT_FOUND'
    ) && updatedTodaySent < dailyLimit;

    return NextResponse.json({
      processed: result,
      stats,
      dailyCount: { sent: updatedTodaySent, limit: dailyLimit },
      hasMore,
      stopped: !hasMore,
      stopReason: updatedTodaySent >= dailyLimit ? 'DAILY_LIMIT_REACHED' : (!hasMore ? 'ALL_PROCESSED' : null),
    });

  } catch (error: unknown) {
    console.error('Send API Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
