'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

interface ScriptElement {
  id: string;
  line_id: string;
  scene_number: number;
  element_index: number;
  element_type: 'action' | 'character' | 'dialogue' | 'scene_heading' | 'parenthetical';
  character_name?: string;
  content: string;
  dialogue?: string;
  parenthetical?: string;
}

interface Script {
  id: string;
  title: string;
  speaking_characters: string[];
}

export default function RehearsePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const scriptId = params.id as string;
  const sessionId = searchParams.get('session');

  const [script, setScript] = useState<Script | null>(null);
  const [elements, setElements] = useState<ScriptElement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userCharacter, setUserCharacter] = useState('');
  const [voiceMappings, setVoiceMappings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const teleprompterRef = useRef<HTMLDivElement>(null);
  const currentLineRef = useRef<HTMLDivElement>(null);

  // Fetch script and session data
  useEffect(() => {
    fetchScript();
  }, [scriptId]);

  useEffect(() => {
    // Scroll to current line
    if (currentLineRef.current && teleprompterRef.current) {
      currentLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentIndex]);

  const fetchScript = async () => {
    try {
      const response = await fetch(`/api/scripts/${scriptId}`);
      if (!response.ok) throw new Error('Failed to load script');
      const data = await response.json();
      setScript(data.script);
      setElements(data.elements);
      
      // Get session data
      if (sessionId) {
        const sessionRes = await fetch(`/api/sessions/${sessionId}`);
        if (sessionRes.ok) {
          const sessionData = await sessionRes.json();
          setUserCharacter(sessionData.session.user_character);
          setVoiceMappings(sessionData.session.voice_mappings || {});
          setCurrentIndex(sessionData.session.current_line_index || 0);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Play AI voice for current line
  const playCurrentLine = useCallback(async () => {
    const currentElement = elements[currentIndex];
    if (!currentElement || !currentElement.dialogue) return;

    // Don't play if it's the user's line
    if (currentElement.character_name === userCharacter) return;

    setIsPlaying(true);

    try {
      const voiceId = voiceMappings[currentElement.character_name || ''] || 
                     '21m00Tcm4TlvDq8ikWAM'; // Default to Rachel

      const response = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: currentElement.dialogue,
          voiceId,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate voice');

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play();
      }
    } catch (err) {
      console.error('Voice error:', err);
    } finally {
      setIsPlaying(false);
    }
  }, [currentIndex, elements, userCharacter, voiceMappings]);

  // Advance to next line
  const advanceLine = useCallback(() => {
    if (currentIndex < elements.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, elements.length]);

  // Go back to previous line
  const goBack = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        advanceLine();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        goBack();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        advanceLine();
      } else if (e.code === 'KeyP') {
        e.preventDefault();
        setIsPaused(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [advanceLine, goBack]);

  // Auto-play AI lines
  useEffect(() => {
    const currentElement = elements[currentIndex];
    if (currentElement && 
        currentElement.element_type === 'dialogue' && 
        currentElement.character_name !== userCharacter) {
      playCurrentLine();
    }
  }, [currentIndex, elements, playCurrentLine, userCharacter]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const currentElement = elements[currentIndex];
  const isUserLine = currentElement?.character_name === userCharacter;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Audio element for AI voices */}
      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} />

      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">{script?.title}</h1>
            <p className="text-sm text-gray-400">
              Playing: <span className="text-green-400">{userCharacter}</span> | 
              Scene {currentElement?.scene_number || 1}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="text-gray-400 hover:text-white text-sm"
            >
              Exit
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex h-[calc(100vh-64px)]">
        {/* Teleprompter */}
        <div 
          ref={teleprompterRef}
          className="flex-1 overflow-y-auto p-6 space-y-2"
        >
          {elements.map((element, index) => {
            const isCurrent = index === currentIndex;
            const isPast = index < currentIndex;
            const isFuture = index > currentIndex;

            return (
              <div
                key={element.id}
                ref={isCurrent ? currentLineRef : null}
                className={`p-4 rounded-lg transition-all duration-300 ${
                  isCurrent 
                    ? 'bg-blue-600/20 border-2 border-blue-500' 
                    : isPast 
                      ? 'opacity-40' 
                      : 'opacity-70'
                }`}
              >
                {element.element_type === 'scene_heading' && (
                  <div className="text-yellow-400 font-semibold uppercase tracking-wide">
                    {element.content}
                  </div>
                )}

                {element.element_type === 'action' && (
                  <div className="text-gray-300 italic">
                    {element.content}
                  </div>
                )}

                {element.element_type === 'character' && (
                  <div className="text-center">
                    <span className={`font-bold text-lg ${
                      element.character_name === userCharacter 
                        ? 'text-green-400' 
                        : 'text-blue-400'
                    }`}>
                      {element.character_name}
                    </span>
                    {element.parenthetical && (
                      <span className="text-gray-400 text-sm ml-2">
                        ({element.parenthetical})
                      </span>
                    )}
                  </div>
                )}

                {element.element_type === 'dialogue' && (
                  <div className={`pl-8 ${
                    element.character_name === userCharacter 
                      ? 'text-green-300' 
                      : 'text-white'
                  }`}>
                    <p className="text-xl leading-relaxed">{element.dialogue}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Controls sidebar */}
        <div className="w-64 bg-gray-800 border-l border-gray-700 p-4 flex flex-col">
          {/* Current line indicator */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Current Line</h3>
            <div className={`p-3 rounded-lg ${
              isUserLine ? 'bg-green-600/20 border border-green-500' : 'bg-blue-600/20 border border-blue-500'
            }`}>
              <p className="text-sm text-gray-300">
                {isUserLine ? 'YOUR TURN' : 'AI SPEAKING'}
              </p>
              <p className="font-semibold">
                {currentElement?.character_name || 'Stage Direction'}
              </p>
            </div>
          </div>

          {/* Control buttons */}
          <div className="space-y-3">
            <button
              onClick={goBack}
              disabled={currentIndex === 0}
              className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 rounded-lg font-medium transition-colors"
            >
              ← Previous Line
            </button>

            <button
              onClick={advanceLine}
              className="w-full px-4 py-4 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold text-lg transition-colors"
            >
              Next Line →
            </button>

            <div className="pt-4 border-t border-gray-700">
              <button
                onClick={() => setIsPaused(!isPaused)}
                className={`w-full px-4 py-3 rounded-lg font-medium transition-colors ${
                  isPaused ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                {isPaused ? '▶ Resume' : '⏸ Pause'}
              </button>
            </div>

            {currentElement?.character_name && currentElement.character_name !== userCharacter && (
              <button
                onClick={playCurrentLine}
                disabled={isPlaying}
                className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg font-medium transition-colors"
              >
                {isPlaying ? '🔊 Playing...' : '🔊 Replay Line'}
              </button>
            )}
          </div>

          {/* Progress */}
          <div className="mt-auto">
            <div className="text-sm text-gray-400 mb-2">
              Progress: {currentIndex + 1} / {elements.length}
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${((currentIndex + 1) / elements.length) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Keyboard shortcuts */}
          <div className="mt-6 text-xs text-gray-500">
            <p className="font-medium mb-2">Shortcuts:</p>
            <p>Space: Next line</p>
            <p>← →: Navigate</p>
            <p>P: Pause/Resume</p>
          </div>
        </div>
      </div>
    </div>
  );
}
