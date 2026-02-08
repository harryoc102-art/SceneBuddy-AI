'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Script {
  id: string;
  title: string;
  characters: string[];
  scene_count: number;
  parsing_confidence: string;
  total_dialogue_lines: number;
  speaking_characters: string[];
  estimated_duration: string;
  created_at: string;
  original_filename: string;
  file_size: number;
  page_count: number;
  uploaded_at: string;
}

export function ScriptList() {
  const router = useRouter();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchScripts();
  }, []);

  const fetchScripts = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch('/api/scripts');
      
      if (!response.ok) {
        throw new Error('Failed to fetch scripts');
      }

      const data = await response.json();
      setScripts(data.scripts || []);
    } catch (err: any) {
      console.error('Error fetching scripts:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getConfidenceBadge = (confidence: string) => {
    const colors = {
      high: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-red-100 text-red-800'
    };
    
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${colors[confidence as keyof typeof colors] || colors.medium}`}>
        {confidence.toUpperCase()}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <div className="text-gray-500">Loading scripts...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center text-red-600">
          <p className="font-medium">Error Loading Scripts</p>
          <button 
            onClick={fetchScripts}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">My Scripts</h2>
            <p className="text-sm text-gray-600 mt-1">
              {scripts.length} script{scripts.length !== 1 ? 's' : ''} ready for rehearsal
            </p>
          </div>
          <button 
            onClick={fetchScripts}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="divide-y divide-gray-200">
        {scripts.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-500 mb-2">No scripts uploaded yet</p>
            <p className="text-sm text-gray-400">Upload your first script to get started!</p>
          </div>
        ) : (
          scripts.map((script) => (
            <div key={script.id} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{script.title}</h3>
                    {getConfidenceBadge(script.parsing_confidence)}
                  </div>

                  <p className="text-sm text-gray-600 mb-2">{script.original_filename}</p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-500 mb-3">
                    <div><span className="font-medium">Characters:</span> {script.characters?.length || 0}</div>
                    <div><span className="font-medium">Scenes:</span> {script.scene_count}</div>
                    <div><span className="font-medium">Lines:</span> {script.total_dialogue_lines}</div>
                    <div><span className="font-medium">Duration:</span> {script.estimated_duration || 'N/A'}</div>
                  </div>

                  {script.speaking_characters && script.speaking_characters.length > 0 && (
                    <div className="mb-3">
                      <span className="text-sm font-medium text-gray-700">Characters: </span>
                      <span className="text-sm text-gray-600">
                        {script.speaking_characters.slice(0, 5).join(', ')}
                        {script.speaking_characters.length > 5 && ` +${script.speaking_characters.length - 5} more`}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center space-x-4 text-xs text-gray-400">
                    <span>Uploaded: {formatDate(script.uploaded_at)}</span>
                    <span>Size: {(script.file_size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                </div>

                <div className="flex flex-col space-y-2 ml-4">
                  <button
                    onClick={() => router.push(`/scripts/${script.id}/setup`)}
                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors text-sm whitespace-nowrap"
                  >
                    Start Rehearsing
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
