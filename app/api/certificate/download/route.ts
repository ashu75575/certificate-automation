import { NextRequest, NextResponse } from 'next/server';
import { getCertificateContent } from '@/lib/drive';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    const stream = await getCertificateContent(fileId);

    // Provide the stream to the response with correct headers for inline viewing
    return new NextResponse(stream as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="certificate.pdf"',
      },
    });
  } catch (error: unknown) {
    console.error("Certificate Download API Error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage || 'Failed to download certificate' }, { status: 500 });
  }
}
