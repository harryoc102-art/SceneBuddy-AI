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

    const { id: sessionId } = params;

    const result = await sql`
      SELECT * FROM rehearsal_sessions
      WHERE id = ${sessionId} AND user_id = ${userId}
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ session: result.rows[0] });

  } catch (error: any) {
    console.error('Fetch session error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch session' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: sessionId } = params;
    const { currentLineIndex, sessionStatus } = await req.json();

    const result = await sql`
      UPDATE rehearsal_sessions
      SET 
        current_line_index = COALESCE(${currentLineIndex}, current_line_index),
        session_status = COALESCE(${sessionStatus}, session_status),
        completed_at = CASE WHEN ${sessionStatus} = 'completed' THEN NOW() ELSE completed_at END
      WHERE id = ${sessionId} AND user_id = ${userId}
      RETURNING *
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ session: result.rows[0] });

  } catch (error: any) {
    console.error('Update session error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update session' },
      { status: 500 }
    );
  }
}
