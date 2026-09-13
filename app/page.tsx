import Dashboard from '@/components/Dashboard';
import { getParticipants } from '@/lib/excel';

export default function Home() {
  const participants = getParticipants();

  return (
    <Dashboard initialParticipants={participants} />
  );
}
