import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await sql`
      SELECT fs.*, se.original_filename, se.file_size, se.uploaded_at
      FROM formatted_scripts fs
      JOIN script_extractions se ON fs.extraction_id = se.id
      WHERE fs.user_id = ${userId}
      AND fs.parsing_status = 'completed'
      ORDER BY fs.created_at DESC
    `;

    return NextResponse.json({ scripts: result.rows });

  } catch (error: any) {
    console.error('Fetch scripts error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch scripts' },
      { status: 500 }
    );
  }
}
