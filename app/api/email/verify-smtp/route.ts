import { NextResponse } from 'next/server';
import { verifySMTPConnection } from '@/lib/email';

export async function GET() {
  try {
    const success = await verifySMTPConnection();
    return NextResponse.json({ success });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: errorMessage || 'SMTP connection failed' }, { status: 500 });
  }
}
