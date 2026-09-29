/**
 * Smart contract ABIs and addresses.
 */

import { env } from "./env";

export const NEXA_IDENTITY_ADDRESS = env.NEXA_IDENTITY_ADDRESS;
export const NEXA_JOURNAL_ADDRESS = env.NEXA_JOURNAL_ADDRESS;

export const NEXA_IDENTITY_ABI = [
  {
    type: "function",
    name: "register",
    inputs: [{ name: "_username", type: "string" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "updateUsername",
    inputs: [{ name: "_newUsername", type: "string" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getIdentity",
    inputs: [{ name: "_user", type: "address" }],
    outputs: [
      { name: "username", type: "string" },
      { name: "registeredAt", type: "uint256" },
      { name: "exists", type: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isRegistered",
    inputs: [{ name: "_user", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalUsers",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "IdentityRegistered",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "username", type: "string", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const;

export const NEXA_JOURNAL_ABI = [
  {
    type: "function",
    name: "addEntry",
    inputs: [
      { name: "_amount", type: "uint256" },
      { name: "_category", type: "string" },
      { name: "_note", type: "string" },
      { name: "_isIncome", type: "bool" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getEntries",
    inputs: [{ name: "_user", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "id", type: "uint256" },
          { name: "amount", type: "uint256" },
          { name: "category", type: "string" },
          { name: "note", type: "string" },
          { name: "isIncome", type: "bool" },
          { name: "timestamp", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getLatestEntries",
    inputs: [
      { name: "_user", type: "address" },
      { name: "_count", type: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "id", type: "uint256" },
          { name: "amount", type: "uint256" },
          { name: "category", type: "string" },
          { name: "note", type: "string" },
          { name: "isIncome", type: "bool" },
          { name: "timestamp", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getSummary",
    inputs: [{ name: "_user", type: "address" }],
    outputs: [
      { name: "totalIncome", type: "uint256" },
      { name: "totalExpense", type: "uint256" },
      { name: "entries", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "entryCount",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "EntryAdded",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "entryId", type: "uint256", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "category", type: "string", indexed: false },
      { name: "isIncome", type: "bool", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const;
