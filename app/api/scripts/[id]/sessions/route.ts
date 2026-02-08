import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: scriptId } = params;
    const { userCharacter, aiCharacters, voiceMappings } = await req.json();

    // Verify script exists and belongs to user
    const scriptCheck = await sql`
      SELECT id FROM formatted_scripts WHERE id = ${scriptId} AND user_id = ${userId}
    `;

    if (scriptCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Script not found' }, { status: 404 });
    }

    // Create session
    const result = await sql`
      INSERT INTO rehearsal_sessions (
        script_id, user_id, user_character, ai_characters,
        current_scene_number, current_line_index, session_status,
        voice_mappings, started_at
      ) VALUES (
        ${scriptId}, ${userId}, ${userCharacter}, ${aiCharacters},
        1, 0, 'active', ${JSON.stringify(voiceMappings || {})}::jsonb,
        ${new Date().toISOString()}::timestamptz
      )
      RETURNING *
    `;

    return NextResponse.json({ session: result.rows[0] });

  } catch (error: any) {
    console.error('Create session error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create session' },
      { status: 500 }
    );
  }
}
