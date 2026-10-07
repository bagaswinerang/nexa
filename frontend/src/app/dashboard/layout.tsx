"use client";

import { useState } from "react";
import AppSidebar from "@/components/layout/app-sidebar";
import ChatDrawer from "@/components/chat/chat-drawer";
import { Bot, Menu } from "lucide-react";

import Link from "next/link";
import NexaLettermark from "@/components/brand/logo";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden flex-col md:flex-row">
      {/* Mobile Top Navbar (visible on < md screens) */}
      <header className="flex md:hidden items-center justify-between px-4 py-3 border-b border-white/5 bg-[#080B11]/90 backdrop-blur-md z-30 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link href="/" className="flex items-center gap-2">
            <NexaLettermark size={26} showWordmark={true} />
          </Link>
        </div>
      </header>

      {/* Sidebar */}
      <AppSidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">{children}</div>
      </main>

      {/* Chat FAB */}
      <button
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-accent 
                   flex items-center justify-center shadow-lg shadow-accent/25
                   hover:shadow-xl hover:shadow-accent/30 transition-all duration-300
                   hover:scale-105 active:scale-95 z-40 animate-pulse-glow"
        aria-label="Open AI Chat"
      >
        <Bot className="w-6 h-6 text-white" />
      </button>

      {/* Chat Drawer */}
      <ChatDrawer isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </div>
  );
}
