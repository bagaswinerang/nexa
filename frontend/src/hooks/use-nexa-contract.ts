"use client";

/**
 * Hook for interacting with Nexa smart contracts.
 */

import { useReadContract, useWriteContract, useAccount } from "wagmi";
import {
  NEXA_IDENTITY_ABI,
  NEXA_IDENTITY_ADDRESS,
  NEXA_JOURNAL_ABI,
  NEXA_JOURNAL_ADDRESS,
} from "@/lib/contracts";

// ─── Identity Contract ──────────────────────────────────────────

export function useNexaIdentity() {
  const { address } = useAccount();
  const { writeContract, isPending: isWriting } = useWriteContract();

  const { data: identity, refetch: refetchIdentity } = useReadContract({
    address: NEXA_IDENTITY_ADDRESS,
    abi: NEXA_IDENTITY_ABI,
    functionName: "getIdentity",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const register = (username: string) => {
    writeContract({
      address: NEXA_IDENTITY_ADDRESS,
      abi: NEXA_IDENTITY_ABI,
      functionName: "register",
      args: [username],
    });
  };

  const updateUsername = (newUsername: string) => {
    writeContract({
      address: NEXA_IDENTITY_ADDRESS,
      abi: NEXA_IDENTITY_ABI,
      functionName: "updateUsername",
      args: [newUsername],
    });
  };

  return {
    identity: identity
      ? {
          username: identity[0],
          registeredAt: Number(identity[1]),
          exists: identity[2],
        }
      : null,
    register,
    updateUsername,
    isWriting,
    refetchIdentity,
  };
}

// ─── Journal Contract ───────────────────────────────────────────

export function useNexaJournal() {
  const { address } = useAccount();
  const { writeContract, isPending: isWriting } = useWriteContract();

  const { data: entries, refetch: refetchEntries } = useReadContract({
    address: NEXA_JOURNAL_ADDRESS,
    abi: NEXA_JOURNAL_ABI,
    functionName: "getEntries",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: summary, refetch: refetchSummary } = useReadContract({
    address: NEXA_JOURNAL_ADDRESS,
    abi: NEXA_JOURNAL_ABI,
    functionName: "getSummary",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const addEntry = (
    amount: bigint,
    category: string,
    note: string,
    isIncome: boolean
  ) => {
    writeContract({
      address: NEXA_JOURNAL_ADDRESS,
      abi: NEXA_JOURNAL_ABI,
      functionName: "addEntry",
      args: [amount, category, note, isIncome],
    });
  };

  return {
    entries: entries || [],
    summary: summary
      ? {
          totalIncome: Number(summary[0]),
          totalExpense: Number(summary[1]),
          entries: Number(summary[2]),
        }
      : null,
    addEntry,
    isWriting,
    refetchEntries,
    refetchSummary,
  };
}
