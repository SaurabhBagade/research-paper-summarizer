import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { PDFViewer } from './PDFViewer';
import { ChatView } from './ChatView';
import { IntelHub } from './IntelHub';
import { useState } from 'react';
import { Message } from '../App';

interface WorkspaceProps {
  documentId: string;
  sessionId: string;
  initialMessages: Message[];
  onMessagesUpdate: (sessionId: string, messages: Message[]) => void;
  onNewChat: () => void;
}

export function Workspace({
  documentId,
  sessionId,
  initialMessages,
  onMessagesUpdate,
  onNewChat,
}: WorkspaceProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [highlights, setHighlights] = useState<any[]>([]);

  const handleMessagesUpdate = (sid: string, msgs: Message[]) => {
    onMessagesUpdate(sid, msgs);
    
    // Check if the last message is from assistant and has highlights
    const lastMsg = msgs[msgs.length - 1];
    if (lastMsg && lastMsg.type === 'assistant' && (lastMsg as any).context_highlights) {
      setHighlights((lastMsg as any).context_highlights);
      if ((lastMsg as any).context_pages?.length > 0) {
        setCurrentPage((lastMsg as any).context_pages[0]);
      }
    }
  };

  return (
    <div className="h-full w-full bg-slate-50 overflow-hidden">
      <PanelGroup direction="horizontal">
        {/* Left: Source Document */}
        <Panel defaultSize={40} minSize={20}>
          <PDFViewer 
            documentId={documentId} 
            currentPage={currentPage} 
            highlights={highlights}
          />
        </Panel>

        <PanelResizeHandle className="w-1.5 bg-slate-200 hover:bg-indigo-300 transition-colors cursor-col-resize flex items-center justify-center">
            <div className="h-8 w-0.5 bg-slate-400 rounded-full" />
        </PanelResizeHandle>

        {/* Center: The Analyst (Chat) */}
        <Panel defaultSize={40} minSize={30}>
          <ChatView
            documentId={documentId}
            sessionId={sessionId}
            initialMessages={initialMessages}
            onMessagesUpdate={handleMessagesUpdate}
            onNewChat={onNewChat}
            onPageJump={setCurrentPage}
          />
        </Panel>

        <PanelResizeHandle className="w-1.5 bg-slate-200 hover:bg-indigo-300 transition-colors cursor-col-resize flex items-center justify-center">
            <div className="h-8 w-0.5 bg-slate-400 rounded-full" />
        </PanelResizeHandle>

        {/* Right: Intel Hub (Metadata & Figures) */}
        <Panel defaultSize={20} minSize={15} collapsible>
          <IntelHub 
            documentId={documentId} 
            onImageClick={(page) => setCurrentPage(page)}
          />
        </Panel>
      </PanelGroup>
    </div>
  );
}
