import { useState, useEffect, useRef } from 'react';
import {
  Search, Grid3x3, List, Settings, User, Plus, BookOpen,
  MoreVertical, Clock, Loader2, X, ChevronRight, LogOut
} from 'lucide-react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';

export interface Notebook {
  id: string;
  title: string;
  description?: string;
  color?: string;
  created_at: string;
}

interface NotebookDashboardProps {
  onSelectNotebook: (notebookId: string) => void;
}

const GRADIENTS = [
  'from-purple-600 to-blue-500',
  'from-blue-600 to-cyan-500',
  'from-orange-500 to-red-500',
  'from-emerald-500 to-teal-600',
  'from-pink-500 to-rose-600',
];

const EMOJIS = ['📊', '🧠', '🌐', '💾', '🔬', '📈', '🧬', '⚡', '🎯', '📚'];

export function NotebookDashboard({ onSelectNotebook }: NotebookDashboardProps) {
  const { logout } = useAuth();
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newLanguage, setNewLanguage] = useState('Auto-detect');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchNotebooks();
  }, []);

  useEffect(() => {
    if (showCreateModal) {
      setTimeout(() => titleInputRef.current?.focus(), 50);
    }
  }, [showCreateModal]);

  const fetchNotebooks = async () => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.get('/api/notebooks');
      setNotebooks(data.notebooks || []);
    } catch (e) {
      console.error('Failed to fetch notebooks', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim() || isCreating) return;
    setIsCreating(true);
    try {
      const { data } = await apiClient.post('/api/notebooks', {
        title: newTitle.trim(),
        description: newDesc.trim(),
        color: '#3B82F6',
        language: newLanguage,
      });
      if (data.notebook) {
        setNotebooks(prev => [data.notebook, ...prev]);
        setShowCreateModal(false);
        setNewTitle('');
        setNewDesc('');
        setNewLanguage('Auto-detect');
        onSelectNotebook(data.notebook.id);
      }
    } catch (e) {
      console.error('Failed to create notebook', e);
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) handleCreate();
    if (e.key === 'Escape') setShowCreateModal(false);
  };

  const filteredNotebooks = notebooks.filter(nb =>
    nb.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const featuredNotebooks = filteredNotebooks.slice(0, 3);
  const recentNotebooks = filteredNotebooks.slice(3);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
      });
    } catch { return dateStr; }
  };

  return (
    <div className="min-h-screen bg-[#111827] text-[#F3F4F6]" style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}>

      {/* Header */}
      <header className="border-b border-[#374151] bg-[#1F2937] sticky top-0 z-30">
        <div className="px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-[#3B82F6]" />
            <h1 className="text-xl font-semibold text-[#F3F4F6]">ResearchLM</h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={logout}
              className="p-2 text-[#9CA3AF] hover:text-red-400 hover:bg-[#374151] rounded-md transition-colors"
              title="Log Out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tabs and Controls */}
        <div className="px-8 pb-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex gap-1">
            {(['all', 'my'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 text-sm rounded-md transition-colors font-medium ${
                  activeTab === tab
                    ? 'bg-[#374151] text-[#F3F4F6]'
                    : 'text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#374151]/50'
                }`}
              >
                {tab === 'all' ? 'All' : 'My Notebooks'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280]" />
              <input
                placeholder="Search notebooks..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-64 pl-9 pr-4 py-1.5 bg-[#111827] border border-[#374151] text-[#F3F4F6] placeholder:text-[#6B7280] focus:border-[#3B82F6] focus:outline-none rounded-md text-sm transition-colors"
              />
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-[#374151] text-[#F3F4F6]' : 'text-[#9CA3AF] hover:bg-[#374151]/50'}`}
              >
                <Grid3x3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-[#374151] text-[#F3F4F6]' : 'text-[#9CA3AF] hover:bg-[#374151]/50'}`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium px-4 py-1.5 rounded-md transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Notebook
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-8 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="h-8 w-8 text-[#3B82F6] animate-spin" />
          </div>
        ) : viewMode === 'grid' ? (
          <>
            {/* Featured Section */}
            {featuredNotebooks.length > 0 && (
              <section className="mb-10">
                <h2 className="text-xl font-semibold text-[#F3F4F6] mb-5">Featured Notebooks</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {featuredNotebooks.map((nb, i) => (
                    <button
                      key={nb.id}
                      onClick={() => onSelectNotebook(nb.id)}
                      className={`relative h-48 rounded-lg overflow-hidden bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]} cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-xl text-left w-full group`}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-5">
                        <h3 className="text-base font-semibold text-white mb-1 line-clamp-2">{nb.title}</h3>
                        <p className="text-sm text-gray-300">
                          {formatDate(nb.created_at)}
                        </p>
                      </div>
                      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ChevronRight className="h-5 w-5 text-white" />
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Recent Notebooks Section */}
            <section>
              <h2 className="text-xl font-semibold text-[#F3F4F6] mb-5">
                {featuredNotebooks.length > 0 ? 'Recent Notebooks' : 'Your Notebooks'}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                {/* Create New Card */}
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="aspect-square rounded-lg border border-dashed border-[#374151] bg-[#1F2937] hover:bg-[#272E3E] hover:border-[#3B82F6] transition-all duration-200 flex flex-col items-center justify-center cursor-pointer group"
                >
                  <div className="w-12 h-12 rounded-full bg-[#374151] flex items-center justify-center mb-3 group-hover:bg-[#3B82F6] transition-colors">
                    <Plus className="h-6 w-6 text-[#9CA3AF] group-hover:text-white" />
                  </div>
                  <p className="text-sm font-medium text-[#9CA3AF] group-hover:text-[#F3F4F6]">Create New</p>
                </button>

                {/* Notebook Cards */}
                {(featuredNotebooks.length > 0 ? recentNotebooks : filteredNotebooks).map((nb, i) => (
                  <button
                    key={nb.id}
                    onClick={() => onSelectNotebook(nb.id)}
                    className="aspect-square rounded-lg border border-[#374151] bg-[#1F2937] hover:bg-[#272E3E] hover:border-[#3B82F6] transition-all duration-200 cursor-pointer p-5 flex flex-col text-left group"
                  >
                    <div className="text-3xl mb-3">{EMOJIS[i % EMOJIS.length]}</div>
                    <div className="flex-1" />
                    <div>
                      <h3 className="text-sm font-semibold text-[#F3F4F6] mb-1 line-clamp-2 group-hover:text-white">
                        {nb.title}
                      </h3>
                      <p className="text-xs text-[#6B7280]">{formatDate(nb.created_at)}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Empty State */}
              {filteredNotebooks.length === 0 && !isLoading && (
                <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-[#374151] rounded-xl">
                  <BookOpen className="h-12 w-12 text-[#374151] mb-4" />
                  <h3 className="text-lg font-semibold text-[#9CA3AF] mb-2">
                    {searchQuery ? 'No notebooks found' : 'No notebooks yet'}
                  </h3>
                  <p className="text-sm text-[#6B7280] text-center max-w-xs mb-6">
                    {searchQuery
                      ? `No notebooks match "${searchQuery}"`
                      : 'Create your first notebook to start organizing research papers.'}
                  </p>
                  {!searchQuery && (
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="flex items-center gap-2 bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium px-5 py-2 rounded-md transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      Create First Notebook
                    </button>
                  )}
                </div>
              )}
            </section>
          </>
        ) : (
          /* List View */
          <div className="space-y-4">
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full bg-[#1F2937] border border-dashed border-[#374151] rounded-lg p-5 hover:bg-[#272E3E] hover:border-[#3B82F6] transition-all duration-200 cursor-pointer text-left"
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-lg bg-[#374151] flex items-center justify-center flex-shrink-0">
                  <Plus className="h-5 w-5 text-[#3B82F6]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#F3F4F6]">Create New Notebook</h3>
                  <p className="text-xs text-[#9CA3AF]">Start a new research notebook</p>
                </div>
              </div>
            </button>

            {filteredNotebooks.length > 0 && (
              <div className="bg-[#1F2937] border border-[#374151] rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-[#374151] bg-[#111827]">
                  <div className="col-span-5 text-xs font-medium text-[#9CA3AF] uppercase tracking-wide">Name</div>
                  <div className="col-span-3 text-xs font-medium text-[#9CA3AF] uppercase tracking-wide">Description</div>
                  <div className="col-span-3 text-xs font-medium text-[#9CA3AF] uppercase tracking-wide flex items-center gap-1"><Clock className="h-3 w-3" /> Created</div>
                  <div className="col-span-1" />
                </div>
                {filteredNotebooks.map((nb, i) => (
                  <button
                    key={nb.id}
                    onClick={() => onSelectNotebook(nb.id)}
                    className="w-full grid grid-cols-12 gap-4 px-6 py-4 border-b border-[#374151] last:border-b-0 hover:bg-[#272E3E] transition-colors group text-left"
                  >
                    <div className="col-span-5 flex items-center gap-3">
                      <div className="text-xl flex-shrink-0">{EMOJIS[i % EMOJIS.length]}</div>
                      <h3 className="text-sm font-medium text-[#F3F4F6] truncate">{nb.title}</h3>
                    </div>
                    <div className="col-span-3 flex items-center">
                      <span className="text-sm text-[#9CA3AF] truncate">{nb.description || '—'}</span>
                    </div>
                    <div className="col-span-3 flex items-center">
                      <span className="text-sm text-[#9CA3AF]">{formatDate(nb.created_at)}</span>
                    </div>
                    <div className="col-span-1 flex items-center justify-end">
                      <MoreVertical className="h-4 w-4 text-[#6B7280] opacity-0 group-hover:opacity-100" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Create Notebook Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowCreateModal(false); }}
        >
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-[#F3F4F6]">Create New Notebook</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#374151] rounded-md transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5 uppercase tracking-wide">Title *</label>
                <input
                  ref={titleInputRef}
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g. Cancer Research Papers"
                  className="w-full bg-[#111827] border border-[#374151] focus:border-[#3B82F6] text-[#F3F4F6] placeholder:text-[#6B7280] rounded-md px-4 py-2.5 text-sm focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5 uppercase tracking-wide">Description</label>
                <textarea
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="A brief description of this notebook's topic..."
                  rows={3}
                  className="w-full bg-[#111827] border border-[#374151] focus:border-[#3B82F6] text-[#F3F4F6] placeholder:text-[#6B7280] rounded-md px-4 py-2.5 text-sm focus:outline-none transition-colors resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5 uppercase tracking-wide">Language</label>
                <select
                  value={newLanguage}
                  onChange={e => setNewLanguage(e.target.value)}
                  className="w-full bg-[#111827] border border-[#374151] focus:border-[#3B82F6] text-[#F3F4F6] rounded-md px-4 py-2.5 text-sm focus:outline-none transition-colors appearance-none"
                >
                  <option value="Auto-detect">Auto-detect from sources</option>
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
              <div className="flex justify-end gap-3 pt-1">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#374151] rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newTitle.trim() || isCreating}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors"
                >
                  {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {isCreating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
