import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { scriptId, userCharacter } = await req.json();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Create ephemeral token for OpenAI Realtime API
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2024-12-17',
        voice: 'alloy',
        instructions: `You are an AI scene partner for an actor rehearsing a script. You voice characters other than ${userCharacter}. Speak naturally with appropriate emotion and pacing. Wait for the actor to finish speaking before responding.`,
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 1500
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI session creation error:', errorText);
      throw new Error('Failed to create voice session');
    }

    const session = await response.json();

    return NextResponse.json({
      sessionToken: session.client_secret.value,
      expiresAt: session.expires_at,
      sessionId: session.id,
    });

  } catch (error: any) {
    console.error('Voice session error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create voice session' },
      { status: 500 }
    );
  }
}
