'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface Script {
  id: string;
  title: string;
  characters: string[];
  speaking_characters: string[];
  scene_count: number;
}

interface Voice {
  voice_id: string;
  name: string;
  preview_url?: string;
}

export default function SetupPage() {
  const params = useParams();
  const router = useRouter();
  const scriptId = params.id as string;
  
  const [script, setScript] = useState<Script | null>(null);
  const [loading, setLoading] = useState(true);
  const [userCharacter, setUserCharacter] = useState('');
  const [voiceMappings, setVoiceMappings] = useState<Record<string, string>>({});
  const [voices, setVoices] = useState<Voice[]>([]);
  const [creating, setCreating] = useState(false);

  // Default voice options (in case API fails)
  const defaultVoices: Voice[] = [
    { voice_id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel (Female)' },
    { voice_id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi (Female)' },
    { voice_id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella (Female)' },
    { voice_id: 'ErXwobaYiN019PkySvjV', name: 'Antoni (Male)' },
    { voice_id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli (Female)' },
    { voice_id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh (Male)' },
    { voice_id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold (Male)' },
    { voice_id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam (Male)' },
    { voice_id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam (Male)' },
  ];

  useEffect(() => {
    fetchScript();
    fetchVoices();
  }, [scriptId]);

  const fetchScript = async () => {
    try {
      const response = await fetch(`/api/scripts/${scriptId}`);
      if (!response.ok) throw new Error('Failed to load script');
      const data = await response.json();
      setScript(data.script);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVoices = async () => {
    try {
      const response = await fetch('/api/voice');
      const data = await response.json();
      if (data.voices && data.voices.length > 0) {
        setVoices(data.voices.map((v: any) => ({ 
          voice_id: v.voice_id, 
          name: v.name 
        })));
      } else {
        setVoices(defaultVoices);
      }
    } catch {
      setVoices(defaultVoices);
    }
  };

  const handleVoiceChange = (character: string, voiceId: string) => {
    setVoiceMappings(prev => ({ ...prev, [character]: voiceId }));
  };

  const handleStartRehearsal = async () => {
    if (!userCharacter) return;
    
    setCreating(true);
    try {
      const aiCharacters = script?.speaking_characters.filter(c => c !== userCharacter) || [];
      
      const response = await fetch(`/api/scripts/${scriptId}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userCharacter,
          aiCharacters,
          voiceMappings,
        }),
      });

      if (!response.ok) throw new Error('Failed to create session');
      
      const data = await response.json();
      router.push(`/scripts/${scriptId}/rehearse?session=${data.session.id}`);
    } catch (err) {
      console.error(err);
      alert('Failed to start rehearsal. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!script) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">Script not found</h2>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 text-blue-600 hover:text-blue-800"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const availableCharacters = script.speaking_characters || script.characters || [];
  const aiCharacters = availableCharacters.filter(c => c !== userCharacter);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Setup Rehearsal</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-2">{script.title}</h2>
          <p className="text-gray-600">
            {script.scene_count} scenes • {availableCharacters.length} characters
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Step 1: Choose Your Character</h3>
          <p className="text-gray-600 mb-4">
            Select the character you want to play. The AI will voice all other characters.
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {availableCharacters.map((character) => (
              <button
                key={character}
                onClick={() => setUserCharacter(character)}
                className={`p-3 rounded-lg border-2 text-left transition-colors ${
                  userCharacter === character
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="font-medium">{character}</span>
                {userCharacter === character && (
                  <span className="ml-2 text-blue-600">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {userCharacter && aiCharacters.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Step 2: Assign Voices (Optional)</h3>
            <p className="text-gray-600 mb-4">
              Choose which voice each AI character should use. Leave as default for automatic assignment.
            </p>
            
            <div className="space-y-4">
              {aiCharacters.map((character, index) => (
                <div key={character} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">{character}</span>
                  <select
                    value={voiceMappings[character] || ''}
                    onChange={(e) => handleVoiceChange(character, e.target.value)}
                    className="ml-4 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Auto-assign</option>
                    {voices.map((voice) => (
                      <option key={voice.voice_id} value={voice.voice_id}>
                        {voice.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {userCharacter && (
          <div className="flex justify-center">
            <button
              onClick={handleStartRehearsal}
              disabled={creating}
              className="bg-green-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {creating ? 'Starting...' : '🎬 Start Rehearsal'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
