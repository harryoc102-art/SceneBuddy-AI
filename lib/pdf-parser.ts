import pdf from 'pdf-parse';

export interface ParsedScript {
  title: string;
  characters: string[];
  speakingCharacters: string[];
  nonSpeakingCharacters: string[];
  sceneCount: number;
  totalDialogueLines: number;
  estimatedDuration: string;
  elements: ScriptElement[];
  confidence: 'high' | 'medium' | 'low';
}

export interface ScriptElement {
  line_id: string;
  scene_number: number;
  element_index: number;
  element_type: 'scene_heading' | 'action' | 'character' | 'parenthetical' | 'dialogue' | 'transition';
  character_name?: string;
  content: string;
  dialogue?: string;
  parenthetical?: string;
}

export async function parsePDF(base64Content: string): Promise<ParsedScript> {
  try {
    const buffer = Buffer.from(base64Content, 'base64');
    const data = await pdf(buffer);
    
    const text = data.text;
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    return parseScreenplay(lines, data.numpages);
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error('Failed to parse PDF');
  }
}

function parseScreenplay(lines: string[], pageCount: number): ParsedScript {
  const elements: ScriptElement[] = [];
  const characters = new Set<string>();
  const speakingCharacters = new Set<string>();
  let sceneNumber = 0;
  let elementIndex = 0;
  let lastCharacter: string | null = null;
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  
  // Title extraction - usually first few lines
  const title = extractTitle(lines);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upperLine = line.toUpperCase().trim();
    
    // Scene heading detection (INT./EXT. patterns)
    if (isSceneHeading(line)) {
      sceneNumber++;
      lastCharacter = null;
      elements.push({
        line_id: `scene_${sceneNumber}_heading`,
        scene_number: sceneNumber,
        element_index: elementIndex++,
        element_type: 'scene_heading',
        content: line
      });
      continue;
    }
    
    // Transition detection (CUT TO:, FADE TO:, etc.)
    if (isTransition(line)) {
      elements.push({
        line_id: `scene_${sceneNumber}_trans_${elementIndex}`,
        scene_number: sceneNumber,
        element_index: elementIndex++,
        element_type: 'transition',
        content: line
      });
      continue;
    }
    
    // Character name detection (ALL CAPS, centered-ish, followed by dialogue)
    if (isCharacterName(line, i, lines)) {
      const charName = line.trim();
      characters.add(charName);
      lastCharacter = charName;
      
      // Check for parenthetical on next line
      let parenthetical: string | undefined;
      let dialogueStart = i + 1;
      
      if (i + 1 < lines.length && isParenthetical(lines[i + 1])) {
        parenthetical = lines[i + 1].replace(/[()]/g, '').trim();
        dialogueStart = i + 2;
      }
      
      // Collect dialogue lines
      const dialogueLines: string[] = [];
      while (dialogueStart < lines.length && 
             !isSceneHeading(lines[dialogueStart]) && 
             !isCharacterName(lines[dialogueStart], dialogueStart, lines) &&
             !isTransition(lines[dialogueStart])) {
        const dialogueLine = lines[dialogueStart].trim();
        if (dialogueLine && !isParenthetical(dialogueLine)) {
          dialogueLines.push(dialogueLine);
        }
        dialogueStart++;
      }
      
      if (dialogueLines.length > 0) {
        speakingCharacters.add(charName);
        const dialogue = dialogueLines.join(' ');
        
        elements.push({
          line_id: `scene_${sceneNumber}_char_${elementIndex}`,
          scene_number: sceneNumber,
          element_index: elementIndex++,
          element_type: 'character',
          character_name: charName,
          content: line,
          dialogue,
          parenthetical
        });
        
        // Add dialogue element separately for teleprompter
        elements.push({
          line_id: `scene_${sceneNumber}_dialog_${elementIndex}`,
          scene_number: sceneNumber,
          element_index: elementIndex++,
          element_type: 'dialogue',
          character_name: charName,
          content: dialogue,
          dialogue
        });
        
        i = dialogueStart - 1; // Skip processed lines
        continue;
      }
    }
    
    // Parenthetical (should be caught above, but just in case)
    if (isParenthetical(line)) {
      continue; // Skip standalone parentheticals
    }
    
    // Action lines (everything else in a scene)
    if (sceneNumber > 0 && line.length > 0) {
      elements.push({
        line_id: `scene_${sceneNumber}_action_${elementIndex}`,
        scene_number: sceneNumber,
        element_index: elementIndex++,
        element_type: 'action',
        content: line
      });
    }
  }
  
  // Calculate confidence based on parsing quality
  if (sceneNumber > 0 && speakingCharacters.size > 1) {
    confidence = 'high';
  } else if (sceneNumber > 0) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }
  
  // Calculate estimated duration (rough: ~1 min per page)
  const estimatedDuration = `${Math.max(1, Math.round(pageCount * 0.8))}-${Math.round(pageCount * 1.2)} min`;
  
  return {
    title,
    characters: Array.from(characters),
    speakingCharacters: Array.from(speakingCharacters),
    nonSpeakingCharacters: Array.from(characters).filter(c => !speakingCharacters.has(c)),
    sceneCount: sceneNumber,
    totalDialogueLines: elements.filter(e => e.element_type === 'dialogue').length,
    estimatedDuration,
    elements,
    confidence
  };
}

function extractTitle(lines: string[]): string {
  // Look for title in first 20 lines
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    const line = lines[i].trim();
    // Skip common header lines
    if (line.match(/^(written by|created by|episode|draft|revision|date|page)/i)) {
      continue;
    }
    if (line.length > 2 && line.length < 100 && !line.includes('  ')) {
      return line;
    }
  }
  return 'Untitled Script';
}

function isSceneHeading(line: string): boolean {
  const scenePattern = /^(INT|EXT|INT\.\/EXT|EXT\.\/INT|I\/E|E\/I)[.\s]/i;
  return scenePattern.test(line.trim());
}

function isTransition(line: string): boolean {
  const transitions = ['CUT TO:', 'FADE TO:', 'FADE IN:', 'FADE OUT:', 'DISSOLVE TO:', 'SMASH CUT TO:', 'MATCH CUT TO:', 'JUMP CUT TO:'];
  return transitions.some(t => line.toUpperCase().includes(t));
}

function isCharacterName(line: string, index: number, allLines: string[]): boolean {
  const trimmed = line.trim();
  
  // Character names are typically:
  // - All caps or Title Case
  // - Short (1-4 words)
  // - Followed by dialogue
  
  if (trimmed.length === 0 || trimmed.length > 40) return false;
  
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount > 4) return false;
  
  // Check if mostly uppercase (common in screenplays)
  const isUppercase = trimmed === trimmed.toUpperCase();
  const isTitleCase = /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/.test(trimmed);
  
  if (!isUppercase && !isTitleCase) return false;
  
  // Look ahead for dialogue or parenthetical
  if (index + 1 >= allLines.length) return false;
  
  const nextLine = allLines[index + 1].trim();
  const nextNextLine = index + 2 < allLines.length ? allLines[index + 2].trim() : '';
  
  // Next line should be parenthetical or dialogue
  const hasFollowUp = isParenthetical(nextLine) || 
                      (nextLine.length > 0 && !isSceneHeading(nextLine) && !isTransition(nextLine));
  
  return hasFollowUp;
}

function isParenthetical(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('(') && trimmed.endsWith(')');
}
