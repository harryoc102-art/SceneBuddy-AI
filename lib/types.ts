export interface ScriptExtraction {
  id: string;
  user_id: string;
  original_filename: string;
  file_size: number;
  extracted_text: string;
  page_count: number;
  extraction_status: 'processing' | 'completed' | 'failed';
  extraction_error?: string;
  uploaded_at: string;
  created_at: string;
}

export interface FormattedScript {
  id: string;
  extraction_id: string;
  user_id: string;
  title: string;
  formatted_screenplay: any;
  characters: string[];
  scene_count: number;
  parsing_status: 'processing' | 'completed' | 'failed';
  parsing_error?: string;
  parsing_confidence: 'high' | 'medium' | 'low';
  total_dialogue_lines: number;
  speaking_characters: string[];
  non_speaking_characters: string[];
  estimated_duration: string;
  created_at: string;
}

export interface ScriptElement {
  id: string;
  script_id: string;
  line_id: string;
  scene_number: number;
  element_index: number;
  element_type: 'action' | 'character' | 'transition' | 'scene_heading' | 'parenthetical' | 'dialogue';
  character_name?: string;
  content: string;
  dialogue?: string;
  parenthetical?: string;
  created_at: string;
}

export interface RehearsalSession {
  id: string;
  script_id: string;
  user_id: string;
  session_name?: string;
  user_character: string;
  ai_characters: string[];
  current_scene_number: number;
  current_line_index: number;
  session_status: 'active' | 'paused' | 'completed';
  voice_mappings: Record<string, string>;
  started_at: string;
  completed_at?: string;
  created_at: string;
}
