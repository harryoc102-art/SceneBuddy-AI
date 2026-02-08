'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';

interface UploadProgress {
  step: number;
  status: 'processing' | 'completed' | 'failed';
  message: string;
  current_step: number;
  total_steps: number;
}

export function ScriptUpload() {
  const { user } = useUser();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.type !== 'application/pdf') {
      setError('Please select a PDF file');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setFile(selectedFile);
    setError('');
    setSuccess(false);
  };

  const handleUpload = async () => {
    if (!file || !user) return;

    setUploading(true);
    setError('');
    setProgress({
      step: 1,
      status: 'processing',
      message: 'Reading PDF...',
      current_step: 1,
      total_steps: 3
    });

    try {
      const base64File = await fileToBase64(file);

      setProgress({
        step: 2,
        status: 'processing',
        message: 'Parsing screenplay...',
        current_step: 2,
        total_steps: 3
      });

      const response = await fetch('/api/scripts/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file: base64File,
          filename: file.name,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();

      setProgress({
        step: 3,
        status: 'completed',
        message: `✅ "${result.title}" ready! ${result.sceneCount} scenes, ${result.dialogueLines} lines.`,
        current_step: 3,
        total_steps: 3
      });

      setSuccess(true);
      setFile(null);

      const fileInput = document.getElementById('script-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      setTimeout(() => window.location.reload(), 2000);

    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Upload failed');
      setProgress({
        step: 0,
        status: 'failed',
        message: 'Upload failed',
        current_step: 0,
        total_steps: 3
      });
    } finally {
      setUploading(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Upload New Script</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select PDF Script
          </label>
          <input
            id="script-upload"
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            disabled={uploading}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
          />
        </div>

        {file && (
          <div className="bg-gray-50 p-3 rounded-md">
            <p className="text-sm text-gray-700">
              <strong>Selected:</strong> {file.name}
            </p>
            <p className="text-sm text-gray-500">
              Size: {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        )}

        {uploading && progress && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-blue-800">Processing Script</h3>
              <span className="text-sm text-blue-600">
                Step {progress.current_step} of {progress.total_steps}
              </span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2 mb-3">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${(progress.current_step / progress.total_steps) * 100}%` }}
              ></div>
            </div>
            <p className="text-sm text-blue-700">{progress.message}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <p className="text-sm text-green-700 font-medium">{progress?.message}</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            <p className="text-sm">{error}</p>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {uploading ? 'Processing...' : 'Upload & Process Script'}
        </button>

        <div className="text-xs text-gray-500 mt-2">
          <p>• PDF files only (max 10MB)</p>
          <p>• Automatically parses scenes, characters, and dialogue</p>
        </div>
      </div>
    </div>
  );
}
