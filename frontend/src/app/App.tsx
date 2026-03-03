import { useState, useEffect } from 'react';
import { UploadView } from './components/UploadView';
import { ChatView } from './components/ChatView';
import { Sidebar, ChatSession } from './components/Sidebar';
import apiClient from './api/client';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  context?: string[];
}

interface ChatSessionWithMessages extends ChatSession {
  messages: Message[];
}

export default function App() {
  const [sessions, setSessions] = useState<ChatSessionWithMessages[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [view, setView] = useState<'upload' | 'chat'>('chat');

  // Load sessions from API on mount
  useEffect(() => {
    apiClient.get('/api/sessions')
      .then((res: any) => setSessions(res.data))
      .catch((e: any) => console.error('Failed to load sessions:', e));
  }, []);

  const handleUploadComplete = async (documentId: string, documentName: string) => {
    const newSession = {
      id: Date.now().toString(),
      documentId,
      documentName,
      timestamp: Date.now(),
      messageCount: 0,
      messages: [],
    };

    try {
      await apiClient.post('/api/sessions', newSession);
      setSessions((prev) => [newSession, ...prev]);
      setCurrentSessionId(newSession.id);
      setView('chat');
    } catch (e) {
      console.error('Failed to create session:', e);
    }
  };

  const handleNewChat = () => {
    setCurrentSessionId(null);
    setView('upload');
  };

  const handleSelectSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setView('chat');
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await apiClient.delete(`/api/sessions/${sessionId}`);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        setView('upload');
      }
    } catch (e) {
      console.error('Failed to delete session:', e);
    }
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
  const showSidebar = sessions.length > 0 || view === 'chat';

  return (
    <div className="size-full flex">
      {showSidebar && (
        <Sidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
          onDeleteSession={handleDeleteSession}
        />
      )}
      <div className="flex-1 min-w-0">
        {view === 'upload' ? (
          <UploadView onUploadComplete={handleUploadComplete} />
        ) : currentSession ? (
          <ChatView
            documentId={currentSession.documentId}
            sessionId={currentSession.id}
            initialMessages={currentSession.messages || []}
            onMessagesUpdate={handleUpdateMessages}
            onNewChat={handleNewChat}
          />
        ) : null}
      </div>
    </div>
  );
}