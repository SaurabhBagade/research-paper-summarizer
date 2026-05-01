import { useState, useEffect, useRef } from 'react';
import {
  FileText, Plus, Globe, Search, Filter,
  Loader2, Check, Upload, MoreVertical, X, Eye, Edit2, Trash2
} from 'lucide-react';
import apiClient from '../api/client';
import { useCitation } from '../context/CitationContext';

interface Source {
  id: string;
  title: string;
  file_path: string;
  created_at?: string;
  status?: string;
  metadata_json?: {
    ner_tags?: Record<string, string[]>;
    [key: string]: any;
  };
}

interface SourceLibraryProps {
  notebookId: string;
  onSelectDocument: (documentId: string) => void;
  selectedDocumentId?: string | null;
  onProcessingChange?: (isProcessing: boolean) => void;
  onSourcesChange?: (count: number) => void;
}

export function SourceLibrary({ 
  notebookId, 
  onSelectDocument, 
  selectedDocumentId,
  onProcessingChange,
  onSourcesChange
}: SourceLibraryProps) {
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { highlightedSourceId } = useCitation();

  useEffect(() => {
    fetchSources();
  }, [notebookId]);

  useEffect(() => {
    if (onSourcesChange) {
      onSourcesChange(sources.length);
    }
  }, [sources.length, onSourcesChange]);

  const fetchSources = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const { data } = await apiClient.get(`/api/notebooks/${notebookId}/sources`);
      const loaded = data.sources || [];
      setSources(loaded);
      // Select all by default only on initial non-silent fetch
      if (!silent) {
        setSelectedSources(new Set(loaded.map((s: Source) => s.id)));
      }
    } catch (e) {
      console.error('Failed to fetch sources', e);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    const hasProcessing = sources.some(s => s.status === 'processing');
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      fetchSources(true);
    }, 3000);

    return () => clearInterval(interval);
  }, [sources, notebookId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const pdfFiles = files.filter(f => f.type === 'application/pdf');
    if (pdfFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress(`Uploading ${pdfFiles.length} file(s)...`);

    try {
      let completed = 0;
      const uploadPromises = pdfFiles.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('notebook_id', notebookId);
        const res = await apiClient.post('/api/upload-pdf', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        completed++;
        setUploadProgress(`Uploading ${completed} of ${pdfFiles.length} files...`);
        return res;
      });

      await Promise.all(uploadPromises);
      
      await fetchSources(true);
    } catch (e) {
      console.error('Upload failed', e);
    } finally {
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
    if (source.title) return source.title;
    const parts = source.file_path.split('/');
    return parts[parts.length - 1] || source.file_path;
  };

  const handleRenameSource = async (id: string, newName: string) => {
    if (!newName.trim()) {
      setEditingSourceId(null);
      return;
    }
    try {
      // Optimistic update
      setSources(prev => prev.map(s => s.id === id ? { ...s, title: newName } : s));
      // Call backend (Make sure this matches your actual API endpoint)
      await apiClient.patch(`/api/sources/${id}`, { title: newName });
    } catch (e) {
      console.error('Failed to rename source', e);
      fetchSources(true); // Revert on failure
    }
    setEditingSourceId(null);
  };

  const handleDeleteSource = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this source?')) return;
    try {
      setSources(prev => prev.filter(s => s.id !== id));
      await apiClient.delete(`/api/sources/${id}`);
    } catch (e) {
      console.error('Failed to delete source', e);
      fetchSources(true); // Revert on failure
    }
    setOpenDropdownId(null);
  };

  return (
    <div className="h-full bg-[#1F2937] border-r border-[#374151] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[#374151] flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-[#F3F4F6] text-sm">Sources</h2>
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
          multiple
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
            {filteredSources.map((source, index) => {
              const isSelected = selectedSources.has(source.id);
              const isActive = selectedDocumentId === source.id;
              const isProcessing = source.status === 'processing';
              const isFailed = source.status === 'failed';
              const isHighlighted = highlightedSourceId === String(index + 1) || highlightedSourceId === source.id;

              return (
                <div
                  key={source.id}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all duration-150 group ${
                    isProcessing ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                  } ${
                    isActive
                      ? 'bg-[#374151] border-l-[3px] border-l-[#3B82F6]'
                      : isHighlighted
                        ? 'bg-[#3B82F6]/20 ring-2 ring-[#3B82F6] shadow-[0_0_15px_rgba(59,130,246,0.4)]'
                        : !isProcessing && isSelected
                          ? 'bg-[#1A365D] border-l-[3px] border-l-[#3B82F6] pl-[9px]'
                          : 'border-l-[3px] border-l-transparent hover:bg-[#272E3E]'
                  }`}
                  onClick={() => {
                    if (!isProcessing) toggleSource(source.id);
                  }}
                >
                  {/* Icon */}
                  <div className="flex-shrink-0 w-8 h-8 rounded bg-[#374151] flex items-center justify-center mt-0.5">
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 text-[#3B82F6] animate-spin" />
                    ) : isFailed ? (
                      <X className="h-4 w-4 text-red-500" />
                    ) : (
                      <FileText className="h-4 w-4 text-[#9CA3AF]" />
                    )}
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    {editingSourceId === source.id ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onBlur={() => handleRenameSource(source.id, renameValue)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRenameSource(source.id, renameValue);
                          if (e.key === 'Escape') setEditingSourceId(null);
                        }}
                        className="w-full bg-[#111827] border border-[#3B82F6] text-[#F3F4F6] text-[13px] px-1 py-0.5 rounded outline-none mb-1"
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <p className="text-[13px] font-medium text-[#F3F4F6] line-clamp-2 leading-tight" title={getSourceName(source)}>
                        {getSourceName(source)}
                      </p>
                    )}
                    <p className="text-[11px] text-[#6B7280] mt-0.5">
                      Local PDF
                    </p>
                    {!isProcessing && source.metadata_json?.ner_tags && 
                      ((source.metadata_json.ner_tags.PERSON?.length || 0) > 0 || (source.metadata_json.ner_tags.ORG?.length || 0) > 0) && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {source.metadata_json.ner_tags.PERSON?.slice(0, 2).map((author, i) => (
                            <span key={`person-${i}`} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#4C1D95]/30 text-[#C4B5FD] border border-[#5B21B6]/50">
                              {author}
                            </span>
                          ))}
                          {source.metadata_json.ner_tags.ORG?.slice(0, 1).map((org, i) => (
                            <span key={`org-${i}`} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#1E3A8A]/30 text-[#93C5FD] border border-[#1E40AF]/50">
                              {org}
                            </span>
                          ))}
                        </div>
                    )}
                  </div>

                  {/* Actions */}
                  {!isProcessing && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={e => { e.stopPropagation(); onSelectDocument(source.id); }}
                        className="p-1 hover:bg-[#4B5563] rounded text-[#9CA3AF] hover:text-[#F3F4F6] transition-colors"
                        title="View PDF"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <div className="relative">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setOpenDropdownId(openDropdownId === source.id ? null : source.id);
                          }}
                          className="p-1 hover:bg-[#4B5563] rounded text-[#9CA3AF] hover:text-[#F3F4F6] transition-colors"
                          title="More options"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {openDropdownId === source.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpenDropdownId(null); }} />
                            <div className="absolute right-0 mt-1 w-32 bg-[#1F2937] border border-[#374151] rounded-md shadow-lg z-50 overflow-hidden py-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRenameValue(getSourceName(source));
                                  setEditingSourceId(source.id);
                                  setOpenDropdownId(null);
                                }}
                                className="w-full text-left px-3 py-1.5 text-xs text-[#F3F4F6] hover:bg-[#374151] flex items-center gap-2 transition-colors"
                              >
                                <Edit2 className="h-3 w-3" /> Rename
                              </button>
                              <button
                                onClick={(e) => handleDeleteSource(source.id, e)}
                                className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-[#374151] flex items-center gap-2 transition-colors"
                              >
                                <Trash2 className="h-3 w-3" /> Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
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
