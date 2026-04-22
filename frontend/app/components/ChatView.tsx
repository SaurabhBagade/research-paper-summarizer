import { useState, useRef, useEffect } from 'react';
import {
  Send, Bot, User, FileText, Loader2, Sparkles,
  Paperclip, Smile, ThumbsUp, ThumbsDown, BookmarkPlus
} from 'lucide-react';
import { TypewriterText } from './TypewriterText';

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
  onPageJump?: (page: number) => void;
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

  useEffect(() => {
    onMessagesUpdate(sessionId, messages);
  }, [messages, sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

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

      if (data.context_pages?.length > 0 && onPageJump) {
        onPageJump(data.context_pages[0]);
      }
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
        <button
          onClick={onNewChat}
          className="text-xs text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#374151] px-3 py-1.5 rounded-md transition-colors"
        >
          New Chat
        </button>
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
            {messages.map(message => (
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
                        {/* Content */}
                        <div className="text-sm leading-relaxed prose prose-sm prose-invert max-w-none">
                          {message.isNew ? (
                            <TypewriterText text={message.content} animate speed={12} />
                          ) : (
                            <p className="whitespace-pre-wrap">{message.content}</p>
                          )}
                        </div>

                        {/* Source Citations */}
                        {message.context && message.context.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-[#374151]">
                            <p className="text-xs text-[#9CA3AF] mb-2">Sources:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {message.context.slice(0, 3).map((ctx, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 text-xs bg-[#10B981]/20 text-[#10B981] px-2.5 py-1 rounded-md font-medium"
                                >
                                  <FileText className="h-3 w-3" />
                                  Block {idx + 1}
                                </span>
                              ))}
                              {message.context.length > 3 && (
                                <span className="text-xs text-[#6B7280] self-center">
                                  +{message.context.length - 3} more
                                </span>
                              )}
                            </div>
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
            ))}

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
                    <span className="text-xs text-[#9CA3AF]">Analyzing notebook context...</span>
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
              type="button"
              className="p-2 text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#374151] rounded-md transition-colors"
            >
              <Paperclip className="h-4 w-4" />
            </button>
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