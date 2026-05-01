import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useState, useEffect } from 'react';
import { BookOpen, Share2, Settings, BarChart2, ArrowLeft, X, UserPlus, Loader2 } from 'lucide-react';
import { Message } from '../App';
import { SourceLibrary } from './SourceLibrary';
import { ChatView } from './ChatView';
import { IntelHub } from './IntelHub';
import { PDFViewer } from './PDFViewer';
import { CitationProvider } from '../context/CitationContext';
import apiClient from '../api/client';

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
  const [isProcessingPDF, setIsProcessingPDF] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [notebookLanguage, setNotebookLanguage] = useState('English');
  const [isUpdatingLanguage, setIsUpdatingLanguage] = useState(false);

  useEffect(() => {
    const fetchNotebookLanguage = async () => {
      try {
        const { data } = await apiClient.get(`/api/notebooks/${notebookId}`);
        if (data.notebook?.language) {
          setNotebookLanguage(data.notebook.language);
        }
      } catch (err) {
        console.error('Failed to fetch notebook language', err);
      }
    };
    fetchNotebookLanguage();
  }, [notebookId]);

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

  const handleShare = async () => {
    if (!shareEmail.trim()) return;
    setIsSharing(true);
    try {
      await apiClient.post(`/api/notebooks/${notebookId}/share`, { email: shareEmail.trim() });
      alert('Notebook shared successfully!');
      setShowShareModal(false);
      setShareEmail('');
    } catch (err) {
      alert('Failed to share notebook. Ensure the user exists.');
    } finally {
      setIsSharing(false);
    }
  };

  const handleUpdateLanguage = async () => {
    setIsUpdatingLanguage(true);
    try {
      await apiClient.patch(`/api/notebooks/${notebookId}`, { language: notebookLanguage });
      setShowSettingsModal(false);
      // Optional: Show a subtle toast notification that language updated
    } catch (err) {
      console.error('Failed to update language', err);
      alert('Failed to update language settings');
    } finally {
      setIsUpdatingLanguage(false);
    }
  };

  return (
    <CitationProvider>
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
          <button onClick={() => setShowShareModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#F3F4F6] bg-[#3B82F6] hover:bg-[#2563EB] rounded-md transition-colors">
            <Share2 className="h-4 w-4" />
            Share
          </button>
          <button onClick={() => setShowSettingsModal(true)} className="p-2 text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#374151] rounded-md transition-colors">
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Three-Pane Layout */}
      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal" className="h-full">

          {/* LEFT PANE: Sources (always visible, slightly smaller if PDF is open) */}
          <Panel defaultSize={showPDFViewer ? 20 : 25} minSize={15} maxSize={30}>
            <SourceLibrary
              notebookId={notebookId}
              onSelectDocument={handleSelectDocument}
              selectedDocumentId={activeDocumentId}
              onProcessingChange={setIsProcessingPDF}
              onSourcesChange={setSourceCount}
            />
          </Panel>

          {/* Resize Handle */}
          <PanelResizeHandle className="w-[3px] bg-[#374151] hover:bg-[#3B82F6] transition-colors cursor-col-resize" />

          {/* CENTER PANE: Chat OR PDF Viewer */}
          <Panel defaultSize={showPDFViewer ? 50 : 50} minSize={30}>
            {showPDFViewer && activeDocumentId ? (
              <div className="h-full flex flex-col bg-[#1F2937] relative">
                <div className="absolute top-3 right-5 z-10">
                  <button
                    onClick={() => setShowPDFViewer(false)}
                    className="flex items-center gap-1.5 text-xs text-[#F3F4F6] bg-[#374151] hover:bg-[#4B5563] shadow-md px-3 py-1.5 rounded-md transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Close PDF
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
            )}
          </Panel>

          {/* Resize Handle */}
          <PanelResizeHandle className="w-[3px] bg-[#374151] hover:bg-[#3B82F6] transition-colors cursor-col-resize" />

          {/* RIGHT PANE: IntelHub OR ChatView (if PDF is open) */}
          <Panel defaultSize={showPDFViewer ? 30 : 25} minSize={20} maxSize={40}>
            {showPDFViewer ? (
              <ChatView
                documentId={activeDocumentId || ''}
                notebookId={notebookId}
                sessionId={sessionId}
                initialMessages={initialMessages}
                onMessagesUpdate={handleMessagesUpdate}
                onNewChat={onNewChat}
                onPageJump={(page) => {
                  setCurrentPage(page);
                }}
                sourceCount={sourceCount}
              />
            ) : (
              <IntelHub
                notebookId={notebookId}
                documentId={activeDocumentId || undefined}
                isProcessingPDF={isProcessingPDF}
                onImageClick={(page) => {
                  setCurrentPage(page);
                  if (activeDocumentId) setShowPDFViewer(true);
                }}
                notebookLanguage={notebookLanguage}
              />
            )}
          </Panel>

        </PanelGroup>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowShareModal(false); }}
        >
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-[#F3F4F6] flex items-center gap-2"><UserPlus className="h-5 w-5 text-[#3B82F6]" /> Share Canvas</h2>
              <button onClick={() => setShowShareModal(false)} className="p-1.5 text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#374151] rounded-md transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5 uppercase tracking-wide">User Email</label>
                <input
                  type="email"
                  autoFocus
                  value={shareEmail}
                  onChange={e => setShareEmail(e.target.value)}
                  placeholder="colleague@university.edu"
                  className="w-full bg-[#111827] border border-[#374151] focus:border-[#3B82F6] text-[#F3F4F6] placeholder:text-[#6B7280] rounded-md px-4 py-2.5 text-sm focus:outline-none transition-colors"
                />
              </div>
              <button
                onClick={handleShare}
                disabled={!shareEmail.trim() || isSharing}
                className="w-full flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors"
              >
                {isSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Invite'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowSettingsModal(false); }}
        >
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-[#F3F4F6] flex items-center gap-2"><Settings className="h-5 w-5 text-[#3B82F6]" /> Workspace Settings</h2>
              <button onClick={() => setShowSettingsModal(false)} className="p-1.5 text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#374151] rounded-md transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5 uppercase tracking-wide">Default Language</label>
                <select
                  value={notebookLanguage}
                  onChange={e => setNotebookLanguage(e.target.value)}
                  className="w-full bg-[#111827] border border-[#374151] focus:border-[#3B82F6] text-[#F3F4F6] rounded-md px-4 py-2.5 text-sm focus:outline-none transition-colors appearance-none"
                >
                  <option value="English">English</option>
                  <option value="Spanish">Spanish</option>
                  <option value="French">French</option>
                  <option value="German">German</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Bengali">Bengali</option>
                  <option value="Telugu">Telugu</option>
                  <option value="Chinese">Chinese</option>
                  <option value="Japanese">Japanese</option>
                </select>
              </div>
              <button
                onClick={handleUpdateLanguage}
                disabled={isUpdatingLanguage}
                className="w-full flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors"
              >
                {isUpdatingLanguage ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </CitationProvider>
  );
}
