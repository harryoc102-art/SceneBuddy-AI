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
  
  // Audio/WebRTC state
  const [connectionState, setConnectionState] = useState<'idle' | 'connecting' | 'active' | 'error'>('idle');
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [silenceTimer, setSilenceTimer] = useState(0);
  
  // UI state
  const [showDramaticPauseButton, setShowDramaticPauseButton] = useState(false);
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(true);
  const [currentAIText, setCurrentAIText] = useState('');

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const teleprompterRef = useRef<HTMLDivElement>(null);
  const currentLineRef = useRef<HTMLDivElement>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Constants
  const SILENCE_THRESHOLD = 1500; // 1.5 seconds of silence = user done speaking
  const DRAMATIC_PAUSE_THRESHOLD = 5000; // 5 seconds = offer dramatic pause button

  useEffect(() => {
    fetchScript();
    return () => cleanup();
  }, [scriptId]);

  useEffect(() => {
    if (currentLineRef.current && teleprompterRef.current) {
      currentLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentIndex]);

  const fetchScript = async () => {
    try {
      const response = await fetch(`/api/scripts/${scriptId}`);
      if (!response.ok) throw new Error('Failed to load script');
      const data = await response.json();
      setScript(data.script);
      setElements(data.elements);
      
      if (sessionId) {
        const sessionRes = await fetch(`/api/sessions/${sessionId}`);
        if (sessionRes.ok) {
          const sessionData = await sessionRes.json();
          setUserCharacter(sessionData.session.user_character);
          setVoiceMappings(sessionData.session.voice_mappings || {});
          setCurrentIndex(sessionData.session.current_line_index || 0);
          
          // Initialize WebRTC session
          initializeRealtimeSession(sessionData.session.user_character);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const cleanup = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
    }
  };

  const initializeRealtimeSession = async (userChar: string) => {
    try {
      setConnectionState('connecting');

      // Get ephemeral token from our API
      const tokenRes = await fetch('/api/voice/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          scriptId, 
          userCharacter: userChar 
        }),
      });

      if (!tokenRes.ok) throw new Error('Failed to get session token');
      const { sessionToken } = await tokenRes.json();

      // Get script context
      const contextRes = await fetch('/api/voice/script-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          scriptId, 
          userCharacter: userChar,
          currentLineIndex: 0 
        }),
      });

      const contextData = await contextRes.json();

      // Setup WebRTC
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      peerConnectionRef.current = pc;

      // Get microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // Audio output
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      document.body.appendChild(audioEl);
      audioElementRef.current = audioEl;

      pc.ontrack = (e) => {
        if (audioEl.srcObject !== e.streams[0]) {
          audioEl.srcObject = e.streams[0];
        }
      };

      // Data channel for events
      const dc = pc.createDataChannel('oai-events');
      dataChannelRef.current = dc;

      dc.onopen = () => {
        console.log('✅ Data channel open');
        setConnectionState('active');
        
        // Send initial session config
        dc.send(JSON.stringify({
          type: 'session.update',
          session: {
            instructions: contextData.instructions,
            modalities: ['audio', 'text'],
            voice: 'alloy',
            input_audio_transcription: { model: 'whisper-1' },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 2000, // 2 second silence = end of turn
            }
          }
        }));

        // Request response to start if AI speaks first
        if (contextData.nextSpeaker?.type === 'ai') {
          dc.send(JSON.stringify({
            type: 'response.create'
          }));
        }
      };

      dc.onmessage = (e) => {
        handleRealtimeEvent(JSON.parse(e.data));
      };

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const response = await fetch(
        'https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17',
        {
          method: 'POST',
          body: offer.sdp,
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
            'Content-Type': 'application/sdp'
          }
        }
      );

      if (!response.ok) throw new Error('Failed to connect to OpenAI');

      const answerSdp = await response.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

    } catch (error) {
      console.error('Session init error:', error);
      setConnectionState('error');
    }
  };

  const handleRealtimeEvent = useCallback((event: any) => {
    console.log('Realtime event:', event.type);

    switch (event.type) {
      case 'input_audio_buffer.speech_started':
        setIsUserSpeaking(true);
        setShowDramaticPauseButton(false);
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        break;

      case 'input_audio_buffer.speech_stopped':
        setIsUserSpeaking(false);
        // Start silence timer
        let silenceCount = 0;
        const checkSilence = () => {
          silenceCount += 100;
          setSilenceTimer(silenceCount);
          
          if (silenceCount >= DRAMATIC_PAUSE_THRESHOLD && !isAISpeaking) {
            setShowDramaticPauseButton(true);
          }
          
          if (silenceCount >= SILENCE_THRESHOLD && autoAdvanceEnabled && !isPaused) {
            // User has been silent for 1.5s, advance to next line
            advanceLine();
          } else {
            silenceTimeoutRef.current = setTimeout(checkSilence, 100);
          }
        };
        silenceTimeoutRef.current = setTimeout(checkSilence, 100);
        break;

      case 'response.audio_transcript.delta':
        setIsAISpeaking(true);
        setShowDramaticPauseButton(false);
        if (event.delta) {
          setCurrentAIText(prev => prev + event.delta);
        }
        break;

      case 'response.audio_transcript.done':
        setIsAISpeaking(false);
        setCurrentAIText('');
        // AI finished speaking, advance after a brief pause
        setTimeout(() => advanceLine(), 500);
        break;

      case 'response.done':
        setIsAISpeaking(false);
        break;

      case 'error':
        console.error('Realtime API error:', event.error);
        break;
    }
  }, [autoAdvanceEnabled, isPaused, isAISpeaking]);

  const advanceLine = useCallback(() => {
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    setShowDramaticPauseButton(false);
    setSilenceTimer(0);
    
    setCurrentIndex(prev => {
      const next = prev + 1;
      if (next < elements.length) {
        // Update context in Realtime API
        updateContextWindow(next);
        return next;
      }
      return prev;
    });
  }, [elements.length]);

  const updateContextWindow = async (newIndex: number) => {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') return;

    try {
      const contextRes = await fetch('/api/voice/script-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptId,
          userCharacter,
          currentLineIndex: newIndex
        }),
      });

      const contextData = await contextRes.json();

      dataChannelRef.current.send(JSON.stringify({
        type: 'session.update',
        session: {
          instructions: contextData.instructions,
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 2000
          }
        }
      }));

      // Trigger AI response if it's AI's turn
      if (contextData.nextSpeaker?.type === 'ai') {
        dataChannelRef.current.send(JSON.stringify({
          type: 'response.create'
        }));
      }
    } catch (err) {
      console.error('Failed to update context:', err);
    }
  };

  const handleDramaticPause = () => {
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    setShowDramaticPauseButton(false);
    // Hold position, don't advance
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
    if (!isPaused) {
      // Resuming
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    }
  };

  const forceAdvance = () => {
    advanceLine();
  };

  const goBack = () => {
    if (currentIndex > 0) {
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      setCurrentIndex(prev => {
        const next = prev - 1;
        updateContextWindow(next);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const currentElement = elements[currentIndex];
  const isUserLine = currentElement?.character_name === userCharacter;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
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
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setAutoAdvanceEnabled(!autoAdvanceEnabled)}
              className={`px-3 py-1 rounded text-sm ${
                autoAdvanceEnabled ? 'bg-green-600' : 'bg-gray-600'
              }`}
            >
              {autoAdvanceEnabled ? 'Auto ✓' : 'Manual'}
            </button>
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
        <div ref={teleprompterRef} className="flex-1 overflow-y-auto p-6 space-y-2">
          {elements.map((element, index) => {
            const isCurrent = index === currentIndex;
            const isPast = index < currentIndex;
            
            return (
              <div
                key={element.id}
                ref={isCurrent ? currentLineRef : null}
                className={`p-4 rounded-lg transition-all duration-300 ${
                  isCurrent 
                    ? 'bg-blue-600/30 border-2 border-blue-500 scale-100' 
                    : isPast 
                      ? 'opacity-30' 
                      : 'opacity-60'
                }`}
              >
                {element.element_type === 'scene_heading' && (
                  <div className="text-yellow-400 font-semibold uppercase tracking-wide text-lg">
                    {element.content}
                  </div>
                )}

                {element.element_type === 'action' && (
                  <div className="text-gray-400 italic">
                    {element.content}
                  </div>
                )}

                {element.element_type === 'character' && (
                  <div className="text-center my-4">
                    <span className={`font-bold text-xl ${
                      element.character_name === userCharacter 
                        ? 'text-green-400' 
                        : 'text-blue-400'
                    }`}>
                      {element.character_name}
                    </span>
                    {element.parenthetical && (
                      <span className="text-gray-400 text-sm block mt-1">
                        ({element.parenthetical})
                      </span>
                    )}
                  </div>
                )}

                {element.element_type === 'dialogue' && (
                  <div className={`pl-4 border-l-4 ${
                    element.character_name === userCharacter 
                      ? 'border-green-500 text-green-100' 
                      : 'border-blue-500 text-white'
                  } ${isCurrent ? 'text-2xl' : 'text-lg'}`}>
                    <p className="leading-relaxed">{element.dialogue}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Controls sidebar */}
        <div className="w-72 bg-gray-800 border-l border-gray-700 p-4 flex flex-col">
          {/* Status indicator */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Status</h3>
            
            {/* Connection */}
            <div className={`p-3 rounded-lg mb-2 ${
              connectionState === 'active' ? 'bg-green-600/20 border border-green-500' :
              connectionState === 'connecting' ? 'bg-yellow-600/20 border border-yellow-500' :
              'bg-red-600/20 border border-red-500'
            }`}>
              <p className="text-sm">
                {connectionState === 'active' ? '🟢 Connected' :
                 connectionState === 'connecting' ? '🟡 Connecting...' :
                 '🔴 Disconnected'}
              </p>
            </div>

            {/* Who's speaking */}
            <div className={`p-3 rounded-lg ${
              isUserSpeaking ? 'bg-green-600/20 border border-green-500' :
              isAISpeaking ? 'bg-blue-600/20 border border-blue-500' :
              'bg-gray-700'
            }`}>
              <p className="text-sm font-medium">
                {isUserSpeaking ? '🎤 You Speaking' :
                 isAISpeaking ? '🔊 AI Speaking' :
                 isPaused ? '⏸ Paused' :
                 '⏳ Waiting...'}
              </p>
              
              {/* Silence progress bar */}
              {!isUserSpeaking && !isAISpeaking && !isPaused && silenceTimer > 0 && (
                <div className="mt-2">
                  <div className="text-xs text-gray-400 mb-1">
                    Advancing in {Math.max(0, Math.ceil((SILENCE_THRESHOLD - silenceTimer) / 1000))}s
                  </div>
                  <div className="w-full bg-gray-600 rounded-full h-1.5">
                    <div 
                      className="bg-blue-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (silenceTimer / SILENCE_THRESHOLD) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Dramatic Pause Button */}
          {showDramaticPauseButton && (
            <button
              onClick={handleDramaticPause}
              className="w-full mb-4 px-4 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg font-medium animate-pulse"
            >
              🎭 Keep Pausing
            </button>
          )}

          {/* Manual controls */}
          <div className="space-y-3">
            <button
              onClick={goBack}
              disabled={currentIndex === 0}
              className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 rounded-lg text-sm"
            >
              ← Go Back
            </button>

            <button
              onClick={forceAdvance}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold"
            >
              Next Line →
            </button>

            <button
              onClick={togglePause}
              className={`w-full px-4 py-2 rounded-lg font-medium ${
                isPaused ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {isPaused ? '▶ Resume' : '⏸ Pause'}
            </button>
          </div>

          {/* Current line preview */}
          <div className="mt-6 p-3 bg-gray-700 rounded-lg">
            <p className="text-xs text-gray-400 mb-1">Current:</p>
            <p className="font-medium text-sm">
              {isUserLine ? '🟢 Your Line' : '🔊 AI Line'}
            </p>
            <p className="text-gray-300 text-sm mt-1 line-clamp-3">
              {currentElement?.dialogue || currentElement?.content}
            </p>
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

          {/* Instructions */}
          <div className="mt-6 text-xs text-gray-500">
            <p className="font-medium mb-1">How it works:</p>
            <p>• Speak naturally</p>
            <p>• Pause up to 1.5s between lines</p>
            <p>• Tap "Keep Pausing" for dramatic effect</p>
            <p>• AI responds automatically</p>
          </div>
        </div>
      </div>
    </div>
  );
}
