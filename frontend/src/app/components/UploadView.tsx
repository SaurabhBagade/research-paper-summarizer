import { useState, useCallback } from 'react';
import { Upload, FileText, Loader2 } from 'lucide-react';
import apiClient from '../api/client';

interface UploadViewProps {
  onUploadComplete: (documentId: string, fileName: string) => void;
}

export function UploadView({ onUploadComplete }: UploadViewProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const uploadFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file');
      return;
    }

    setFileName(file.name);
    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const { data } = await apiClient.post('/api/upload-pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onUploadComplete(data.document_id, file.name);
    } catch {
      setError('Failed to upload and process the PDF. Please try again.');
      setIsUploading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      uploadFile(file);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Research Paper Summarizer
          </h1>
          <p className="text-lg text-gray-600">
            Upload a research paper and ask questions to get instant insights powered by AI
          </p>
        </div>

        {/* Upload Area */}
        <div
          className={`relative backdrop-blur-xl bg-white/60 rounded-3xl border-2 border-dashed transition-all duration-300 ${isDragging
              ? 'border-indigo-500 bg-indigo-50/50 scale-105'
              : 'border-gray-300 hover:border-indigo-400'
            } ${isUploading ? 'pointer-events-none' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="p-12">
            {isUploading ? (
              <div className="flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-16 h-16 text-indigo-600 animate-spin" />
                <div className="text-center">
                  <p className="text-xl font-semibold text-gray-800 mb-2">
                    Processing your document...
                  </p>
                  {fileName && (
                    <p className="text-sm text-gray-600 flex items-center justify-center gap-2">
                      <FileText className="w-4 h-4" />
                      {fileName}
                    </p>
                  )}
                  <p className="text-sm text-gray-500 mt-4">
                    Extracting text and creating vector embeddings
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-6">
                <div className="p-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg">
                  <Upload className="w-12 h-12 text-white" />
                </div>
                <div className="text-center">
                  <p className="text-xl font-semibold text-gray-800 mb-2">
                    Drop your PDF here
                  </p>
                  <p className="text-sm text-gray-600 mb-4">
                    or click to browse files
                  </p>
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    accept=".pdf"
                    onChange={handleFileSelect}
                  />
                  <label
                    htmlFor="file-upload"
                    className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium cursor-pointer hover:bg-indigo-700 transition-colors shadow-md hover:shadow-lg"
                  >
                    Choose File
                  </label>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-600 text-center">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: '📄', title: 'Upload PDF', desc: 'Any research paper' },
            { icon: '🤖', title: 'AI Analysis', desc: 'FLAN-T5 powered' },
            { icon: '💬', title: 'Ask Questions', desc: 'Get instant answers' },
          ].map((feature, i) => (
            <div
              key={i}
              className="backdrop-blur-xl bg-white/50 rounded-2xl p-4 text-center border border-white/60 shadow-sm"
            >
              <div className="text-3xl mb-2">{feature.icon}</div>
              <p className="font-semibold text-gray-800">{feature.title}</p>
              <p className="text-sm text-gray-600">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}