"use client";

import { useEffect } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Home,
  Wallet2,
  Zap,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/layout/language-provider";

import NexaLettermark from "@/components/brand/logo";
import { X } from "lucide-react";

interface AppSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function AppSidebar({ isOpen = false, onClose }: AppSidebarProps) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const navItems = [
    { href: "/dashboard", label: t("overview"), icon: Home },
    {
      href: "/dashboard/live-agent",
      label: t("liveAgentDex"),
      icon: Zap,
      badge: "LIVE",
      badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    },
    { href: "/dashboard/finance", label: t("finance"), icon: Wallet2 },
    { href: "/dashboard/quant", label: "Quant Lab", icon: BarChart3 },
  ];

  // Close on route change on mobile
  useEffect(() => {
    if (isOpen && onClose) {
      onClose();
    }
  }, [pathname]);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}
      
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col w-64 border-r border-white/5 bg-[#080b11] backdrop-blur-xl transition-transform duration-300 md:relative md:translate-x-0 md:bg-surface/50",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-6 py-6 border-b border-white/5">
          <Link href="/dashboard" className="flex items-center">
            <NexaLettermark variant="hex-slash" size={34} showWordmark={true} />
          </Link>
          {onClose && (
            <button 
              onClick={onClose}
              className="md:hidden p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        <div className="text-xs text-gray-500 uppercase tracking-wider px-4 mb-3">
          {t("menu")}
        </div>
        {navItems.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(isActive ? "nav-item-active" : "nav-item")}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span className="truncate">{item.label}</span>
              {item.badge && (
                <span
                  className={cn(
                    "ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded border font-semibold",
                    item.badgeClass,
                  )}
                >
                  {item.badge}
                </span>
              )}
              {isActive && !item.badge && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-accent" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-4 py-4 border-t border-white/5 space-y-2">
        <Link href="/" className="nav-item w-full">
          <LogOut className="w-5 h-5" />
          <span>{t("exitDashboard")}</span>
        </Link>
      </div>
    </aside>
    </>
  );
}
