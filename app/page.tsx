import Dashboard from '@/components/Dashboard';
import { getParticipants, mergeWithSavedStatus } from '@/lib/excel';
import { getTodaySentCount, getDailyLimit } from '@/lib/status';

export default function Home() {
  const raw = getParticipants();
  const participants = mergeWithSavedStatus(raw);
  const todaySent = getTodaySentCount();
  const dailyLimit = getDailyLimit();

  return (
    <Dashboard
      initialParticipants={participants}
      initialDailyCount={todaySent}
      dailyLimit={dailyLimit}
    />
  );
}
