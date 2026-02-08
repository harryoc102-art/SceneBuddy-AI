import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { scriptId, userCharacter, currentLineIndex = 0 } = await req.json();

    // Fetch script and elements
    const [scriptResult, elementsResult] = await Promise.all([
      sql`SELECT * FROM formatted_scripts WHERE id = ${scriptId}`,
      sql`
        SELECT * FROM script_elements 
        WHERE script_id = ${scriptId}
        ORDER BY scene_number, element_index
      `
    ]);

    if (scriptResult.rows.length === 0) {
      return NextResponse.json({ error: 'Script not found' }, { status: 404 });
    }

    const script = scriptResult.rows[0];
    const allElements = elementsResult.rows;

    // Build sliding window context
    const windowSize = 20;
    const lookbackSize = 8;
    const startIndex = Math.max(0, currentLineIndex - lookbackSize);
    const endIndex = Math.min(allElements.length, currentLineIndex + windowSize);
    const windowElements = allElements.slice(startIndex, endIndex);

    // Get AI characters
    const aiCharacters = (script.speaking_characters || []).filter(
      (char: string) => char !== userCharacter
    );

    // Determine next speaker
    const nextSpeaker = determineNextSpeaker({
      allElements,
      currentLineIndex,
      userCharacter,
      aiCharacters
    });

    // Build instructions for OpenAI
    const instructions = buildInstructions({
      scriptTitle: script.title,
      userCharacter,
      aiCharacters,
      windowElements,
      currentLineIndex,
      allElements,
      nextSpeaker
    });

    return NextResponse.json({
      instructions,
      aiCharacters,
      nextSpeaker,
      currentWindow: {
        startIndex,
        endIndex,
        totalLines: allElements.length,
        currentLineIndex,
        windowElements: windowElements.map((el: any) => ({
          line_id: el.line_id,
          element_type: el.element_type,
          character_name: el.character_name,
          content: el.content,
          dialogue: el.dialogue,
          scene_number: el.scene_number
        }))
      }
    });

  } catch (error: any) {
    console.error('Script context error:', error);
    return NextResponse.json(
      { error: 'Failed to build script context' },
      { status: 500 }
    );
  }
}

function determineNextSpeaker({
  allElements,
  currentLineIndex,
  userCharacter,
  aiCharacters
}: {
  allElements: any[];
  currentLineIndex: number;
  userCharacter: string;
  aiCharacters: string[];
}) {
  // Find the next dialogue line after current position
  for (let i = currentLineIndex; i < allElements.length; i++) {
    const element = allElements[i];
    if (element.element_type === 'dialogue' && element.character_name) {
      const isUser = element.character_name === userCharacter;
      const isAI = aiCharacters.includes(element.character_name);
      
      return {
        character: element.character_name,
        type: isUser ? 'user' : isAI ? 'ai' : 'unknown'
      };
    }
  }

  return { character: 'unknown', type: 'unknown' };
}

function buildInstructions({
  scriptTitle,
  userCharacter,
  aiCharacters,
  windowElements,
  currentLineIndex,
  allElements,
  nextSpeaker
}: {
  scriptTitle: string;
  userCharacter: string;
  aiCharacters: string[];
  windowElements: any[];
  currentLineIndex: number;
  allElements: any[];
  nextSpeaker: any;
}) {
  // Build scene context
  const sceneContext = windowElements
    .filter((el: any) => el.element_type === 'scene_heading' || el.element_type === 'action')
    .slice(0, 3)
    .map((el: any) => {
      if (el.element_type === 'scene_heading') {
        return `SCENE: ${el.content}`;
      }
      return `ACTION: ${el.content}`;
    })
    .join('\n');

  // Build dialogue sequence
  const dialogueLines: string[] = [];
  let dialogueIndex = 1;
  
  for (const el of windowElements) {
    if (el.element_type === 'dialogue' && el.character_name) {
      const isUser = el.character_name === userCharacter;
      const speaker = isUser ? 'USER' : 'YOU';
      
      dialogueLines.push(
        `${dialogueIndex}. [${speaker}] ${el.character_name}: "${el.dialogue}"`
      );
      dialogueIndex++;
    }
  }

  const dialogueSequence = dialogueLines.join('\n');

  // Determine who starts
  const firstDialogue = windowElements.find((el: any) => el.element_type === 'dialogue');
  const aiStartsFirst = firstDialogue && aiCharacters.includes(firstDialogue.character_name);

  return `You are an AI scene partner for the script "${scriptTitle}".

=== ROLE ASSIGNMENT ===
You are voicing: ${aiCharacters.join(', ')}.
The user is playing: ${userCharacter}.

=== SCENE CONTEXT ===
${sceneContext || 'No scene context available.'}

=== CURRENT DIALOGUE SEQUENCE ===
${dialogueSequence || 'No dialogue in current window.'}

=== TURN MANAGEMENT ===
${aiStartsFirst 
  ? 'YOU SPEAK FIRST. Start with the first line in the dialogue sequence above.'
  : 'USER SPEAKS FIRST. Wait for the user to speak, then respond with your next line.'}

=== CRITICAL RULES ===
1. ONLY speak dialogue lines assigned to your characters (${aiCharacters.join(', ')})
2. NEVER read scene headings, action lines, or stage directions aloud
3. NEVER speak lines assigned to ${userCharacter} - those are for the user
4. Wait for the user to finish speaking (1.5 seconds of silence = done)
5. Match the emotional tone and pacing of the script
6. If the user goes off-script, gently guide them back
7. Stay in character and maintain the scene's context
8. Speak naturally with appropriate pauses and emotion
9. Follow the exact dialogue sequence - do not skip ahead or repeat lines

=== PAUSE DETECTION ===
The system will detect when the user stops speaking:
- 1.5 seconds of silence = user finished their line, you speak next
- If you need more time to respond, wait for the silence threshold

Remember: You are a professional scene partner. Be responsive, natural, and supportive.`;
}
