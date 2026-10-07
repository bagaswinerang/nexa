"use client";

import { useState, useRef, useEffect } from "react";
import { X, Send, Bot, User, Loader2, Sparkles, Brain } from "lucide-react";
import { ApiError, sendChatMessage, type ChatMessage } from "@/lib/api";
import { useAccount } from "wagmi";
import ChatMessages from "./chat-messages";
import NexaLettermark from "@/components/brand/logo";
import { env } from "@/lib/env";
import { uiCopy } from "@/lib/i18n";
import { useLanguage } from "@/components/layout/language-provider";

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChatDrawer({ isOpen, onClose }: ChatDrawerProps) {
  const { language } = useLanguage();
  const copy = uiCopy[language];
  const { address } = useAccount();
  const effectiveWallet = (address || env.DEFAULT_DEV_WALLET || undefined)?.toLowerCase();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gemini-3.8-flash");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");

    const newMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: userMessage },
    ];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await sendChatMessage(
        userMessage,
        messages,
        effectiveWallet,
        isThinking,
        selectedModel
      );

      setMessages([
        ...newMessages,
        {
          role: "model",
          content: response.reply,
          thought: response.thought,
          model_used: response.model_used || selectedModel,
        },
      ]);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : copy.chatUnavailable;
      setMessages([
        ...newMessages,
        {
          role: "model",
          content: `⚠️ ${message}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-fade-in"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-surface border-l border-white/5 
                     z-50 flex flex-col transition-transform duration-300 ease-out
                     ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#080B11]">
          <div className="flex items-center gap-3">
            <NexaLettermark variant="hex-slash" size={32} />
            <div>
              <div className="font-semibold text-white">Nexa AI</div>
              <div className="text-xs text-gray-500 flex items-center gap-1.5">
                <div className="pulse-dot" />
                {copy.chatAssistantSubtitle}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <ChatMessages messages={messages} isLoading={isLoading} />

        {/* Input Container (Integrated box like fina-app) */}
        <div className="p-4 border-t border-white/5 bg-background/50">
          <div className="flex flex-col bg-white/[0.03] border border-white/10 rounded-2xl p-2.5 focus-within:border-accent/40 focus-within:bg-white/[0.05] transition-all">
            <textarea
              ref={inputRef as unknown as React.RefObject<HTMLTextAreaElement>}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={copy.chatPlaceholder}
              rows={2}
              className="w-full bg-transparent text-sm text-gray-200 placeholder-gray-500 resize-none outline-none px-1 py-1"
              disabled={isLoading}
            />

            {/* Bottom Toolbar inside the box: Thinking, Model, Send */}
            <div className="flex items-center justify-between pt-2 border-t border-white/5 mt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsThinking(!isThinking)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
                    isThinking
                      ? "bg-accent/20 border-accent text-accent-light"
                      : "bg-white/[0.04] border-white/10 text-gray-400 hover:text-white"
                  }`}
                  title={copy.enableThinking}
                >
                  <Brain className="w-3.5 h-3.5" />
                  <span>{copy.thinkingMode}</span>
                </button>

                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="bg-white/[0.04] border border-white/10 text-gray-300 text-xs rounded-lg px-2 py-1 outline-none cursor-pointer hover:border-white/20 transition-all font-mono"
                >
                  <option value="gemini-3.8-flash" className="bg-surface text-white">Gemini 3.8 Flash</option>
                  <option value="gemini-3.7-flash" className="bg-surface text-white">Gemini 3.7 Flash</option>
                  <option value="gemini-3.6-flash" className="bg-surface text-white">Gemini 3.6 Flash</option>
                  <option value="gemini-3.5-flash" className="bg-surface text-white">Gemini 3.5 Flash</option>
                  <option value="gemini-3.1-flash-lite" className="bg-surface text-white">Gemini 3.1 Flash Lite</option>
                </select>
              </div>

              <button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="p-2 rounded-xl bg-gradient-accent text-white disabled:opacity-40 
                           hover:opacity-90 transition-all active:scale-95 shrink-0"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
