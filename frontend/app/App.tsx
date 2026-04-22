import { useState, useEffect } from 'react';
import { Workspace } from './components/Workspace';
import { NotebookDashboard } from './components/NotebookDashboard';
import apiClient from './api/client';

export interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  context?: string[];
  relevant_images?: any[];
}

interface Session {
  id: string;
  documentId: string;
  documentName: string;
  timestamp: number;
  messageCount: number;
  messages: Message[];
}

export default function App() {
  const STORAGE_KEY = 'rps-sessions-v2';

  const [sessions, setSessions] = useState<Session[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentNotebookId, setCurrentNotebookId] = useState<string | null>(null);
  const [currentNotebookTitle, setCurrentNotebookTitle] = useState<string>('');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  // When a notebook is selected, create/reuse a session for it  
  const handleSelectNotebook = async (notebookId: string) => {
    setCurrentNotebookId(notebookId);

    // Try fetching the notebook title
    try {
      const { data } = await apiClient.get(`/api/notebooks/${notebookId}`);
      setCurrentNotebookTitle(data.notebook?.title || 'Research Notebook');
    } catch {
      setCurrentNotebookTitle('Research Notebook');
    }

    // Reuse existing session for this notebook or create new
    const existing = sessions.find(s => s.documentId === `notebook:${notebookId}`);
    if (existing) {
      setCurrentSessionId(existing.id);
    } else {
      const newSession: Session = {
        id: `session_${notebookId}_${Date.now()}`,
        documentId: `notebook:${notebookId}`,
        documentName: 'Notebook Session',
        timestamp: Date.now(),
        messageCount: 0,
        messages: [],
      };
      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(newSession.id);

      // Register on backend
      fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSession),
      }).catch(() => {});
    }
  };

  const handleUpdateMessages = (sessionId: string, messages: Message[]) => {
    setSessions(prev =>
      prev.map(s =>
        s.id === sessionId
          ? { ...s, messages, messageCount: messages.filter(m => m.type === 'user').length }
          : s
      )
    );
  };

  const handleBackToDashboard = () => {
    setCurrentNotebookId(null);
    setCurrentSessionId(null);
    setCurrentNotebookTitle('');
  };

  const handleNewChat = () => {
    if (!currentNotebookId) return;
    const newSession: Session = {
      id: `session_${currentNotebookId}_${Date.now()}`,
      documentId: `notebook:${currentNotebookId}`,
      documentName: currentNotebookTitle,
      timestamp: Date.now(),
      messageCount: 0,
      messages: [],
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
  };

  const currentSession = sessions.find(s => s.id === currentSessionId);

  if (currentNotebookId && currentSessionId) {
    return (
      <Workspace
        key={currentSessionId}
        notebookId={currentNotebookId}
        notebookTitle={currentNotebookTitle}
        sessionId={currentSessionId}
        initialMessages={currentSession?.messages || []}
        onMessagesUpdate={handleUpdateMessages}
        onNewChat={handleNewChat}
        onBackToDashboard={handleBackToDashboard}
      />
    );
  }

  return (
    <NotebookDashboard onSelectNotebook={handleSelectNotebook} />
  );
}