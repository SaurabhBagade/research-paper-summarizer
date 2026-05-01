import { useState } from 'react';
import {
  Mic, Brain, ExternalLink
} from 'lucide-react';
import { AudioPlayer } from './AudioPlayer';
import { MindmapView } from './MindmapView';

interface StudioProps {
  notebookId: string;
  documentId?: string;
  isProcessingPDF?: boolean;
  onImageClick?: (page: number) => void;
  notebookLanguage?: string;
}

export function IntelHub({ notebookId, documentId, isProcessingPDF, onImageClick, notebookLanguage }: StudioProps) {
  const [activeTab, setActiveTab] = useState<'audio' | 'mindmap'>('audio');

  return (
    <div className="h-full bg-[#1F2937] border-l border-[#374151] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3.5 border-b border-[#374151] flex items-center justify-between">
        <h2 className="font-semibold text-[#F3F4F6] text-sm">Studio</h2>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex border-b border-[#374151]">
        <button
          onClick={() => setActiveTab('audio')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'audio'
              ? 'text-[#3B82F6] border-b-2 border-[#3B82F6] bg-[#272E3E]/50'
              : 'text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#374151]/30'
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            <Mic className="h-4 w-4" />
            Audio Summary
          </span>
        </button>
        <button
          onClick={() => setActiveTab('mindmap')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'mindmap'
              ? 'text-[#3B82F6] border-b-2 border-[#3B82F6] bg-[#272E3E]/50'
              : 'text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#374151]/30'
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            <Brain className="h-4 w-4" />
            Mindmap
          </span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto min-h-0 p-6 flex flex-col">
        {activeTab === 'audio' && <AudioPlayer notebookId={notebookId} documentId={documentId} isProcessingPDF={isProcessingPDF} notebookLanguage={notebookLanguage} />}
        {activeTab === 'mindmap' && <MindmapView notebookId={notebookId} documentId={documentId} isProcessingPDF={isProcessingPDF} />}
      </div>
    </div>
  );
}
