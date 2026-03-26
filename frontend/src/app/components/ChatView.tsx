import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, FileText, Loader2, Image as ImageIcon, Sparkles } from 'lucide-react';
import { TypewriterText } from './TypewriterText';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion';
import apiClient from '../api/client';
import { PDFViewer } from './PDFViewer';

interface RelevantImage {
  filename: string;
  page: number;
  caption: string;
  ai_description?: string;
}

interface RelevantImage {
  filename: string;
  page: number;
  caption: string;
  ai_description?: string;
}

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  context?: string[];
  relevant_images?: RelevantImage[];
  isNew?: boolean;
}

interface ChatViewProps {
  documentId: string;
  sessionId: string;
  initialMessages: Message[];
  onMessagesUpdate: (sessionId: string, messages: Message[]) => void;
  onNewChat: () => void;
  onPageJump?: (page: number) => void;
}

export function ChatView({
  documentId,
  sessionId,
  initialMessages,
  onMessagesUpdate,
  onNewChat,
  onPageJump
}: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeHighlights, setActiveHighlights] = useState([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onMessagesUpdate(sessionId, messages);
  }, [messages, sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: documentId,
          session_id: sessionId,
          query: userMessage.content,
        }),
      });

      if (!response.ok) throw new Error('Failed to get response');

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: data.answer,
        context: data.context_used || [],
        relevant_images: data.relevant_images || [],
        isNew: true,
      } as any;

      // Inject extra data for Workspace
      (assistantMessage as any).context_highlights = data.context_highlights;
      (assistantMessage as any).context_pages = data.context_pages;

      // Update exact highlight rects in the PDF viewer
      if (data.context_highlights?.length) {
        setActiveHighlights(data.context_highlights);
      }

      setMessages((prev) => [...prev, assistantMessage]);

      if (data.context_pages && data.context_pages.length > 0 && onPageJump) {
        onPageJump(data.context_pages[0]);
      }
    } catch (err) {
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Sorry, I encountered an error processing your question. Please try again.',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-white border-x border-slate-200 shadow-inner">
      {/* Header */}
      <div className="backdrop-blur-xl bg-white/80 border-b border-slate-100 flex-shrink-0 z-10">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-indigo-200 shadow-lg">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-sm tracking-tight">AI ANALYST</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Quantum Insights Mode</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              <div className="w-6 h-6 rounded-full border-2 border-white bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600">AI</div>
              <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-700 flex items-center justify-center text-[10px] font-bold text-white">U</div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto min-h-0 bg-slate-50/30">
          <div className="max-w-3xl mx-auto px-6 py-8">
            {messages.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm px-10">
                <div className="inline-block p-6 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl mb-6">
                  <Bot className="w-12 h-12 text-indigo-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2 tracking-tight">System Initialized</h3>
                <p className="text-slate-500 text-xs mb-8 font-medium">
                  The document has been successfully indexed. Ask for a summary or specific details.
                </p>
                <div className="grid grid-cols-1 gap-3 max-w-sm mx-auto">
                  {[
                    'Give me a 5-bullet summary.',
                    'Explain the core methodology.',
                    'What are the key numerical findings?',
                  ].map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(suggestion)}
                      className="p-3 text-left bg-slate-50 hover:bg-white rounded-xl border border-slate-100 hover:border-indigo-300 transition-all text-[11px] text-slate-600 font-bold flex items-center justify-between group"
                    >
                      {suggestion}
                      <Send className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all text-indigo-500" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-4 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {message.type === 'assistant' && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mt-1 shadow-lg shadow-indigo-100">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <div className={`max-w-[90%] ${message.type === 'user' ? 'flex justify-end' : ''}`}>
                      <div
                        className={`relative rounded-2xl p-5 ${message.type === 'user'
                          ? 'bg-slate-800 text-white shadow-xl shadow-slate-200'
                          : 'bg-white border border-slate-100 text-slate-800 shadow-sm'
                          }`}
                      >
                        {message.type === 'assistant' ? (
                          <div className="prose prose-slate prose-sm max-w-none">
                            <TypewriterText text={message.content} animate={message.isNew} speed={10} />
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap text-[13px] leading-relaxed font-medium">{message.content}</p>
                        )}

                        {/* Relevant Figures */}
                        {message.relevant_images && message.relevant_images.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-slate-50 space-y-3">
                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-indigo-500 uppercase tracking-widest">
                              <ImageIcon className="w-3 h-3" />
                              Reference Figures
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              {message.relevant_images.map((img, idx) => (
                                <div
                                  key={idx}
                                  className="group relative rounded-lg overflow-hidden border border-slate-100 bg-slate-50 hover:border-indigo-400 transition-all cursor-pointer shadow-sm"
                                  onClick={() => onPageJump?.(img.page)}
                                >
                                  <img
                                    src={`/api/images/${documentId}/${img.filename}`}
                                    alt={img.caption}
                                    className="w-full h-28 object-contain bg-white"
                                  />
                                  <div className="absolute inset-x-0 bottom-0 bg-white/90 backdrop-blur-sm p-1.5 border-t border-slate-100 opacity-0 group-hover:opacity-100 transition-all">
                                    <p className="text-[8px] text-slate-600 font-bold truncate">Jump to Page {img.page}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Context Excerpts */}
                        {message.context && message.context.length > 0 && (
                          <Accordion type="single" collapsible className="mt-4 border-t border-slate-50">
                            <AccordionItem value="context" className="border-none">
                              <AccordionTrigger className="py-2.5 text-[10px] text-slate-400 hover:text-indigo-500 font-bold uppercase tracking-wider">
                                <span className="flex items-center gap-1.5">
                                  <FileText className="w-3 h-3" />
                                  Source Context ({message.context.length} blocks)
                                </span>
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="space-y-2 mt-2">
                                  {message.context.map((ctx, idx) => (
                                    <div
                                      key={idx}
                                      className="p-3 bg-slate-50/80 rounded-xl text-[11px] text-slate-600 border border-slate-100 hover:border-indigo-200 transition-all cursor-pointer group"
                                      onClick={() => onPageJump?.(1)} // Fallback jump, real page from meta if available
                                    >
                                      <div className="flex justify-between items-center mb-1">
                                        <span className="text-indigo-400 font-black text-[9px]">BLOCK 0{idx + 1}</span>
                                        <span className="text-[8px] text-slate-400 opacity-0 group-hover:opacity-100">Click to view source</span>
                                      </div>
                                      <div className="font-medium leading-relaxed italic">"{ctx}"</div>
                                    </div>
                                  ))}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        )}
                      </div>
                    </div>

                    {message.type === 'user' && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                        <User className="w-5 h-5 text-white" />
                      </div>
                    )}
                    {isLoading && (
                      <div className="flex gap-3 justify-start">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mt-1">
                          <Bot className="w-5 h-5 text-white" />
                        </div>
                        <div className="backdrop-blur-xl bg-white/80 border border-white/60 rounded-2xl p-4 shadow-md max-w-2xl">
                          <div className="flex items-center gap-3">
                            <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                            <span className="text-sm font-medium text-gray-600">Analyzing document context...</span>
                          </div>
                        </div>
                        {message.type === 'user' && (
                          <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center mt-1 border border-slate-200">
                            <User className="w-4 h-4 text-slate-600" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-4 justify-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mt-1 animate-pulse shadow-lg shadow-indigo-100">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                          <div className="w-1 h-1 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
                          <div className="w-1 h-1 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
                          <div className="w-1 h-1 bg-indigo-600 rounded-full animate-bounce" />
                        </div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Analyzing Neural Context...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="backdrop-blur-xl bg-white/60 border-t border-white/60 shadow-lg sticky bottom-0">
            <div className="px-4 py-4">
              <form onSubmit={handleSubmit} className="flex gap-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question about the paper..."
                  className="flex-1 px-4 py-3 backdrop-blur-xl bg-white/80 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-800 placeholder-gray-500"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="px-6 py-3 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Send
                </button>
              </form>
            </div>
          </div>
        </div>{/* end left chat panel */}

        {/* ── RIGHT: PDF Viewer Panel ── */}
        <div className="w-1/2 min-w-0 h-full overflow-hidden">
          <PDFViewer
            documentId={documentId}
            highlights={activeHighlights}
          />
        </div>

        {/* Input */}
        <div className="bg-white border-t border-slate-100 flex-shrink-0 z-10 px-6 py-5">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={handleSubmit} className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Sparkles className="w-4 h-4 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Query the document intelligence..."
                className="w-full pl-11 pr-32 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:bg-white text-[13px] text-slate-800 placeholder-slate-400 transition-all shadow-inner"
                disabled={isLoading}
              />
              <div className="absolute inset-y-1.5 right-1.5 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="h-full px-6 bg-slate-800 text-white rounded-xl font-bold hover:bg-black transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 text-[11px] uppercase tracking-wider"
                >
                  Analyze
                  <Send className="w-3 h-3" />
                </button>
              </div>
            </form>
            <div className="flex justify-between mt-3 px-1">
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">AI context: {documentId}</p>
              <div className="flex gap-3">
                <span className="text-[9px] text-slate-400 font-bold flex items-center gap-1 cursor-pointer hover:text-slate-600 transition-colors"><FileText className="w-2.5 h-2.5" /> Export PDF</span>
                <span className="text-[9px] text-slate-400 font-bold flex items-center gap-1 cursor-pointer hover:text-slate-600 transition-colors"><ImageIcon className="w-2.5 h-2.5" /> Save Figures</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}