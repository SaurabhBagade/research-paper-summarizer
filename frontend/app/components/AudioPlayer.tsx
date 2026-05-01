import React, { useState, useRef, useEffect } from 'react';
import { Mic, Loader2, CheckCircle2, AlertCircle, Play, Pause, Download } from 'lucide-react';
import apiClient from '../api/client';

interface AudioPlayerProps {
  notebookId: string;
  documentId?: string;
  isProcessingPDF?: boolean;
  notebookLanguage?: string;
}

type TaskStatus = 'ready' | 'processing' | 'completed' | 'error';

export function AudioPlayer({ notebookId, documentId, isProcessingPDF, notebookLanguage }: AudioPlayerProps) {
  const [status, setStatus] = useState<TaskStatus>('ready');
  const [progress, setProgress] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [targetLanguage, setTargetLanguage] = useState(notebookLanguage || 'English');

  useEffect(() => {
    if (notebookLanguage) {
      setTargetLanguage(notebookLanguage);
    }
  }, [notebookLanguage]);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const progIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check if audio summary already exists when component mounts
  useEffect(() => {
    const checkExisting = async () => {
      try {
        const { data } = await apiClient.get(`/api/notebooks/${notebookId}`);
        if (data.notebook?.audio_generated) {
          setAudioUrl(`/api/notebooks/${notebookId}/audio`);
          setStatus('completed');
          setProgress(100);
        }
      } catch (err) {
        console.error('Failed to check existing audio', err);
      }
    };
    checkExisting();
  }, [notebookId]);

  const stopProgress = () => {
    if (progIntervalRef.current !== null) {
      clearInterval(progIntervalRef.current);
      progIntervalRef.current = null;
    }
  };

  const handleGenerate = async () => {
    if (isProcessingPDF) {
      alert("Please wait until the PDF has finished processing its text.");
      return;
    }
    
    setStatus('processing');
    setProgress(0);
    stopProgress();
    
    let prog = 0;
    progIntervalRef.current = setInterval(() => {
      prog = Math.min(prog + 3, 88);
      setProgress(prog);
    }, 600);

    try {
      const payload: any = { notebook_id: notebookId };
      if (documentId) payload.document_id = documentId;
      payload.target_language = targetLanguage;

      const { data } = await apiClient.post(`/api/notebooks/${notebookId}/audio-summary`, payload);

      if (data.task_id) {
        pollTaskStatus(data.task_id);
      } else {
        stopProgress();
        setProgress(100);
        setStatus('completed');
      }
    } catch (err) {
      stopProgress();
      setStatus('error');
      console.error('Audio generation failed:', err);
    }
  };

  const pollTaskStatus = (taskId: string) => {
    const check = async () => {
      try {
        const { data } = await apiClient.get(`/api/tasks/${taskId}`);
        const taskStatus = data.task_status;

        if (taskStatus === 'SUCCESS') {
          stopProgress();
          // Instead of absolute local path, use relative API URL
          setAudioUrl(`/api/notebooks/${notebookId}/audio`);
          setProgress(100);
          setStatus('completed');
        } else if (taskStatus === 'FAILURE') {
          stopProgress();
          setStatus('error');
        } else {
          setTimeout(check, 2000);
        }
      } catch {
        stopProgress();
        setStatus('error');
      }
    };
    setTimeout(check, 2000);
  };

  const reset = () => {
    stopProgress();
    setStatus('ready');
    setProgress(0);
    setAudioUrl(null);
  };

  // Modern Audio Controls
  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (audioRef.current && duration) {
      const rect = e.currentTarget.getBoundingClientRect();
      const seekTime = ((e.clientX - rect.left) / rect.width) * duration;
      audioRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
    }
  };

  const formatTime = (time: number) => {
    const m = Math.floor(time / 60).toString().padStart(2, '0');
    const s = Math.floor(time % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="text-center mb-8 mt-6">
        <div className={`mx-auto w-20 h-20 rounded-2xl flex items-center justify-center mb-6 transition-transform shadow-lg ${
          status === 'completed' ? 'bg-[#10B981]/20 shadow-[#10B981]/10' :
          status === 'error' ? 'bg-[#EF4444]/20 shadow-[#EF4444]/10' :
          'bg-[#272E3E] shadow-black/20 border border-[#374151]'
        }`}>
          {status === 'completed' ? <CheckCircle2 className="h-10 w-10 text-[#10B981]" /> :
           status === 'error' ? <AlertCircle className="h-10 w-10 text-[#EF4444]" /> :
           status === 'processing' ? <Loader2 className="h-10 w-10 text-[#3B82F6] animate-spin" /> :
           <Mic className="h-10 w-10 text-[#3B82F6]" />}
        </div>
        <h3 className="font-bold text-[#F3F4F6] text-xl mb-3">Audio Overview</h3>
        <p className="text-sm text-[#9CA3AF] max-w-[200px] mx-auto leading-relaxed">
          Create an audio summary of this research
        </p>
        {status === 'ready' && (
          <p className="text-xs text-[#6B7280] mt-4 uppercase tracking-wider font-medium">
            English, हिंदी, বাংলা, తెలుగు...
          </p>
        )}
      </div>

      <div className="mt-auto pt-4">
        {status === 'ready' && (
          <>
            <select
              value={targetLanguage}
              onChange={e => setTargetLanguage(e.target.value)}
              className="w-full mb-3 bg-[#111827] border border-[#374151] focus:border-[#3B82F6] text-[#F3F4F6] rounded-md px-3 py-2 text-sm focus:outline-none transition-colors"
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
            <button onClick={handleGenerate} disabled={isProcessingPDF} className="w-full py-3.5 bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all shadow-lg shadow-[#3B82F6]/20 active:scale-[0.98]">
              Generate Audio Overview
            </button>
          </>
        )}

        {status === 'processing' && (
          <div className="w-full bg-[#272E3E] p-5 rounded-xl border border-[#374151] shadow-inner">
            <div className="flex justify-between text-sm mb-3"><span className="text-[#9CA3AF] font-medium">Processing...</span><span className="text-[#3B82F6] font-bold">{progress}%</span></div>
            <div className="h-2.5 bg-[#1F2937] rounded-full overflow-hidden border border-[#374151]"><div className="h-full bg-[#3B82F6] rounded-full transition-all duration-500 relative overflow-hidden" style={{ width: `${progress}%` }}><div className="absolute inset-0 bg-white/20 animate-pulse" /></div></div>
          </div>
        )}

        {status === 'completed' && (
          <div className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {audioUrl && (
              <div className="bg-[#272E3E] p-5 rounded-xl border border-[#374151] shadow-xl">
                {/* Hidden Audio Element */}
                <audio 
                  ref={audioRef}
                  src={`${audioUrl}?token=${localStorage.getItem('token') || localStorage.getItem('auth_token')}`} 
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={() => setIsPlaying(false)}
                  className="hidden" 
                />
                
                {/* Custom Playback Controls */}
                <div className="flex items-center gap-4 mb-5">
                  <button 
                    onClick={togglePlay}
                    className="w-12 h-12 flex items-center justify-center bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-full shadow-lg shadow-blue-900/20 transition-transform active:scale-95 flex-shrink-0"
                  >
                    {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-1" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-[#F3F4F6] truncate">Research Canvas Podcast</h4>
                    <p className="text-xs text-[#9CA3AF] truncate">AI generated audio summary</p>
                  </div>
                  <div className="text-xs font-medium text-[#9CA3AF] font-mono whitespace-nowrap">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full h-2.5 bg-[#111827] rounded-full overflow-hidden cursor-pointer group relative mb-6 border border-[#374151]" onClick={handleSeek}>
                  <div className="h-full bg-[#3B82F6] group-hover:bg-[#60A5FA] transition-colors relative" style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}>
                     <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>

                <div className="flex justify-between items-center gap-3">
                  <button onClick={() => window.open(`${audioUrl}?token=${localStorage.getItem('token') || localStorage.getItem('auth_token')}`, '_blank')} className="px-4 py-2.5 text-xs text-[#10B981] bg-[#10B981]/10 hover:bg-[#10B981]/20 border border-[#10B981]/20 rounded-lg transition-colors font-medium flex items-center justify-center gap-1.5 flex-1">
                    <Download className="h-3.5 w-3.5" /> Download MP3
                  </button>
                  <button onClick={reset} className="px-5 py-2.5 text-xs text-[#9CA3AF] hover:text-[#F3F4F6] bg-[#374151] hover:bg-[#4B5563] rounded-lg transition-colors font-medium">Start Over</button>
                </div>
              </div>
            )}
          </div>
        )}

        {status === 'error' && (
          <div className="w-full bg-[#EF4444]/10 border border-[#EF4444]/30 p-5 rounded-xl text-center">
            <p className="text-sm text-[#EF4444] mb-5 font-medium">Failed to generate Audio Overview. Please try again.</p>
            <div className="flex gap-3">
              <button onClick={handleGenerate} className="flex-1 py-2.5 text-sm text-white bg-[#EF4444] hover:bg-[#DC2626] rounded-lg transition-colors font-medium shadow-md shadow-[#EF4444]/20">Retry</button>
              <button onClick={reset} className="px-5 py-2.5 text-sm text-[#9CA3AF] hover:text-[#F3F4F6] bg-[#374151] hover:bg-[#4B5563] rounded-lg transition-colors font-medium">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
