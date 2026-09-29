/**
 * Utility functions.
 */

import { clsx, type ClassValue } from "clsx";

/** Merge Tailwind classes */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

/** Format number as currency */
export function formatCurrency(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Format number as compact (e.g. 1.2K, 3.4M) */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 2,
  }).format(value);
}

/** Format percentage */
export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/** Format wallet address (truncate) */
export function formatAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/** Format date relative to now */
export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

/** Category color mapping */
export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    Salary: "#10B981",
    Freelance: "#8B5CF6",
    Food: "#F59E0B",
    Transport: "#3B82F6",
    Shopping: "#EC4899",
    Bills: "#F43F5E",
    Entertainment: "#06B6D4",
    Health: "#14B8A6",
    Investment: "#6366F1",
    Other: "#6B7280",
  };
  return colors[category] || colors.Other;
}
