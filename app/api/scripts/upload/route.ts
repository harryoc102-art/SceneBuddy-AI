import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { parsePDF } from '@/lib/pdf-parser';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { file, filename } = body;

    if (!file || !filename) {
      return NextResponse.json(
        { error: 'Missing file or filename' },
        { status: 400 }
      );
    }

    console.log(`📤 Processing script: ${filename} for user ${userId}`);

    // Parse PDF directly (no N8N!)
    const parsedScript = await parsePDF(file);
    
    console.log('✅ PDF parsed:', {
      title: parsedScript.title,
      characters: parsedScript.characters.length,
      scenes: parsedScript.sceneCount,
      lines: parsedScript.totalDialogueLines
    });

    // Save to database
    const extractionResult = await sql`
      INSERT INTO script_extractions (
        user_id, original_filename, file_size,
        extracted_text, page_count, extraction_status, uploaded_at
      ) VALUES (
        ${userId}, ${filename}, ${Buffer.byteLength(file, 'base64')},
        ${JSON.stringify(parsedScript)}, ${parsedScript.sceneCount},
        'completed', ${new Date().toISOString()}::timestamptz
      )
      RETURNING id
    `;

    const extractionId = extractionResult.rows[0].id;

    const scriptResult = await sql`
      INSERT INTO formatted_scripts (
        extraction_id, user_id, title, formatted_screenplay,
        characters, scene_count, parsing_status, parsing_confidence,
        total_dialogue_lines, speaking_characters, non_speaking_characters,
        estimated_duration
      ) VALUES (
        ${extractionId}, ${userId}, ${parsedScript.title},
        ${JSON.stringify(parsedScript)}::jsonb,
        ${parsedScript.characters}, ${parsedScript.sceneCount},
        'completed', ${parsedScript.confidence},
        ${parsedScript.totalDialogueLines},
        ${parsedScript.speakingCharacters},
        ${parsedScript.nonSpeakingCharacters},
        ${parsedScript.estimatedDuration}
      )
      RETURNING id
    `;

    const scriptId = scriptResult.rows[0].id;

    // Save elements
    for (const element of parsedScript.elements) {
      await sql`
        INSERT INTO script_elements (
          script_id, line_id, scene_number, element_index,
          element_type, character_name, content, dialogue, parenthetical
        ) VALUES (
          ${scriptId}, ${element.line_id}, ${element.scene_number},
          ${element.element_index}, ${element.element_type},
          ${element.character_name || null}, ${element.content},
          ${element.dialogue || null}, ${element.parenthetical || null}
        )
        ON CONFLICT (script_id, line_id) DO NOTHING
      `;
    }

    return NextResponse.json({
      success: true,
      scriptId,
      title: parsedScript.title,
      characters: parsedScript.characters,
      sceneCount: parsedScript.sceneCount,
      dialogueLines: parsedScript.totalDialogueLines,
      confidence: parsedScript.confidence
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: 500 }
    );
  }
}
