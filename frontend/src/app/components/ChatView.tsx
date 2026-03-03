import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, FileText, Loader2 } from 'lucide-react';
import { TypewriterText } from './TypewriterText';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion';
import apiClient from '../api/client';
import { PDFViewer, HighlightRect } from './PDFViewer';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  context?: string[];
  contextPages?: number[]; // page numbers used for this answer
  isNew?: boolean;
}

interface ChatViewProps {
  documentId: string;
  sessionId: string;
  initialMessages: Message[];
  onMessagesUpdate: (sessionId: string, messages: Message[]) => void;
  onNewChat: () => void;
}

export function ChatView({ documentId, sessionId, initialMessages, onMessagesUpdate, onNewChat }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeHighlights, setActiveHighlights] = useState<HighlightRect[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update messages when they change
  useEffect(() => {
    onMessagesUpdate(sessionId, messages);
  }, [messages, sessionId]);

  // Load initial messages when session changes
  useEffect(() => {
    setMessages(initialMessages);
  }, [sessionId]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Focus input on mount
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
      const { data } = await apiClient.post('/api/ask', {
        document_id: documentId,
        session_id: sessionId,
        query: userMessage.content,
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: data.answer,
        context: data.context_used || [],
        contextPages: data.context_pages || [],
        isNew: true,
      };

      // Update exact highlight rects in the PDF viewer
      if (data.context_highlights?.length) {
        setActiveHighlights(data.context_highlights);
      }

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Sorry, I encountered an error processing your question. Please try again.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full w-full flex bg-gradient-to-br from-indigo-50 via-white to-purple-50">

      {/* ── LEFT: Chat Panel ── */}
      <div className="flex flex-col w-1/2 min-w-0 border-r border-gray-200">
        {/* Header */}
        <div className="backdrop-blur-xl bg-white/60 border-b border-white/60 shadow-sm sticky top-0 z-10">
          <div className="px-4 pl-16 lg:pl-4 py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-800">Research Paper Q&A</h2>
                <p className="text-sm text-gray-600">Ask questions about your document</p>
              </div>
            </div>
          </div>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 py-8">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <div className="inline-block p-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg mb-4">
                  <Bot className="w-12 h-12 text-white" />
                </div>
                <h3 className="text-2xl font-semibold text-gray-800 mb-2">
                  Ready to answer your questions
                </h3>
                <p className="text-gray-600 mb-8">
                  Ask anything about the research paper you uploaded
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
                  {[
                    'What is the main finding of this paper?',
                    'Can you summarize the methodology?',
                    'What are the key conclusions?',
                    'What future work is suggested?',
                  ].map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(suggestion)}
                      className="p-3 text-left backdrop-blur-xl bg-white/60 rounded-xl border border-white/60 hover:border-indigo-300 hover:bg-white/80 transition-all shadow-sm text-sm text-gray-700"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                  >
                    {message.type === 'assistant' && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <Bot className="w-5 h-5 text-white" />
                      </div>
                    )}
                    <div
                      className={`flex-1 max-w-2xl ${message.type === 'user' ? 'flex justify-end' : ''
                        }`}
                    >
                      <div
                        className={`backdrop-blur-xl rounded-2xl p-4 shadow-md ${message.type === 'user'
                          ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
                          : 'bg-white/80 border border-white/60 text-gray-800'
                          }`}
                      >
                        {message.type === 'assistant' ? (
                          <TypewriterText text={message.content} animate={message.isNew} speed={20} />
                        ) : (
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        )}
                        {message.context && message.context.length > 0 && (
                          <Accordion type="single" collapsible className="mt-4">
                            <AccordionItem value="context" className="border-none">
                              <AccordionTrigger className="py-2 text-sm text-gray-600 hover:text-gray-800">
                                <span className="flex items-center gap-2">
                                  <FileText className="w-4 h-4" />
                                  View Context Used ({message.context.length} excerpts)
                                </span>
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="space-y-2 mt-2">
                                  {message.context.map((ctx, idx) => (
                                    <div
                                      key={idx}
                                      className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 border border-gray-200"
                                    >
                                      <div className="flex items-start gap-2">
                                        <span className="text-xs font-semibold text-indigo-600 mt-0.5">
                                          #{idx + 1}
                                        </span>
                                        <p className="flex-1 text-xs leading-relaxed">{ctx}</p>
                                      </div>
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
                  </div>
                ))}
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
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
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

    </div>
  );
}