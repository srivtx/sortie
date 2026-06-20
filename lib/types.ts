/**
 * Normalized transaction schema for SORTIE DevTools
 * 
 * This is the canonical internal representation of a Solana transaction.
 * All parsers normalize to this schema.
 */

export interface ParsedTransaction {
  signature: string;
  slot: number;
  timestamp: number | null;
  success: boolean;
  fee: number;
  feePayer: string;
  version: 'legacy' | 0;
  instructions: ParsedInstruction[];
  innerInstructions: ParsedInnerInstruction[];
  logs: ParsedLog[];
  balanceChanges: BalanceChange[];
  tokenBalanceChanges: TokenBalanceChange[];
  computeUnitsConsumed: number | null;
  error: DecodedError | null;
}

export interface ParsedInstruction {
  index: number;
  programId: string;
  programName: string;
  type: string;
  description: string;
  accounts: AccountReference[];
  params: Record<string, any>;
  data: string;
  decoded: boolean;
  stackHeight?: number;
}

export interface ParsedInnerInstruction {
  parentIndex: number;
  instructions: ParsedInstruction[];
}

export interface AccountReference {
  pubkey: string;
  role: 'signer' | 'writable' | 'readOnly';
  name: string;
}

export interface ParsedLog {
  program: string;
  programName: string;
  depth: number;
  type: 'invoke' | 'success' | 'failure' | 'log' | 'compute' | 'return' | 'data';
  message?: string;
  computeUnits?: number;
  error?: string;
}

export interface BalanceChange {
  account: string;
  accountIndex: number;
  pre: number;
  post: number;
  change: number;
  isFeePayer: boolean;
}

export interface TokenBalanceChange {
  account: string;
  accountIndex: number;
  mint: string;
  owner: string;
  pre: { raw: string; ui: number | null };
  post: { raw: string; ui: number | null };
  change: { raw: string; ui: number | null };
  decimals: number;
}

export interface DecodedError {
  programId: string;
  programName: string;
  code: number;
  name: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  explanation: string;
  suggestion?: string;
}

// Raw RPC response types
export interface RPCTransactionResponse {
  transaction: RPCTransactionData;
  meta: RPCMeta | null;
  blockTime: number | null;
  slot: number;
  version: 'legacy' | 0;
}

export interface RPCTransactionData {
  signatures: string[];
  message: RPCMessage;
}

export interface RPCMessage {
  header: {
    numRequiredSignatures: number;
    numReadonlySignedAccounts: number;
    numReadonlyUnsignedAccounts: number;
  };
  accountKeys: Array<{ pubkey: string; signer: boolean; writable: boolean } | string>;
  recentBlockhash: string;
  instructions: RPCInstruction[];
  addressTableLookups?: Array<{
    accountKey: string;
    writableIndexes: number[];
    readonlyIndexes: number[];
  }>;
}

export interface RPCInstruction {
  programIdIndex?: number;
  programId?: string;
  accounts: number[] | string[];
  data: string;
  stackHeight?: number | null;
  parsed?: {
    info: Record<string, any>;
    type: string;
  };
  program?: string;
}

export interface RPCMeta {
  fee: number;
  preBalances: number[];
  postBalances: number[];
  preTokenBalances: RPCTokenBalance[] | null;
  postTokenBalances: RPCTokenBalance[] | null;
  innerInstructions: RPCInnerInstruction[] | null;
  logMessages: string[] | null;
  err: any;
  computeUnitsConsumed?: number;
  loadedAddresses?: {
    writable: string[];
    readonly: string[];
  };
}

export interface RPCTokenBalance {
  accountIndex: number;
  mint: string;
  owner: string;
  uiTokenAmount: {
    amount: string;
    decimals: number;
    uiAmount: number | null;
    uiAmountString: string;
  };
  programId: string;
}

export interface RPCInnerInstruction {
  index: number;
  instructions: RPCInstruction[];
}
