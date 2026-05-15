import { useState, useRef, useEffect } from 'react';
import {
  Send, Bot, User, FileText, Loader2, Sparkles,
  Paperclip, Smile, ThumbsUp, ThumbsDown, BookmarkPlus, Brain
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { useCitation } from '../context/CitationContext';

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
  timestamp?: string;
}

interface ChatViewProps {
  documentId: string;
  notebookId: string;
  sessionId: string;
  initialMessages: Message[];
  onMessagesUpdate: (sessionId: string, messages: Message[]) => void;
  onNewChat: () => void;
  onPageJump?: (page: number, text?: string) => void;
  sourceCount?: number;
}

const SUGGESTIONS = [
  'Give me a 5-bullet summary.',
  'Explain the core methodology.',
  'What are the key numerical findings?',
  'List the main conclusions of this research.',
];

export function ChatView({
  documentId,
  notebookId,
  sessionId,
  initialMessages,
  onMessagesUpdate,
  onNewChat,
  onPageJump,
  sourceCount = 0,
}: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [loadingText, setLoadingText] = useState('Thinking...');
  const { setHighlightedSourceId } = useCitation();

  useEffect(() => {
    onMessagesUpdate(sessionId, messages);
  }, [messages, sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      setLoadingText('Thinking...');
      return;
    }
    const texts = ['Thinking...', 'Evaluating sources...', 'Synthesizing response...'];
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % texts.length;
      setLoadingText(texts[i]);
    }, 2000);
    return () => clearInterval(interval);
  }, [isLoading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const now = () =>
    new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input.trim(),
      timestamp: now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: documentId,
          notebook_id: notebookId,
          session_id: sessionId,
          query: userMessage.content,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: data.answer || 'No response received.',
        context: data.context_used || [],
        relevant_images: data.relevant_images || [],
        isNew: true,
        timestamp: now(),
      };

      // Propagate highlight/page data upward for the PDF viewer
      (assistantMessage as any).context_highlights = data.context_highlights;
      (assistantMessage as any).context_pages = data.context_pages;

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Sorry, I encountered an error processing your question. Please check if the backend is running and try again.',
        timestamp: now(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit(e as any);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#1F2937] overflow-hidden">
      {/* Chat Header */}
      <div className="flex-shrink-0 px-5 py-3.5 border-b border-[#374151] flex items-center justify-between bg-[#1F2937]">
        <h2 className="font-semibold text-[#F3F4F6] text-sm">Chat</h2>
      </div>

      {/* Messages Area */}
      <div
        ref={scrollAreaRef}
        className="flex-1 overflow-y-auto min-h-0 px-5 py-6 space-y-6"
      >
        {messages.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center px-8">
            <div className="w-14 h-14 bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-900/20">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
            <h3 className="text-base font-semibold text-[#F3F4F6] mb-2">Ready to Analyze</h3>
            <p className="text-sm text-[#9CA3AF] mb-6 max-w-xs">
              {sourceCount > 0
                ? `Ask questions across ${sourceCount} source${sourceCount > 1 ? 's' : ''} in this notebook.`
                : 'Upload sources to this notebook, then start asking questions.'}
            </p>
            {sourceCount > 0 && (
              <div className="grid gap-2 w-full max-w-sm">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(s)}
                    className="text-left px-4 py-2.5 bg-[#272E3E] hover:bg-[#374151] border border-[#374151] hover:border-[#3B82F6] rounded-lg text-sm text-[#D1D5DB] transition-all duration-150 flex items-center justify-between group"
                  >
                    {s}
                    <Send className="h-3.5 w-3.5 text-[#3B82F6] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {messages.map(message => {
              let thinkContent = null;
              let displayContent = message.content;
              
              // Extract <think> reasoning tags from the message
              if (message.type === 'assistant') {
                const thinkMatch = message.content.match(/<think>([\s\S]*?)(?:<\/think>|$)/);
                if (thinkMatch) {
                  thinkContent = thinkMatch[1].trim();
                  displayContent = message.content.replace(/<think>[\s\S]*?(?:<\/think>|$)/, '').trim();
                }
              }

              return (
                <div key={message.id}>
                {message.type === 'user' ? (
                  /* User Message */
                  <div className="flex justify-end">
                    <div className="max-w-[85%]">
                      <div className="bg-[#3B82F6] text-white rounded-2xl px-4 py-3">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                      </div>
                      {message.timestamp && (
                        <p className="text-[11px] text-[#6B7280] mt-1.5 text-right">{message.timestamp}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Assistant Message */
                  <div className="flex justify-start">
                    <div className="max-w-[85%]">
                      <div className="bg-[#272E3E] border border-[#3B82F6]/20 text-[#F3F4F6] rounded-2xl px-4 py-4">
                        {/* Reasoning Block */}
                        {thinkContent && (
                          <div className="mb-3 bg-[#111827]/50 border border-[#374151] rounded-lg overflow-hidden">
                            <details className="group">
                              <summary className="flex items-center cursor-pointer px-3 py-2 text-xs font-medium text-[#9CA3AF] hover:text-[#F3F4F6] transition-colors list-none [&::-webkit-details-marker]:hidden">
                                <Brain className="w-3.5 h-3.5 mr-1.5 text-[#8B5CF6]" />
                                <span>View reasoning process</span>
                              </summary>
                              <div className="px-3 pb-3 pt-1 text-xs text-[#9CA3AF] border-t border-[#374151] whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                                {thinkContent}
                              </div>
                            </details>
                          </div>
                        )}

                        {/* Content */}
                        <div className="text-sm leading-relaxed prose prose-sm prose-invert max-w-none">
                          <ReactMarkdown
                            remarkPlugins={[remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            components={{
                              img: ({ node, ...props }) => <img className="max-w-full rounded-lg my-3 border border-[#374151]" {...props} />,
                              a: ({ node, href, children, ...props }) => {
                                if (href?.startsWith('#cite-')) {
                                  const citeId = href.replace('#cite-', '');
                                  return (
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        setHighlightedSourceId(citeId);
                                        const pageIndex = parseInt(citeId, 10) - 1;
                                        const contextText = message.context?.[pageIndex];
                                        if (onPageJump && (message as any).context_pages?.[pageIndex]) {
                                          onPageJump((message as any).context_pages[pageIndex], contextText);
                                        }
                                        setTimeout(() => setHighlightedSourceId(null), 3000);
                                      }}
                                      className="inline-flex items-center justify-center min-w-[20px] h-5 mx-1 px-1 text-[10px] font-bold text-white bg-[#3B82F6] hover:bg-[#2563EB] rounded-full transition-colors shadow-sm"
                                      title={`Highlight Source ${citeId}`}
                                    >
                                      {citeId}
                                    </button>
                                  );
                                }
                                return <a href={href} className="text-[#3B82F6] hover:underline" target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
                              },
                              p: ({ node, ...props }) => <p className="mb-3 last:mb-0" {...props} />,
                              ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-3 space-y-1" {...props} />,
                              ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-3 space-y-1" {...props} />,
                              code: ({ node, inline, className, children, ...props }: any) => 
                                inline 
                                  ? <code className="bg-[#111827] text-[#3B82F6] px-1.5 py-0.5 rounded text-xs" {...props}>{children}</code>
                                  : <code className="block bg-[#111827] text-[#E5E7EB] p-3 rounded-lg text-xs overflow-x-auto mb-3 border border-[#374151]" {...props}>{children}</code>
                            }}
                          >
                            {displayContent.replace(/\[(\d+)\]/g, '[$1](#cite-$1)')}
                          </ReactMarkdown>
                        </div>

                        {/* Source Citations */}
                        {message.context && message.context.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-[#374151] space-y-2">
                            <p className="text-xs text-[#9CA3AF] mb-2 font-medium">Sources referenced:</p>
                            {message.context.map((ctx, idx) => {
                              const pageNum = (message as any).context_pages?.[idx] || 1;
                              return (
                                <details key={idx} className="group bg-[#111827]/50 border border-[#374151] rounded-lg overflow-hidden">
                                  <summary className="flex items-center justify-between cursor-pointer px-3 py-2 text-xs font-medium text-[#D1D5DB] hover:text-[#F3F4F6] hover:bg-[#1F2937] transition-colors list-none [&::-webkit-details-marker]:hidden">
                                    <span className="flex items-center gap-2">
                                      <span className="bg-[#3B82F6] text-white px-1.5 py-0.5 rounded-full text-[10px] leading-none font-bold">[{idx + 1}]</span>
                                      <FileText className="h-3.5 w-3.5 text-[#9CA3AF]" />
                                      <span className="truncate max-w-[200px] opacity-80">Page {pageNum} context</span>
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        if (onPageJump) onPageJump(pageNum, ctx);
                                        setHighlightedSourceId(String(idx + 1));
                                        setTimeout(() => setHighlightedSourceId(null), 3000);
                                      }}
                                      className="text-[#3B82F6] hover:text-[#60A5FA] hover:underline px-2 py-0.5 rounded bg-[#3B82F6]/10 transition-colors"
                                    >
                                      View in PDF
                                    </button>
                                  </summary>
                                  <div className="px-3 pb-3 pt-2 text-xs text-[#9CA3AF] border-t border-[#374151] whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto font-mono">
                                    {ctx}
                                  </div>
                                </details>
                              );
                            })}
                          </div>
                        )}

                        {/* Message Actions */}
                        <div className="mt-3 pt-2 flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
                          <button className="p-1.5 hover:bg-[#374151] rounded-md transition-colors text-[#9CA3AF] hover:text-[#F3F4F6]" title="Save to note">
                            <BookmarkPlus className="h-3.5 w-3.5" />
                          </button>
                          <button className="p-1.5 hover:bg-[#374151] rounded-md transition-colors text-[#9CA3AF] hover:text-[#F3F4F6]" title="Helpful">
                            <ThumbsUp className="h-3.5 w-3.5" />
                          </button>
                          <button className="p-1.5 hover:bg-[#374151] rounded-md transition-colors text-[#9CA3AF] hover:text-[#F3F4F6]" title="Not helpful">
                            <ThumbsDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      {message.timestamp && (
                        <p className="text-[11px] text-[#6B7280] mt-1.5">{message.timestamp}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              );
            })}

            {/* Typing Indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-[#272E3E] border border-[#3B82F6]/20 rounded-2xl px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-[#3B82F6] rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-2 h-2 bg-[#3B82F6] rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-2 h-2 bg-[#3B82F6] rounded-full animate-bounce" />
                    </div>
                            <span className="text-xs text-[#9CA3AF] animate-pulse">{loadingText}</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 p-4 border-t border-[#374151] bg-[#1F2937]">
        <form onSubmit={handleSubmit} className="relative">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a follow-up question..."
            disabled={isLoading}
            className="w-full h-14 pl-4 pr-28 bg-[#111827] border border-[#374151] focus:border-[#3B82F6] text-[#F3F4F6] placeholder:text-[#6B7280] rounded-lg text-sm focus:outline-none transition-colors disabled:opacity-60"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="w-8 h-8 bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center transition-colors"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </form>
        <p className="text-xs text-[#6B7280] mt-2">
          {sourceCount > 0 ? `${sourceCount} source${sourceCount > 1 ? 's' : ''} in context` : 'No sources added yet'}
          {' · '}
          <span className="opacity-60">Ctrl+Enter to send</span>
        </p>
      </div>
    </div>
  );
}