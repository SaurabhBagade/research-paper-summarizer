import { FileText, Plus, MessageSquare, Trash2, Menu, X, Search, Hash, Clock } from 'lucide-react';
import { useState } from 'react';

export interface ChatSession {
  id: string;
  documentId: string;
  documentName: string;
  timestamp: number;
  messageCount: number;
}

interface SidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  onDeleteSession: (sessionId: string) => void;
}

export function Sidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
}: SidebarProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Recent';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return 'This Week';
    return 'Older';
  };

  const filteredSessions = sessions.filter(s => 
    s.documentName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedSessions = filteredSessions.reduce((acc, session) => {
    const label = formatDate(session.timestamp);
    if (!acc[label]) acc[label] = [];
    acc[label].push(session);
    return acc;
  }, {} as Record<string, ChatSession[]>);

  const sidebarContent = (
    <div className="h-full flex flex-col bg-slate-900 text-slate-100 border-r border-slate-800 shadow-2xl">
      {/* Brand */}
      <div className="p-6">
        <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg rotate-3 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Hash className="w-5 h-5 text-white" />
            </div>
            <div>
                <h1 className="text-sm font-black tracking-tighter text-white">NEBULA.AI</h1>
                <p className="text-[10px] text-slate-500 font-bold tracking-widest leading-none">V 2.0 PROTOCOL</p>
            </div>
        </div>

        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-3 bg-white text-slate-900 rounded-xl hover:bg-indigo-50 transition-all shadow-xl hover:shadow-indigo-500/10 group"
        >
          <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
          <span className="text-xs font-black uppercase tracking-wider">New Analysis</span>
        </button>

        <div className="mt-6 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input 
                type="text" 
                placeholder="Search index..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder-slate-600 transition-all font-medium"
            />
        </div>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-6">
        {filteredSessions.length === 0 ? (
          <div className="text-center py-12 px-4 border border-dashed border-slate-800 rounded-2xl bg-slate-800/20">
            <MessageSquare className="w-8 h-8 mx-auto mb-3 text-slate-700" />
            <p className="text-[11px] font-bold text-slate-600 uppercase tracking-widest">No matching results</p>
          </div>
        ) : (
          ['Recent', 'Yesterday', 'This Week', 'Older'].filter(label => groupedSessions[label]?.length > 0).map((label) => (
            <div key={label}>
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 px-2 flex items-center gap-2">
                <Clock className="w-3 h-3" />
                {label}
              </h3>
              <div className="space-y-1.5">
                {groupedSessions[label].map((session) => (
                  <div
                    key={session.id}
                    className={`group relative flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all border ${
                      currentSessionId === session.id
                        ? 'bg-indigo-600/10 border-indigo-500/30 text-white'
                        : 'hover:bg-slate-800/50 border-transparent hover:border-slate-700/50 text-slate-400 hover:text-slate-200'
                    }`}
                    onClick={() => {
                      onSelectSession(session.id);
                      setIsMobileOpen(false);
                    }}
                  >
                    <div className={`p-1.5 rounded-lg ${currentSessionId === session.id ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-500'}`}>
                        <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate tracking-tight">{session.documentName}</p>
                      <p className="text-[10px] text-slate-500 font-medium">
                        {session.messageCount} interactions
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(session.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 rounded-lg transition-all"
                      aria-label="Delete chat"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500/70" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-6 bg-slate-800/30 border-t border-slate-800">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-black text-white">KT</div>
            <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-white truncate">Administrator</p>
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Lead Architect</p>
            </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-slate-900 text-white rounded-lg shadow-lg border border-slate-800"
        aria-label="Toggle menu"
      >
        {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/80 backdrop-blur-sm z-30"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed lg:static inset-y-0 left-0 z-40 w-72 transform transition-transform duration-300 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {sidebarContent}
      </div>
    </>
  );
}
