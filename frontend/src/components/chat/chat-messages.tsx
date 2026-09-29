import { useState, useEffect, useRef } from "react";
import { Bot, User, Loader2, Brain, ChevronDown, ChevronRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { ChatMessage } from "@/lib/api";
import { uiCopy } from "@/lib/i18n";
import { useLanguage } from "@/components/layout/language-provider";

interface ChatMessagesProps {
  messages: ChatMessage[];
  isLoading: boolean;
}

export default function ChatMessages({ messages, isLoading }: ChatMessagesProps) {
  const { language } = useLanguage();
  const copy = uiCopy[language];
  const bottomRef = useRef<HTMLDivElement>(null);
  const [openThoughts, setOpenThoughts] = useState<Record<number, boolean>>({});

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const toggleThought = (idx: number) => {
    setOpenThoughts((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-accent flex items-center justify-center mb-4 animate-float">
          <Bot className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Nexa AI Assistant</h3>
        <p className="text-gray-400 text-sm leading-relaxed mb-6">
          {copy.chatIntro}
        </p>
        <div className="grid grid-cols-1 gap-2 w-full max-w-xs">
          {copy.suggestions.map((suggestion) => (
            <div
              key={suggestion}
              className="px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] 
                         text-sm text-gray-400 text-left cursor-default hover:bg-white/[0.06] transition-colors"
            >
              {suggestion}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`flex gap-3 animate-slide-up ${
            msg.role === "user" ? "flex-row-reverse" : ""
          }`}
          style={{ animationDelay: `${i * 0.05}s` }}
        >
          {/* Avatar */}
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              msg.role === "user"
                ? "bg-accent/20 text-accent-light"
                : "bg-gradient-accent text-white"
            }`}
          >
            {msg.role === "user" ? (
              <User className="w-4 h-4" />
            ) : (
              <Bot className="w-4 h-4" />
            )}
          </div>

          {/* Message Bubble */}
          <div
            className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed flex flex-col gap-2 ${
              msg.role === "user"
                ? "bg-accent/20 text-white rounded-tr-md"
                : "bg-white/[0.05] text-gray-200 rounded-tl-md border border-white/[0.06]"
            }`}
          >
            {/* Thought Collapsible (if thought exists) */}
            {msg.thought && (() => {
              const isThoughtOpen = openThoughts[i] ?? true;
              return (
                <div className="border border-white/10 rounded-xl overflow-hidden bg-black/30 text-xs">
                  <button
                    type="button"
                    onClick={() => setOpenThoughts((prev) => ({ ...prev, [i]: !isThoughtOpen }))}
                    className="w-full px-3 py-2 flex items-center justify-between text-gray-300 hover:text-white transition-colors bg-white/[0.03]"
                  >
                    <div className="flex items-center gap-1.5 font-medium">
                      <Brain className="w-3.5 h-3.5 text-accent-light" />
                      <span>{copy.thoughtProcess}</span>
                    </div>
                    {isThoughtOpen ? (
                      <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                    )}
                  </button>
                  {isThoughtOpen && (
                    <div className="px-3 py-2.5 text-gray-300 border-t border-white/5 bg-black/40 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                      <ReactMarkdown>{msg.thought}</ReactMarkdown>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Markdown rendered response */}
            <div className="prose prose-invert prose-sm max-w-none text-gray-200 leading-relaxed break-words">
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                  li: ({ children }) => <li className="text-gray-300">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                  code: ({ children }) => (
                    <code className="bg-white/10 px-1.5 py-0.5 rounded text-accent-light text-xs font-mono">
                      {children}
                    </code>
                  ),
                }}
              >
                {msg.content}
              </ReactMarkdown>
            </div>

            {/* Model Badge */}
            {msg.model_used && (
              <div className="text-[10px] text-gray-500 self-end font-mono">
                {msg.model_used}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex gap-3 animate-slide-up">
          <div className="w-8 h-8 rounded-xl bg-gradient-accent flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div className="bg-white/[0.05] px-4 py-2.5 rounded-2xl rounded-tl-md border border-white/[0.06]">
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin text-accent-light" />
              <span>Thinking...</span>
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
