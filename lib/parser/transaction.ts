import {
  ParsedTransaction,
  ParsedInstruction,
  ParsedInnerInstruction,
  ParsedLog,
  BalanceChange,
  TokenBalanceChange,
  DecodedError,
  RPCTransactionResponse,
  RPCInstruction,
  RPCTokenBalance,
} from '../types';
import { getProgramName, shorten } from '../utils';
import { parseLogs } from './logs';
import { computeBalanceChanges, computeTokenBalanceChanges } from './balances';
import { decodeInstruction } from './instructions';
import { decodeError } from './errors';

/**
 * Main entry point: normalize raw RPC transaction into canonical ParsedTransaction
 */
export function parseTransaction(
  signature: string,
  rpcResponse: RPCTransactionResponse
): ParsedTransaction {
  const { transaction, meta, blockTime, slot, version } = rpcResponse;
  const { message } = transaction;

  // Extract account keys as flat array of strings
  const accountKeys = extractAccountKeys(message.accountKeys, meta?.loadedAddresses);

  // Determine success
  const success = meta?.err === null;
  const feePayer = accountKeys[0] || '';

  // Parse top-level instructions
  const instructions = message.instructions.map((ix, index) =>
    normalizeInstruction(ix, index, accountKeys)
  );

  // Parse inner instructions
  const innerInstructions = (meta?.innerInstructions || []).map((inner) => ({
    parentIndex: inner.index,
    instructions: inner.instructions.map((ix, idx) =>
      normalizeInstruction(ix, idx, accountKeys, inner.index)
    ),
  }));

  // Parse logs
  const logs = meta?.logMessages ? parseLogs(meta.logMessages) : [];

  // Compute balance changes
  const balanceChanges = meta
    ? computeBalanceChanges(accountKeys, meta.preBalances, meta.postBalances, feePayer)
    : [];

  // Compute token balance changes
  const tokenBalanceChanges = meta
    ? computeTokenBalanceChanges(
        meta.preTokenBalances || [],
        meta.postTokenBalances || [],
        accountKeys
      )
    : [];

  // Decode error
  const error = meta?.err ? decodeError(meta.err, accountKeys, message.instructions) : null;

  return {
    signature,
    slot,
    timestamp: blockTime,
    success,
    fee: meta?.fee || 0,
    feePayer,
    version: version || 'legacy',
    instructions,
    innerInstructions,
    logs,
    balanceChanges,
    tokenBalanceChanges,
    computeUnitsConsumed: meta?.computeUnitsConsumed || null,
    error,
  };
}

/**
 * Extract account keys from message, handling both string and object formats
 */
function extractAccountKeys(
  accountKeys: Array<{ pubkey: string; signer: boolean; writable: boolean } | string>,
  loadedAddresses?: { writable: string[]; readonly: string[] }
): string[] {
  const keys = accountKeys.map((key) =>
    typeof key === 'string' ? key : key.pubkey
  );

  if (loadedAddresses) {
    keys.push(...loadedAddresses.writable);
    keys.push(...loadedAddresses.readonly);
  }

  return keys;
}

/**
 * Normalize a single RPC instruction into ParsedInstruction
 */
function normalizeInstruction(
  ix: RPCInstruction,
  index: number,
  accountKeys: string[],
  parentIndex?: number
): ParsedInstruction {
  // Resolve program ID
  const programId = ix.programId || accountKeys[ix.programIdIndex || 0] || 'unknown';
  const programName = getProgramName(programId);

  // Handle parsed instructions (from jsonParsed encoding)
  if (ix.parsed) {
    return normalizeParsedInstruction(ix, index, programId, programName, accountKeys);
  }

  // Handle raw instructions
  const accountIndices = Array.isArray(ix.accounts) && typeof ix.accounts[0] === 'number'
    ? (ix.accounts as number[])
    : [];

  const accounts = accountIndices.map((idx, i) => ({
    pubkey: accountKeys[idx] || 'unknown',
    role: getAccountRole(messageHeader, idx),
    name: `account${i}`,
  }));

  const decoded = decodeInstruction(programId, ix.data, accountKeys);

  return {
    index,
    programId,
    programName,
    type: decoded?.type || 'Unknown',
    description: decoded?.description || `Unknown instruction (${ix.data.length} bytes)`,
    accounts,
    params: decoded?.params || {},
    data: ix.data,
    decoded: !!decoded,
    stackHeight: ix.stackHeight || undefined,
  };
}

// Placeholder for message header - needed for account role resolution
let messageHeader = { numRequiredSignatures: 0, numReadonlySignedAccounts: 0, numReadonlyUnsignedAccounts: 0 };

/**
 * Normalize a parsed instruction from jsonParsed RPC response
 */
function normalizeParsedInstruction(
  ix: RPCInstruction,
  index: number,
  programId: string,
  programName: string,
  accountKeys: string[]
): ParsedInstruction {
  const parsed = ix.parsed!;
  const info = parsed.info;

  // Extract accounts from parsed info
  const accounts: { pubkey: string; role: 'signer' | 'writable' | 'readOnly'; name: string }[] = [];

  // Common account fields in parsed instructions
  const accountFields = [
    { key: 'source', name: 'source' },
    { key: 'destination', name: 'destination' },
    { key: 'authority', name: 'authority' },
    { key: 'owner', name: 'owner' },
    { key: 'mint', name: 'mint' },
    { key: 'account', name: 'account' },
    { key: 'payer', name: 'payer' },
    { key: 'newAccount', name: 'newAccount' },
  ];

  for (const { key, name } of accountFields) {
    if (info[key] && typeof info[key] === 'string') {
      accounts.push({
        pubkey: info[key],
        role: 'readOnly',
        name,
      });
    }
  }

  // Build params
  const params: Record<string, any> = {};
  for (const [key, value] of Object.entries(info)) {
    if (typeof value !== 'string' || !accountFields.some((f) => f.key === key)) {
      params[key] = value;
    }
  }

  // Generate description
  const description = generateParsedDescription(parsed.type, programName, info);

  return {
    index,
    programId,
    programName,
    type: parsed.type,
    description,
    accounts,
    params,
    data: ix.data || '',
    decoded: true,
    stackHeight: ix.stackHeight || undefined,
  };
}

function generateParsedDescription(
  type: string,
  programName: string,
  info: Record<string, any>
): string {
  const short = (key: string) => (info[key] ? shorten(info[key]) : 'unknown');

  switch (type) {
    case 'transfer':
      const lamports = info.lamports;
      if (lamports) {
        return `Transfer ${(lamports / 1e9).toFixed(9)} SOL to ${short('destination')}`;
      }
      return `Transfer to ${short('destination')}`;

    case 'transferChecked':
      const amount = info.tokenAmount?.uiAmount;
      const mint = info.tokenAmount?.uiAmountString;
      return `Transfer ${mint || amount || '?'} tokens to ${short('destination')}`;

    case 'createAccount':
      return `Create account ${short('newAccount')} with ${(info.lamports / 1e9).toFixed(9)} SOL`;

    case 'closeAccount':
      return `Close token account ${short('account')}`;

    case 'initializeAccount':
      return `Initialize token account for ${short('owner')}`;

    case 'setComputeUnitPrice':
      return `Set priority fee: ${info.microLamports} micro-lamports/CU`;

    case 'setComputeUnitLimit':
      return `Set compute unit limit: ${info.units}`;

    default:
      return `${programName}: ${type}`;
  }
}

function getAccountRole(
  header: { numRequiredSignatures: number; numReadonlySignedAccounts: number; numReadonlyUnsignedAccounts: number },
  index: number
): 'signer' | 'writable' | 'readOnly' {
  const numSigners = header.numRequiredSignatures;
  const numReadonlySigners = header.numReadonlySignedAccounts;
  const numReadonlyNonSigners = header.numReadonlyUnsignedAccounts;

  if (index < numSigners - numReadonlySigners) {
    return 'signer';
  }
  if (index < numSigners) {
    return 'signer'; // readonly signer
  }
  if (index < numSigners + numReadonlyNonSigners) {
    return 'readOnly';
  }
  return 'writable';
}
