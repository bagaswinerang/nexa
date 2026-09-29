/**
 * Transaction type definitions.
 */

export interface Transaction {
  id: string;
  user_address: string;
  amount: number;
  category: string;
  note: string;
  is_income: boolean;
  pair?: string;
  tx_hash?: string;
  created_at: string;
}

export interface TransactionSummary {
  total_deposit?: number;
  total_withdrawal?: number;
  total_profit?: number;
  total_loss?: number;
  net_pnl?: number;
  active_balance?: number;
  win_rate?: number;
  total_income: number;
  total_expense: number;
  total_entries: number;
  balance: number;
}

export interface CreateTransactionData {
  user_address: string;
  amount: number;
  category: string;
  note?: string;
  is_income: boolean;
  pair?: string;
  tx_hash?: string;
}
