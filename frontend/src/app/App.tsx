import { useState, useEffect } from 'react';
import { UploadView } from './components/UploadView';
import { ChatView } from './components/ChatView';
import { Sidebar, ChatSession } from './components/Sidebar';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  context?: string[];
}

interface ChatSessionWithMessages extends ChatSession {
  messages: Message[];
}

const STORAGE_KEY = 'research-paper-chat-sessions';

export default function App() {
  const [sessions, setSessions] = useState<ChatSessionWithMessages[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [view, setView] = useState<'upload' | 'chat'>('chat');

  // Load sessions from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsedSessions = JSON.parse(stored);
        setSessions(parsedSessions);
      } catch (e) {
        console.error('Failed to load sessions:', e);
      }
    }
  }, []);

  // Save sessions to localStorage whenever they change
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    }
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
    setView('chat');
  };

  const handleNewChat = () => {
    setCurrentSessionId(null);
    setView('upload');
  };

  const handleSelectSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setView('chat');
  };

  const handleDeleteSession = (sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (currentSessionId === sessionId) {
      setCurrentSessionId(null);
      setView('upload');
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

  // Show sidebar only when we have sessions or in chat view
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
            initialMessages={currentSession.messages}
            onMessagesUpdate={handleUpdateMessages}
            onNewChat={handleNewChat}
          />
        ) : null}
      </div>
    </div>
  );
}