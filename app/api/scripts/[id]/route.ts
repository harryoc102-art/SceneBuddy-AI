import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    // Get script
    const scriptResult = await sql`
      SELECT fs.*, se.original_filename, se.file_size, se.uploaded_at
      FROM formatted_scripts fs
      JOIN script_extractions se ON fs.extraction_id = se.id
      WHERE fs.id = ${id} AND fs.user_id = ${userId}
    `;

    if (scriptResult.rows.length === 0) {
      return NextResponse.json({ error: 'Script not found' }, { status: 404 });
    }

    // Get elements
    const elementsResult = await sql`
      SELECT * FROM script_elements
      WHERE script_id = ${id}
      ORDER BY scene_number, element_index
    `;

    return NextResponse.json({
      script: scriptResult.rows[0],
      elements: elementsResult.rows
    });

  } catch (error: any) {
    console.error('Fetch script error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch script' },
      { status: 500 }
    );
  }
}
