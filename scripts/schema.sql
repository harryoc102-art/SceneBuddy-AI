CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS script_extractions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  extracted_text TEXT NOT NULL,
  page_count INTEGER NOT NULL,
  extraction_status TEXT NOT NULL DEFAULT 'processing',
  extraction_error TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_script_extractions_user_id ON script_extractions(user_id);

CREATE TABLE IF NOT EXISTS formatted_scripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  extraction_id UUID NOT NULL REFERENCES script_extractions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  formatted_screenplay JSONB NOT NULL,
  characters TEXT[] NOT NULL DEFAULT '{}',
  scene_count INTEGER NOT NULL DEFAULT 0,
  parsing_status TEXT NOT NULL DEFAULT 'processing',
  parsing_error TEXT,
  parsing_confidence TEXT NOT NULL DEFAULT 'medium',
  total_dialogue_lines INTEGER NOT NULL DEFAULT 0,
  speaking_characters TEXT[] NOT NULL DEFAULT '{}',
  non_speaking_characters TEXT[] NOT NULL DEFAULT '{}',
  estimated_duration TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_formatted_scripts_user_id ON formatted_scripts(user_id);

CREATE TABLE IF NOT EXISTS script_elements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  script_id UUID NOT NULL REFERENCES formatted_scripts(id) ON DELETE CASCADE,
  line_id TEXT NOT NULL,
  scene_number INTEGER NOT NULL,
  element_index INTEGER NOT NULL,
  element_type TEXT NOT NULL,
  character_name TEXT,
  content TEXT NOT NULL,
  dialogue TEXT,
  parenthetical TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(script_id, line_id)
);

CREATE INDEX IF NOT EXISTS idx_script_elements_script_id ON script_elements(script_id);
CREATE INDEX IF NOT EXISTS idx_script_elements_scene ON script_elements(script_id, scene_number);
CREATE INDEX IF NOT EXISTS idx_script_elements_type ON script_elements(script_id, element_type);

CREATE TABLE IF NOT EXISTS rehearsal_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  script_id UUID NOT NULL REFERENCES formatted_scripts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  session_name TEXT,
  user_character TEXT NOT NULL,
  ai_characters TEXT[] NOT NULL DEFAULT '{}',
  current_scene_number INTEGER NOT NULL DEFAULT 1,
  current_line_index INTEGER NOT NULL DEFAULT 0,
  session_status TEXT NOT NULL DEFAULT 'active',
  voice_mappings JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rehearsal_sessions_user_id ON rehearsal_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_rehearsal_sessions_script_id ON rehearsal_sessions(script_id);
