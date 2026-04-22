import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useState } from 'react';
import { BookOpen, Share2, Settings, BarChart2, ArrowLeft } from 'lucide-react';
import { Message } from '../App';
import { SourceLibrary } from './SourceLibrary';
import { ChatView } from './ChatView';
import { IntelHub } from './IntelHub';
import { PDFViewer } from './PDFViewer';

interface WorkspaceProps {
  notebookId: string;
  notebookTitle?: string;
  documentId?: string;
  sessionId: string;
  initialMessages: Message[];
  onMessagesUpdate: (sessionId: string, messages: Message[]) => void;
  onNewChat: () => void;
  onBackToDashboard: () => void;
}

export function Workspace({
  notebookId,
  notebookTitle = 'Untitled Notebook',
  documentId,
  sessionId,
  initialMessages,
  onMessagesUpdate,
  onNewChat,
  onBackToDashboard,
}: WorkspaceProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [highlights, setHighlights] = useState<any[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(documentId || null);
  const [sourceCount, setSourceCount] = useState(0);
  const [showPDFViewer, setShowPDFViewer] = useState(false);

  const handleMessagesUpdate = (sid: string, msgs: Message[]) => {
    onMessagesUpdate(sid, msgs);

    const lastMsg = msgs[msgs.length - 1];
    if (lastMsg?.type === 'assistant') {
      if ((lastMsg as any).context_highlights?.length) {
        setHighlights((lastMsg as any).context_highlights);
      }
      if ((lastMsg as any).context_pages?.length > 0) {
        setCurrentPage((lastMsg as any).context_pages[0]);
      }
    }
  };

  const handleSelectDocument = (docId: string) => {
    setActiveDocumentId(docId);
    setShowPDFViewer(true);
  };

  return (
    <div
      className="h-screen w-full flex flex-col bg-[#111827] overflow-hidden"
      style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}
    >
      {/* Workspace Header */}
      <header className="flex-shrink-0 h-14 bg-[#1F2937] border-b border-[#374151] px-5 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          {/* Back to Dashboard */}
          <button
            onClick={onBackToDashboard}
            className="flex items-center gap-1.5 text-[#9CA3AF] hover:text-[#F3F4F6] transition-colors"
          >
            <BookOpen className="h-5 w-5 text-[#3B82F6]" />
            <span className="font-semibold text-[#F3F4F6] hidden sm:block">ResearchLM</span>
          </button>
          <div className="h-5 w-px bg-[#374151]" />
          <span className="text-sm text-[#F3F4F6] font-medium truncate max-w-[300px]">
            {notebookTitle}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#374151] rounded-md transition-colors">
            <BarChart2 className="h-4 w-4" />
            <span className="hidden md:block">Analytics</span>
          </button>
          <button className="p-2 text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#374151] rounded-md transition-colors">
            <Share2 className="h-4 w-4" />
          </button>
          <button className="p-2 text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#374151] rounded-md transition-colors">
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Three-Pane Layout */}
      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal" className="h-full">

          {/* LEFT PANE: Sources (25%) */}
          <Panel defaultSize={25} minSize={18} maxSize={38}>
            {showPDFViewer && activeDocumentId ? (
              <div className="h-full flex flex-col bg-[#1F2937] border-r border-[#374151]">
                <div className="flex-shrink-0 px-4 py-3 border-b border-[#374151] flex items-center gap-2">
                  <button
                    onClick={() => setShowPDFViewer(false)}
                    className="flex items-center gap-1.5 text-xs text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#374151] px-2 py-1.5 rounded-md transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to Library
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <PDFViewer
                    documentId={activeDocumentId}
                    currentPage={currentPage}
                    highlights={highlights}
                  />
                </div>
              </div>
            ) : (
              <SourceLibrary
                notebookId={notebookId}
                onSelectDocument={handleSelectDocument}
                selectedDocumentId={activeDocumentId}
              />
            )}
          </Panel>

          {/* Resize Handle */}
          <PanelResizeHandle className="w-[3px] bg-[#374151] hover:bg-[#3B82F6] transition-colors cursor-col-resize" />

          {/* CENTER PANE: Chat (50%) */}
          <Panel defaultSize={50} minSize={30}>
            <ChatView
              documentId={activeDocumentId || ''}
              notebookId={notebookId}
              sessionId={sessionId}
              initialMessages={initialMessages}
              onMessagesUpdate={handleMessagesUpdate}
              onNewChat={onNewChat}
              onPageJump={(page) => {
                setCurrentPage(page);
                if (activeDocumentId) setShowPDFViewer(true);
              }}
              sourceCount={sourceCount}
            />
          </Panel>

          {/* Resize Handle */}
          <PanelResizeHandle className="w-[3px] bg-[#374151] hover:bg-[#3B82F6] transition-colors cursor-col-resize" />

          {/* RIGHT PANE: Studio / Action Hub (25%) */}
          <Panel defaultSize={25} minSize={18} maxSize={38}>
            <IntelHub
              notebookId={notebookId}
              documentId={activeDocumentId || undefined}
              onImageClick={(page) => {
                setCurrentPage(page);
                if (activeDocumentId) setShowPDFViewer(true);
              }}
            />
          </Panel>

        </PanelGroup>
      </div>
    </div>
  );
}
