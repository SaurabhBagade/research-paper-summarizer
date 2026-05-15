import { useState, useEffect } from 'react';
import { Workspace } from './components/Workspace';
import { NotebookDashboard } from './components/NotebookDashboard';
import apiClient from './api/client';

import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate } from 'react-router';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthPage } from './pages/AuthPage';

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

function MainApp() {
  const STORAGE_KEY = 'rps-sessions-v2';
  const { id } = useParams();
  const navigate = useNavigate();

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

  useEffect(() => {
    if (id && id !== currentNotebookId) {
      loadNotebook(id);
    } else if (!id && currentNotebookId) {
      setCurrentNotebookId(null);
      setCurrentSessionId(null);
      setCurrentNotebookTitle('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, currentNotebookId]);

  const loadNotebook = async (notebookId: string) => {
    setCurrentNotebookId(notebookId);

    try {
      const { data } = await apiClient.get(`/api/notebooks/${notebookId}`);
      setCurrentNotebookTitle(data.notebook?.title || 'Research Canvas');
    } catch {
      setCurrentNotebookTitle('Research Canvas');
    }

    const existing = sessions.find(s => s.documentId === `notebook:${notebookId}`);
    if (existing) {
      setCurrentSessionId(existing.id);
    } else {
      const newSession: Session = {
        id: `session_${notebookId}_${Date.now()}`,
        documentId: `notebook:${notebookId}`,
        documentName: 'Canvas Session',
        timestamp: Date.now(),
        messageCount: 0,
        messages: [],
      };
      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(newSession.id);

      apiClient.post('/api/sessions', newSession).catch(() => {});
    }
  };

  const handleSelectNotebook = (notebookId: string) => {
    navigate(`/canvas/${notebookId}`);
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
    navigate('/canvas');
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

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/canvas" element={<MainApp />} />
            <Route path="/canvas/:id" element={<MainApp />} />
          </Route>
          <Route path="*" element={<Navigate to="/canvas" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}