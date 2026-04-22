import { useState } from 'react';
import {
  Mic, Brain, HelpCircle, FileBarChart, Image as ImageIcon,
  Table, ExternalLink, Loader2, CheckCircle2, AlertCircle,
  ChevronRight
} from 'lucide-react';
import apiClient from '../api/client';

interface StudioProps {
  notebookId: string;
  documentId?: string;
  onImageClick?: (page: number) => void;
}

type CardStatus = 'ready' | 'processing' | 'completed' | 'error';

interface ActionCard {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  subtitle?: string;
  status: CardStatus;
  progress?: number;
  endpoint?: string;
}

const ACTION_CARDS: ActionCard[] = [
  {
    id: 'audio',
    icon: Mic,
    title: 'Audio Overview',
    description: 'Create an audio summary of this research',
    subtitle: 'English, हिंदी, বাংলা, తెలుగు...',
    status: 'ready',
    endpoint: '/api/generate/audio',
  },
  {
    id: 'mindmap',
    icon: Brain,
    title: 'Mind Map',
    description: 'Visualize research connections & concepts',
    subtitle: 'Hierarchy auto-generated',
    status: 'ready',
    endpoint: '/api/generate/mindmap',
  },
  {
    id: 'quiz',
    icon: HelpCircle,
    title: 'Quiz',
    description: 'Test knowledge on this research paper',
    subtitle: '6 questions • ~5 min',
    status: 'ready',
  },
  {
    id: 'reports',
    icon: FileBarChart,
    title: 'Reports',
    description: 'Detailed analysis & metrics',
    subtitle: 'Export as PDF or JSON',
    status: 'ready',
  },
  {
    id: 'infographic',
    icon: ImageIcon,
    title: 'Infographic',
    description: 'Visual summary of insights',
    subtitle: 'Shareable & interactive',
    status: 'ready',
  },
  {
    id: 'datatable',
    icon: Table,
    title: 'Data Table',
    description: 'Structured data extraction',
    subtitle: 'Export (CSV, JSON, etc.)',
    status: 'ready',
  },
];

export function IntelHub({ notebookId, documentId, onImageClick }: StudioProps) {
  const [cardStates, setCardStates] = useState<Record<string, CardStatus>>({});
  const [cardProgress, setCardProgress] = useState<Record<string, number>>({});
  const [taskIds, setTaskIds] = useState<Record<string, string>>({});

  const getStatus = (cardId: string): CardStatus =>
    cardStates[cardId] || 'ready';

  const handleCardClick = async (card: ActionCard) => {
    const status = getStatus(card.id);
    if (status === 'processing') return;
    if (status === 'completed') return;

    if (!card.endpoint) {
      alert(`${card.title} — Coming in Phase 3!`);
      return;
    }

    setCardStates(prev => ({ ...prev, [card.id]: 'processing' }));
    setCardProgress(prev => ({ ...prev, [card.id]: 0 }));

    // Simulate progress while polling
    let prog = 0;
    const progInterval = setInterval(() => {
      prog = Math.min(prog + 5, 90);
      setCardProgress(prev => ({ ...prev, [card.id]: prog }));
    }, 500);

    try {
      const payload: any = { notebook_id: notebookId };
      if (documentId) payload.document_id = documentId;

      const { data } = await apiClient.post(card.endpoint, payload);

      clearInterval(progInterval);

      if (data.task_id) {
        setTaskIds(prev => ({ ...prev, [card.id]: data.task_id }));
        pollTaskStatus(card.id, data.task_id);
      } else {
        setCardProgress(prev => ({ ...prev, [card.id]: 100 }));
        setCardStates(prev => ({ ...prev, [card.id]: 'completed' }));
      }
    } catch (err) {
      clearInterval(progInterval);
      setCardStates(prev => ({ ...prev, [card.id]: 'error' }));
      console.error(`${card.title} generation failed:`, err);
    }
  };

  const pollTaskStatus = async (cardId: string, taskId: string) => {
    const check = async () => {
      try {
        const { data } = await apiClient.get(`/api/tasks/${taskId}`);
        if (data.status === 'SUCCESS' || data.status === 'completed') {
          setCardProgress(prev => ({ ...prev, [cardId]: 100 }));
          setCardStates(prev => ({ ...prev, [cardId]: 'completed' }));
        } else if (data.status === 'FAILURE' || data.status === 'error') {
          setCardStates(prev => ({ ...prev, [cardId]: 'error' }));
        } else {
          // Still processing
          setTimeout(check, 2000);
        }
      } catch {
        setCardStates(prev => ({ ...prev, [cardId]: 'error' }));
      }
    };
    setTimeout(check, 2000);
  };

  const resetCard = (cardId: string) => {
    setCardStates(prev => ({ ...prev, [cardId]: 'ready' }));
    setCardProgress(prev => ({ ...prev, [cardId]: 0 }));
  };

  return (
    <div className="h-full bg-[#1F2937] border-l border-[#374151] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3.5 border-b border-[#374151] flex items-center justify-between">
        <h2 className="font-semibold text-[#F3F4F6] text-sm">Studio</h2>
        <button className="p-1.5 text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#374151] rounded-md transition-colors">
          <ExternalLink className="h-4 w-4" />
        </button>
      </div>

      {/* Action Cards */}
      <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-3">
        {ACTION_CARDS.map(card => {
          const status = getStatus(card.id);
          const progress = cardProgress[card.id] || 0;
          const Icon = card.icon;

          return (
            <div
              key={card.id}
              onClick={() => handleCardClick(card)}
              className={`
                bg-[#272E3E] border rounded-lg p-4 cursor-pointer transition-all duration-200 group
                ${status === 'processing'
                  ? 'border-[#3B82F6]/60 opacity-80 cursor-default'
                  : status === 'completed'
                  ? 'border-[#10B981]/60 cursor-default'
                  : status === 'error'
                  ? 'border-[#EF4444]/60'
                  : 'border-[#374151] hover:bg-[#2D3E4F] hover:border-[#3B82F6] hover:shadow-lg hover:shadow-[#3B82F6]/10'
                }
              `}
            >
              <div className="flex flex-col items-center text-center">
                {/* Icon */}
                <div className={`
                  w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-transform group-hover:scale-110
                  ${status === 'completed' ? 'bg-[#10B981]/20' : status === 'error' ? 'bg-[#EF4444]/20' : 'bg-[#374151]'}
                `}>
                  {status === 'completed' ? (
                    <CheckCircle2 className="h-5 w-5 text-[#10B981]" />
                  ) : status === 'error' ? (
                    <AlertCircle className="h-5 w-5 text-[#EF4444]" />
                  ) : status === 'processing' ? (
                    <Loader2 className="h-5 w-5 text-[#3B82F6] animate-spin" />
                  ) : (
                    <Icon className="h-5 w-5 text-[#3B82F6]" />
                  )}
                </div>

                {/* Title */}
                <h3 className="font-semibold text-[#F3F4F6] text-sm mb-1">{card.title}</h3>

                {/* Description */}
                <p className="text-xs text-[#9CA3AF] mb-2 leading-relaxed">{card.description}</p>

                {/* Subtitle / Language / Format */}
                {card.subtitle && status === 'ready' && (
                  <p className="text-[11px] text-[#6B7280]">{card.subtitle}</p>
                )}

                {/* Processing Progress Bar */}
                {status === 'processing' && (
                  <div className="w-full mt-3">
                    <div className="h-1.5 bg-[#374151] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#3B82F6] rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-[#9CA3AF] mt-1">{progress}% complete</p>
                  </div>
                )}

                {/* Completed State */}
                {status === 'completed' && (
                  <div className="w-full mt-2 flex gap-2">
                    <button
                      onClick={e => { e.stopPropagation(); alert('Download/View coming soon!'); }}
                      className="flex-1 text-[11px] text-[#10B981] border border-[#10B981]/30 hover:bg-[#10B981]/10 rounded-md py-1.5 transition-colors font-medium"
                    >
                      View Result
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); resetCard(card.id); }}
                      className="px-2 text-[11px] text-[#6B7280] hover:text-[#9CA3AF] border border-[#374151] hover:bg-[#374151] rounded-md py-1.5 transition-colors"
                    >
                      Reset
                    </button>
                  </div>
                )}

                {/* Error State */}
                {status === 'error' && (
                  <div className="w-full mt-2">
                    <button
                      onClick={e => { e.stopPropagation(); resetCard(card.id); }}
                      className="w-full text-[11px] text-[#EF4444] border border-[#EF4444]/30 hover:bg-[#EF4444]/10 rounded-md py-1.5 transition-colors font-medium"
                    >
                      Retry
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
