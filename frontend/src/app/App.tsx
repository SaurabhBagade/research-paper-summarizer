import { useState, useEffect } from 'react';
import { Sidebar, ChatSession } from './components/Sidebar';
import { UploadView } from './components/UploadView';
import { Workspace } from './components/Workspace';
import apiClient from './api/client';

export interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  context?: string[];
  relevant_images?: any[];
}

interface ChatSessionWithMessages extends ChatSession {
  messages: Message[];
}

export default function App() {
  const STORAGE_KEY = 'research-paper-chat-sessions';
  const [sessions, setSessions] = useState<ChatSessionWithMessages[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      return parsed.length > 0 ? parsed[0].id : null;
    } catch { return null; }
  });

  const view = currentSessionId && sessions.find(s => s.id === currentSessionId) ? 'chat' : 'upload';

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  const handleUploadComplete = (documentId: string, documentName: string) => {
    const newSession: ChatSessionWithMessages = {
      id: Date.now().toString(),
      documentId,
      documentName,
      timestamp: Date.now(),
      messageCount: 0,
      messages: [],
    };

    setSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);

    fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSession)
    }).catch(() => { });
  };

  const handleNewChat = () => {
    setCurrentSessionId(null);
  };

  const handleSelectSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
  };

  const handleDeleteSession = (sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (currentSessionId === sessionId) {
      setCurrentSessionId(null);
    }
    fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' }).catch(() => { });
  };

  const handleUpdateMessages = (sessionId: string, messages: Message[]) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? { ...s, messages, messageCount: messages.filter(m => m.type === 'user').length }
          : s
      )
    );
  };

  const currentSession = sessions.find((s) => s.id === currentSessionId);
  const showSidebar = sessions.length > 0;

  return (
    <div className="size-full flex overflow-hidden">
      {showSidebar && (
        <Sidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
          onDeleteSession={handleDeleteSession}
        />
      )}
      <div className="flex-1 min-w-0 h-full">
        {view === 'upload' ? (
          <UploadView onUploadComplete={handleUploadComplete} />
        ) : currentSession ? (
          <Workspace
            key={currentSession.id}
            documentId={currentSession.documentId}
            sessionId={currentSession.id}
            initialMessages={currentSession.messages || []}
            onMessagesUpdate={handleUpdateMessages}
            onNewChat={handleNewChat}
          />
        ) : (
          <UploadView onUploadComplete={handleUploadComplete} />
        )}
      </div>
    </div>
  );
}