"use client";

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

export default function AppSidebar() {
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

  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-white/5 bg-surface/50 backdrop-blur-xl">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-white/5">
        <Link href="/dashboard" className="flex items-center">
          <NexaLettermark variant="hex-slash" size={34} showWordmark={true} />
        </Link>
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
  );
}
