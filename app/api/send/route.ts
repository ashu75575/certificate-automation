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
    const batchStart = performance.now();

    // 1. Load participants with saved status
    const raw = getParticipants();
    const participants = mergeWithSavedStatus(raw);

    // 2. Check daily limit
    const dailyLimit = getDailyLimit();
    const todaySent = getTodaySentCount();

    if (todaySent >= dailyLimit) {
      const stats = computeStats(participants);
      return NextResponse.json({
        processed: [],
        stats,
        dailyCount: { sent: todaySent, limit: dailyLimit },
        hasMore: false,
        stopped: true,
        stopReason: 'DAILY_LIMIT_REACHED',
      });
    }

    // 3. Find next batch of eligible participants
    const BATCH_SIZE = 5;
    const remaining = dailyLimit - todaySent;
    const batchLimit = Math.min(BATCH_SIZE, remaining);

    const eligible = participants.filter(p =>
      p.status !== 'SENT' && p.status !== 'INVALID_EMAIL' && p.status !== 'CERTIFICATE_NOT_FOUND'
    ).slice(0, batchLimit);

    if (eligible.length === 0) {
      const stats = computeStats(participants);
      return NextResponse.json({
        processed: [],
        stats,
        dailyCount: { sent: todaySent, limit: dailyLimit },
        hasMore: false,
        stopped: true,
        stopReason: 'ALL_PROCESSED',
      });
    }

    // 4. Process batch concurrently
    const settledResults = await Promise.allSettled(eligible.map(p => processParticipant(p)));
    const processed = settledResults.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      // processParticipant never throws, but just in case:
      return {
        email: eligible[i].memberEmail,
        name: eligible[i].memberName,
        team: eligible[i].teamName,
        status: 'FAILED' as const,
        action: 'Unexpected processing error',
      };
    });

    // 5. Re-read to get updated stats
    const updatedParticipants = mergeWithSavedStatus(getParticipants());
    const stats = computeStats(updatedParticipants);
    const updatedTodaySent = getTodaySentCount();

    // 6. Check if there are more to process
    const hasMore = updatedParticipants.some(p =>
      p.status !== 'SENT' && p.status !== 'INVALID_EMAIL' && p.status !== 'CERTIFICATE_NOT_FOUND'
    ) && updatedTodaySent < dailyLimit;

    console.log(`[PERF] Batch of ${processed.length}: ${(performance.now() - batchStart).toFixed(0)}ms (${((performance.now() - batchStart) / processed.length).toFixed(0)}ms/participant)`);

    return NextResponse.json({
      processed,
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
