import { useState, useEffect, useRef } from 'react';
import {
  FileText, Plus, Globe, Search, Filter,
  Loader2, Check, Upload, MoreVertical, X
} from 'lucide-react';
import apiClient from '../api/client';

interface Source {
  id: string;
  title: string;
  file_path: string;
  created_at?: string;
}

interface SourceLibraryProps {
  notebookId: string;
  onSelectDocument: (documentId: string) => void;
  selectedDocumentId?: string | null;
  onProcessingChange?: (isProcessing: boolean) => void;
}

export function SourceLibrary({ 
  notebookId, 
  onSelectDocument, 
  selectedDocumentId,
  onProcessingChange
}: SourceLibraryProps) {
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSources();
  }, [notebookId]);

  const fetchSources = async () => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.get(`/api/notebooks/${notebookId}/sources`);
      const loaded = data.sources || [];
      setSources(loaded);
      // Select all by default
      setSelectedSources(new Set(loaded.map((s: Source) => s.id)));
    } catch (e) {
      console.error('Failed to fetch sources', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') return;

    setIsUploading(true);
    setUploadProgress('Uploading...');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('notebook_id', notebookId);

    try {
      setUploadProgress('Sending to server...');
      const { data } = await apiClient.post('/api/upload-pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setUploadProgress('Processing in background...');

      // Poll for task completion (Celery is async)
      let retries = 0;
      const pollInterval = setInterval(async () => {
        retries++;
        try {
          if (data.task_id) {
            const taskRes = await apiClient.get(`/api/tasks/${data.task_id}`);
            if (taskRes.data.status === 'SUCCESS' || taskRes.data.status === 'completed' || taskRes.data.state === 'SUCCESS') {
              clearInterval(pollInterval);
              // Fetch final sources list
              const srcRes = await apiClient.get(`/api/notebooks/${notebookId}/sources`);
              const newSources = srcRes.data.sources || [];
              setSources(newSources);
              setSelectedSources(new Set(newSources.map((s: Source) => s.id)));
              setIsUploading(false);
              setUploadProgress(null);
            } else if (taskRes.data.status === 'FAILURE' || taskRes.data.status === 'error' || taskRes.data.state === 'FAILURE') {
              clearInterval(pollInterval);
              setIsUploading(false);
              setUploadProgress('Extraction failed');
            } else {
              setUploadProgress(`Extracting content... (${retries * 2}s)`);
            }
          } else {
            // Fallback
            clearInterval(pollInterval);
            setIsUploading(false);
            setUploadProgress(null);
          }
        } catch {
          clearInterval(pollInterval);
          setIsUploading(false);
          setUploadProgress(null);
        }
      }, 2000);
    } catch (e) {
      console.error('Upload failed', e);
      setIsUploading(false);
      setUploadProgress(null);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    if (onProcessingChange) {
      onProcessingChange(isUploading);
    }
  }, [isUploading, onProcessingChange]);

  const toggleSource = (id: string) => {
    setSelectedSources(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedSources.size === sources.length) {
      setSelectedSources(new Set());
    } else {
      setSelectedSources(new Set(sources.map(s => s.id)));
    }
  };

  const filteredSources = sources.filter(s =>
    s.file_path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getSourceName = (source: Source) => {
    const parts = source.file_path.split('/');
    return parts[parts.length - 1] || source.file_path;
  };

  return (
    <div className="h-full bg-[#1F2937] border-r border-[#374151] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[#374151] flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-[#F3F4F6] text-sm">Sources</h2>
          <button
            className="p-1.5 text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#374151] rounded-md transition-colors"
            title="Filter"
          >
            <Filter className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280]" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search sources..."
            className="w-full pl-9 pr-4 py-2 bg-[#111827] border border-[#374151] focus:border-[#3B82F6] text-[#F3F4F6] placeholder:text-[#6B7280] rounded-md text-sm focus:outline-none transition-colors"
          />
        </div>

        {/* Add Sources Button */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="w-full flex items-center justify-center gap-2 border border-[#374151] text-[#F3F4F6] hover:bg-[#374151] disabled:opacity-60 disabled:cursor-not-allowed rounded-md py-2 text-sm font-medium transition-colors"
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin text-[#3B82F6]" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {isUploading ? (uploadProgress || 'Processing...') : 'Add sources'}
        </button>
      </div>

      {/* Select All */}
      {sources.length > 0 && (
        <div className="px-4 py-2.5 border-b border-[#374151] flex-shrink-0">
          <label className="flex items-center gap-2 cursor-pointer group">
            <div
              onClick={toggleAll}
              className={`w-4 h-4 rounded border flex items-center justify-center transition-colors cursor-pointer ${
                selectedSources.size === sources.length
                  ? 'bg-[#3B82F6] border-[#3B82F6]'
                  : 'border-[#374151] group-hover:border-[#6B7280]'
              }`}
            >
              {selectedSources.size === sources.length && <Check className="h-3 w-3 text-white" />}
            </div>
            <span className="text-sm text-[#F3F4F6]">Select all sources</span>
          </label>
        </div>
      )}

      {/* Source List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 text-[#3B82F6] animate-spin" />
          </div>
        ) : filteredSources.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="w-12 h-12 bg-[#374151] rounded-full flex items-center justify-center mb-3">
              <Upload className="h-5 w-5 text-[#6B7280]" />
            </div>
            <p className="text-sm text-[#9CA3AF] mb-2">
              {searchQuery ? 'No sources match your search' : 'No sources yet'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-sm text-[#3B82F6] hover:text-[#60A5FA] font-medium transition-colors"
              >
                Upload your first PDF →
              </button>
            )}
          </div>
        ) : (
          <div className="p-2 space-y-0.5">
            {filteredSources.map(source => {
              const isSelected = selectedSources.has(source.id);
              const isActive = selectedDocumentId === source.id;

              return (
                <div
                  key={source.id}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all duration-150 group ${
                    isSelected
                      ? 'bg-[#1A365D] border-l-[3px] border-l-[#3B82F6] pl-[9px]'
                      : 'border-l-[3px] border-l-transparent hover:bg-[#272E3E]'
                  }`}
                  onClick={() => toggleSource(source.id)}
                >
                  {/* Icon */}
                  <div className="flex-shrink-0 w-8 h-8 rounded bg-[#374151] flex items-center justify-center mt-0.5">
                    <FileText className="h-4 w-4 text-[#9CA3AF]" />
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#F3F4F6] line-clamp-2 leading-tight">
                      {getSourceName(source)}
                    </p>
                    <p className="text-[11px] text-[#6B7280] mt-0.5">
                      Local PDF
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={e => { e.stopPropagation(); onSelectDocument(source.id); }}
                      className="p-1 hover:bg-[#374151] rounded text-[#9CA3AF] hover:text-[#F3F4F6] transition-colors"
                      title="View PDF"
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[#374151] flex-shrink-0">
        <p className="text-xs text-[#6B7280]">
          {selectedSources.size} of {sources.length} source{sources.length !== 1 ? 's' : ''} selected
        </p>
      </div>
    </div>
  );
}
