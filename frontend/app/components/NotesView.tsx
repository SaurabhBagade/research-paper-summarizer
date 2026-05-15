import React, { useState, useEffect } from 'react';
import { Edit3, Save, Loader2, CheckCircle2 } from 'lucide-react';
import apiClient from '../api/client';

interface NotesViewProps {
  notebookId: string;
}

export function NotesView({ notebookId }: NotesViewProps) {
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');

  useEffect(() => {
    apiClient.get(`/api/notebooks/${notebookId}`)
      .then(res => {
        if (res.data.notebook?.notes) setNotes(res.data.notebook.notes);
      })
      .catch(err => console.error("Failed to fetch notes", err));
  }, [notebookId]);

  const handleSave = () => {
    setIsSaving(true);
    apiClient.patch(`/api/notebooks/${notebookId}`, { notes })
      .then(() => {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      })
      .catch(err => console.error("Failed to save notes", err))
      .finally(() => setIsSaving(false));
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in zoom-in-95 duration-300">
      <div className="text-center mb-6 mt-4 flex-shrink-0">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-[#272E3E] border border-[#374151] flex items-center justify-center mb-4 shadow-lg">
          <Edit3 className="h-8 w-8 text-[#3B82F6]" />
        </div>
        <h3 className="font-bold text-[#F3F4F6] text-lg">Canvas Notes</h3>
        <p className="text-sm text-[#9CA3AF] max-w-[220px] mx-auto mt-2 leading-relaxed">Capture research hypotheses, ideas, and takeaways.</p>
      </div>

      <div className="flex-1 flex flex-col min-h-0 bg-[#111827] rounded-xl border border-[#374151] overflow-hidden relative group shadow-inner">
        <textarea
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            if (saveStatus === 'saved') setSaveStatus('idle');
          }}
          placeholder="Start typing your research notes here..."
          className="w-full h-full bg-transparent text-[#F3F4F6] placeholder:text-[#4B5563] p-5 text-sm focus:outline-none resize-none leading-relaxed"
        />
        <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-50 text-white rounded-lg font-medium transition-colors shadow-lg"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> :
             saveStatus === 'saved' ? <CheckCircle2 className="h-4 w-4 text-green-400" /> :
             <Save className="h-4 w-4" />}
            {isSaving ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save Notes'}
          </button>
        </div>
      </div>
    </div>
  );
}