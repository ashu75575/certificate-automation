import fs from 'fs';
import path from 'path';

export type ParticipantStatus = 'PENDING' | 'SENT' | 'FAILED' | 'INVALID_EMAIL' | 'CERTIFICATE_NOT_FOUND';

interface StatusData {
  participants: Record<string, ParticipantStatus>;
  dailyCounts: Record<string, number>;
}

const STATUS_FILE = path.join(process.cwd(), 'data', 'status.json');

function getDefaultData(): StatusData {
  return { participants: {}, dailyCounts: {} };
}

export function loadStatus(): StatusData {
  try {
    if (!fs.existsSync(STATUS_FILE)) {
      return getDefaultData();
    }
    const raw = fs.readFileSync(STATUS_FILE, 'utf-8');
    return JSON.parse(raw) as StatusData;
  } catch {
    console.error('Failed to read status.json, using defaults');
    return getDefaultData();
  }
}

function saveStatus(data: StatusData): void {
  const dir = path.dirname(STATUS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(STATUS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export function getParticipantStatus(email: string): ParticipantStatus | undefined {
  const data = loadStatus();
  return data.participants[email];
}

export function setParticipantStatus(email: string, status: ParticipantStatus): void {
  const data = loadStatus();
  data.participants[email] = status;
  saveStatus(data);
}

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getTodaySentCount(): number {
  const data = loadStatus();
  return data.dailyCounts[getTodayKey()] || 0;
}

export function incrementTodaySentCount(): number {
  const data = loadStatus();
  const key = getTodayKey();
  const newCount = (data.dailyCounts[key] || 0) + 1;
  data.dailyCounts[key] = newCount;
  saveStatus(data);
  return newCount;
}

export function getDailyLimit(): number {
  return parseInt(process.env.DAILY_EMAIL_LIMIT || '500', 10);
}
