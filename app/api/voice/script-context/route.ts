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

  // Build dialogue sequence with EXACT lines AI must speak
  const dialogueLines: string[] = [];
  const aiLines: string[] = [];
  let dialogueIndex = 1;
  
  for (const el of windowElements) {
    if (el.element_type === 'dialogue' && el.character_name) {
      const isUser = el.character_name === userCharacter;
      const speaker = isUser ? 'USER' : 'YOU';
      
      dialogueLines.push(
        `${dialogueIndex}. [${speaker}] ${el.character_name}: "${el.dialogue}"`
      );
      
      if (!isUser) {
        aiLines.push(`"${el.dialogue}"`);
      }
      
      dialogueIndex++;
    }
  }

  const dialogueSequence = dialogueLines.join('\n');
  const exactAILines = aiLines.join('\n');

  // Determine who starts
  const firstDialogue = windowElements.find((el: any) => el.element_type === 'dialogue');
  const aiStartsFirst = firstDialogue && aiCharacters.includes(firstDialogue.character_name);

  return `You are an AI scene partner reading EXACT LINES from the script "${scriptTitle}".

=== ROLE ASSIGNMENT ===
You are voicing: ${aiCharacters.join(', ')}.
The user is playing: ${userCharacter}.

=== YOUR EXACT LINES (READ THESE WORD-FOR-WORD) ===
${exactAILines || 'No lines in current window.'}

=== SCENE CONTEXT ===
${sceneContext || 'No scene context available.'}

=== FULL DIALOGUE SEQUENCE ===
${dialogueSequence || 'No dialogue in current window.'}

=== ABSOLUTE RULES - NEVER VIOLATE ===
1. **READ THE EXACT LINES PROVIDED** - Word for word, no changes, no improvisation
2. **NEVER AD-LIB** - Do not add, remove, or change a single word
3. **NEVER IMPROVISE** - If the line says "I love you" you say "I love you" - NOT "I really love you" or "You know I love you"
4. **ONLY SPEAK YOUR CHARACTER'S LINES** - Never speak ${userCharacter}'s lines
5. **NEVER MAKE UP DIALOGUE** - If you don't know the line, stay silent
6. **FOLLOW THE SEQUENCE EXACTLY** - Line 1, then Line 2, then Line 3 - never skip or repeat

=== IF USER GOES OFF-SCRIPT ===
- Do NOT improvise with them
- Do NOT play along
- Gently redirect: "Let's stick to the script. Your line is..." or simply stay silent and wait

=== EMOTIONAL DELIVERY ===
- Deliver lines with appropriate emotion and pacing
- BUT use the EXACT WORDS from the script
- Match the tone: angry, sad, excited, etc.
- Never change the words to show emotion

=== TURN MANAGEMENT ===
${aiStartsFirst 
  ? 'YOU SPEAK FIRST. Read the first line in your EXACT LINES above.'
  : 'USER SPEAKS FIRST. Wait for them to finish (1.0 second silence), then read your exact line.'}

=== PAUSE DETECTION ===
- 0.5s silence = user is thinking/breathing, keep listening
- 1.0s silence = user finished their line, speak your exact line next
- 3.0s+ silence = offer dramatic pause option

=== CRITICAL ===
You are NOT a creative partner. You are a SCRIPT READER. 
The actor needs to practice with the EXACT WORDS from the script.
Improvisation ruins their preparation.

**READ. THE. EXACT. LINES.**`;
}
