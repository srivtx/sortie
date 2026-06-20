/**
 * IR Builder
 * 
 * Takes a raw Solana RPC getTransaction response and produces
 * the canonical ExecutionIR.
 * 
 * This is the SINGLE entry point for normalization.
 * All downstream components consume the IR.
 */

import {
  ExecutionIR,
  ExecutionStep,
  ExecutionResult,
  ExecutionError,
  ExecutionLog,
  ExecutionFailure,
  AccountRef,
  ProgramRef,
  InstructionInfo,
  InstructionAccount,
  ComputeSummary,
  ComputeUnits,
  FeeBreakdown,
  StateChange,
  SolStateChange,
  TokenStateChange,
  TokenAmount,
  ProtocolInfo,
  LogType,
  FailureAnalysis,
  FailureCategory,
  FailureContext,
} from './types';

import { parseLogs } from '../parser/logs';
import { ParsedLog as RawParsedLog } from '../types';
import { decodeInstruction } from '../parser/instructions';
import { computeBalanceChanges, computeTokenBalanceChanges } from '../parser/balances';
import { decodeError } from '../parser/errors';
import { getProgramName, getProgramShortName } from '../utils';
import { detectProtocol, enrichInstruction } from '../parser/protocols';

// ============================================================================
// MAIN BUILDER ENTRY POINT
// ============================================================================

export function buildExecutionIR(signature: string, rpcResponse: unknown): ExecutionIR {
  const raw = rpcResponse as Record<string, unknown>;
  
  // Basic metadata
  const slot = (raw.slot as number) || 0;
  const blockTime = (raw.blockTime as number) || null;
  const meta = (raw.meta as Record<string, unknown>) || {};
  const transaction = (raw.transaction as Record<string, unknown>) || {};
  const message = (transaction.message as Record<string, unknown>) || {};
  
  // Accounts
  const accounts = extractAccounts(message, meta);
  
  // Fee
  const fee = extractFee(meta, accounts);
  
  // Compute
  const compute = extractCompute(meta, transaction);
  
  // Instructions
  const rawInstructions = (message.instructions as unknown[]) || [];
  const accountKeys = (message.accountKeys as unknown[]) || [];
  
  // Logs and CPI tree
  const rawLogs = (meta.logMessages as string[]) || [];
  const parsedLogs = parseLogs(rawLogs);
  
  // Build CPI tree from logs
  const { steps, allSteps } = buildExecutionSteps(
    rawInstructions,
    accountKeys,
    parsedLogs,
    meta,
    accounts
  );
  
  // State changes
  const stateChanges = buildStateChanges(meta, accounts);
  
  // Associate state changes with steps
  associateStateChanges(steps, stateChanges);
  
  // Detect protocols
  const protocols = detectProtocols(allSteps);
  
  // Failure analysis
  const failure = buildFailureAnalysis(steps, allSteps, meta, fee, compute, transaction);
  
  // Success determination
  const success = !meta.err && steps.every(s => s.result !== 'failure');
  
  const ir: ExecutionIR = {
    signature,
    slot,
    timestamp: blockTime,
    success,
    fee,
    compute,
    accounts,
    steps,
    allSteps,
    stateChanges,
    failure,
    protocols,
    rawLogs,
  };
  
  return ir;
}

// ============================================================================
// ACCOUNT EXTRACTION
// ============================================================================

function extractAccounts(
  message: Record<string, unknown>,
  meta: Record<string, unknown>
): AccountRef[] {
  const accountKeys = (message.accountKeys as unknown[]) || [];
  const loadedAddresses = (meta.loadedAddresses as Record<string, unknown>) || {};
  const writable = (loadedAddresses.writable as string[]) || [];
  const readonly = (loadedAddresses.readonly as string[]) || [];
  
  const allKeys: string[] = [];
  
  for (const key of accountKeys) {
    if (typeof key === 'string') {
      allKeys.push(key);
    } else if (typeof key === 'object' && key !== null) {
      const k = key as Record<string, unknown>;
      if (typeof k.pubkey === 'string') {
        allKeys.push(k.pubkey);
      }
    }
  }
  
  const feePayer = allKeys[0] || '';
  
  return allKeys.map((pubkey, index) => {
    const isWritable = index < (message.header as Record<string, number>)?.numRequiredSignatures + 
      (message.header as Record<string, number>)?.numReadonlySignedAccounts ||
      writable.includes(pubkey);
    const isSigner = index < (message.header as Record<string, number>)?.numRequiredSignatures || false;
    
    return {
      pubkey,
      isSigner,
      isWritable,
      isFeePayer: pubkey === feePayer,
    };
  });
}

// ============================================================================
// FEE EXTRACTION
// ============================================================================

function extractFee(meta: Record<string, unknown>, accounts: AccountRef[]): FeeBreakdown {
  const total = (meta.fee as number) || 0;
  const payer = accounts.find(a => a.isFeePayer)?.pubkey || accounts[0]?.pubkey || '';
  
  // Base fee is typically 5000, rest is priority fee
  const base = 5000;
  const priority = Math.max(0, total - base);
  
  return {
    base,
    priority,
    total,
    payer,
  };
}

// ============================================================================
// COMPUTE EXTRACTION
// ============================================================================

function extractCompute(meta: Record<string, unknown>, transaction: Record<string, unknown>): ComputeSummary {
  const consumed = (meta.computeUnitsConsumed as number) || null;
  
  // Look for ComputeBudget instructions
  const message = (transaction.message as Record<string, unknown>) || {};
  const instructions = (message.instructions as unknown[]) || [];
  
  let requestedLimit: number | null = null;
  let pricePerCu: number | null = null;
  
  for (const ix of instructions) {
    const parsed = (ix as Record<string, unknown>).parsed;
    if (parsed && typeof parsed === 'object') {
      const p = parsed as Record<string, unknown>;
      const type = p.type as string;
      const info = p.info as Record<string, unknown>;
      
      if (type === 'setComputeUnitLimit' && info?.units) {
        requestedLimit = info.units as number;
      }
      if (type === 'setComputeUnitPrice' && info?.microLamports) {
        pricePerCu = info.microLamports as number;
      }
    }
  }
  
  const utilizationPercent = requestedLimit && consumed
    ? Math.round((consumed / requestedLimit) * 100)
    : null;
  
  return {
    requestedLimit,
    pricePerCu,
    consumed,
    utilizationPercent,
    exceeded: consumed !== null && requestedLimit !== null && consumed > requestedLimit,
  };
}

// ============================================================================
// EXECUTION STEPS + CPI TREE
// ============================================================================

interface StackFrame {
  step: ExecutionStep;
  logs: ExecutionLog[];
  computeConsumed: number | null;
}

function buildExecutionSteps(
  rawInstructions: unknown[],
  accountKeys: unknown[],
  parsedLogs: RawParsedLog[],
  meta: Record<string, unknown>,
  accounts: AccountRef[]
): { steps: ExecutionStep[]; allSteps: ExecutionStep[] } {
  const steps: ExecutionStep[] = [];
  const allSteps: ExecutionStep[] = [];
  let order = 0;
  
  // Parse inner instructions
  const innerInstructions = (meta.innerInstructions as unknown[]) || [];
  const innerByIndex: Record<number, unknown[]> = {};
  for (const inner of innerInstructions) {
    const i = inner as Record<string, unknown>;
    const idx = i.index as number;
    const instructions = (i.instructions as unknown[]) || [];
    innerByIndex[idx] = instructions;
  }
  
  // Build top-level steps
  for (let i = 0; i < rawInstructions.length; i++) {
    const ix = rawInstructions[i];
    const step = buildStep(
      ix,
      accountKeys,
      i,
      null,
      0,
      order++,
      accounts
    );
    steps.push(step);
    allSteps.push(step);
    
    // Add inner instructions as children
    const inners = innerByIndex[i] || [];
    for (let j = 0; j < inners.length; j++) {
      const innerStep = buildStep(
        inners[j],
        accountKeys,
        j,
        step.id,
        1,
        order++,
        accounts
      );
      step.children.push(innerStep);
      allSteps.push(innerStep);
      
      // Recursively add deeper nested (if any)
      // Note: inner instructions from meta are flat, not nested
      // We rely on log-based reconstruction for true nesting
    }
  }
  
  // Reconstruct CPI tree from logs for accurate nesting
  reconstructCpiTreeFromLogs(steps, parsedLogs, allSteps, order);
  
  return { steps, allSteps };
}

function buildStep(
  rawIx: unknown,
  accountKeys: unknown[],
  index: number,
  parentId: string | null,
  depth: number,
  order: number,
  accounts: AccountRef[]
): ExecutionStep {
  const ix = rawIx as Record<string, unknown>;
  
  // Get program ID
  let programId = '';
  if (typeof ix.programId === 'string') {
    programId = ix.programId;
  } else if (typeof ix.programIdIndex === 'number') {
    const key = accountKeys[ix.programIdIndex];
    if (typeof key === 'string') {
      programId = key;
    } else if (typeof key === 'object' && key !== null) {
      programId = (key as Record<string, string>).pubkey || '';
    }
  }
  
  const program: ProgramRef = {
    id: programId,
    name: getProgramName(programId),
    shortName: getProgramShortName(programId),
  };
  
  // Extract instruction data and accounts for decoding
  const ixData = typeof ix.data === 'string' ? ix.data : '';
  const ixAccounts: string[] = [];
  if (Array.isArray(ix.accounts)) {
    for (const acc of ix.accounts) {
      if (typeof acc === 'number') {
        const key = accountKeys[acc];
        if (typeof key === 'string') {
          ixAccounts.push(key);
        } else if (typeof key === 'object' && key !== null) {
          ixAccounts.push((key as Record<string, string>).pubkey || '');
        }
      } else if (typeof acc === 'string') {
        ixAccounts.push(acc);
      }
    }
  }
  
  // Decode instruction
  const decoded = decodeInstruction(programId, ixData, ixAccounts);
  
  // Build instruction info
  const instructionInfo: InstructionInfo = {
    type: decoded?.type || (ix.parsed && typeof ix.parsed === 'object' ? (ix.parsed as Record<string, unknown>).type as string : 'Unknown'),
    description: decoded?.description || `Instruction to ${program.shortName}`,
    semanticSummary: null,
    accounts: ixAccounts.map((pubkey, idx) => ({
      pubkey,
      role: idx === 0 ? 'signer' as const : 'writable' as const,
      name: `account${idx}`,
    })),
    params: decoded?.params || {},
    raw: ix,
  };
  
  // Detect protocol and enrich
  const protocol = detectProtocol(programId, instructionInfo);
  const enriched = protocol ? enrichInstruction(instructionInfo, protocol) : instructionInfo;
  
  const step: ExecutionStep = {
    id: `step-${order}`,
    order,
    parentId,
    depth,
    program,
    instruction: enriched,
    computeUnits: null,
    result: 'success',
    error: null,
    logs: [],
    returnData: null,
    children: [],
    stateChanges: [],
    protocol,
  };
  
  return step;
}

// ============================================================================
// CPI TREE RECONSTRUCTION FROM LOGS
// ============================================================================

function reconstructCpiTreeFromLogs(
  rootSteps: ExecutionStep[],
  parsedLogs: RawParsedLog[],
  allSteps: ExecutionStep[],
  startOrder: number
) {
  const stack: { step: ExecutionStep; startLogIndex: number }[] = [];
  let order = startOrder;
  let rootIndex = 0;
  
  for (let i = 0; i < parsedLogs.length; i++) {
    const log = parsedLogs[i];
    
    if (log.type === 'invoke') {
      // Create a step for this invocation
      const parent = stack.length > 0 ? stack[stack.length - 1].step : null;
      const depth = stack.length;
      
      const step: ExecutionStep = {
        id: `step-${order++}`,
        order: allSteps.length,
        parentId: parent?.id || null,
        depth,
        program: {
          id: log.program || '',
          name: log.programName || 'Unknown',
          shortName: getProgramShortName(log.program || ''),
        },
        instruction: {
          type: 'CPI',
          description: `Cross-program invocation to ${log.programName || 'Unknown'}`,
          semanticSummary: null,
          accounts: [],
          params: {},
          raw: log,
        },
        computeUnits: null,
        result: 'success',
        error: null,
        logs: [],
        returnData: null,
        children: [],
        stateChanges: [],
        protocol: null,
      };
      
      allSteps.push(step);
      
      if (parent) {
        parent.children.push(step);
      } else if (rootIndex < rootSteps.length) {
        // Try to match with root step
        // If program IDs match, merge
        if (rootSteps[rootIndex].program.id === step.program.id) {
          // Merge logs into existing root step
          rootSteps[rootIndex].logs.push(convertLog(log));
          // Replace the new step with the root step on stack
          stack.push({ step: rootSteps[rootIndex], startLogIndex: i });
          allSteps.pop(); // Remove the duplicate
          order--;
          continue;
        } else {
          rootSteps.push(step);
        }
      } else {
        rootSteps.push(step);
      }
      
      stack.push({ step, startLogIndex: i });
    } else if (log.type === 'success' || log.type === 'failure') {
      const frame = stack.pop();
      if (frame) {
        frame.step.result = log.type === 'success' ? 'success' : 'failure';
        if (log.type === 'failure' && log.error) {
          frame.step.error = {
            code: log.error,
            name: 'ProgramError',
            rawMessage: log.error,
          };
        }
        frame.step.logs.push(convertLog(log));
        
        // Calculate compute units for this step
        const cuLog = findComputeLog(parsedLogs, frame.startLogIndex, i);
        if (cuLog) {
          frame.step.computeUnits = {
            consumed: cuLog.consumed || 0,
            remaining: cuLog.remaining || null,
          };
        }
      }
    } else {
      // Other logs belong to the current frame
      if (stack.length > 0) {
        stack[stack.length - 1].step.logs.push(convertLog(log));
      }
    }
  }
  
  // Associate root-level logs with root steps
  for (const rootStep of rootSteps) {
    if (rootStep.logs.length === 0) {
      // Find logs for this root step
      // Heuristic: first invoke log that matches program
      const matchingLog = parsedLogs.find(
        l => l.type === 'invoke' && l.program === rootStep.program.id
      );
      if (matchingLog) {
        rootStep.logs.push(convertLog(matchingLog));
      }
    }
  }
}

function convertLog(rawLog: RawParsedLog): ExecutionLog {
  const typeMap: Record<string, LogType> = {
    invoke: 'invoke',
    success: 'success',
    failure: 'failure',
    log: 'log',
    compute: 'compute',
    return: 'return',
    data: 'data',
  };
  
  return {
    type: typeMap[rawLog.type] || 'other',
    message: rawLog.message || '',
    depth: rawLog.depth,
    program: rawLog.program ? {
      id: rawLog.program,
      name: rawLog.programName || 'Unknown',
      shortName: getProgramShortName(rawLog.program),
    } : null,
    data: rawLog,
  };
}

function findComputeLog(
  logs: RawParsedLog[],
  startIndex: number,
  endIndex: number
): { consumed: number; remaining: number | null } | null {
  for (let i = startIndex; i <= endIndex && i < logs.length; i++) {
    const log = logs[i];
    if (log.type === 'compute' && typeof log.computeUnits === 'number') {
      return {
        consumed: log.computeUnits,
        remaining: null,
      };
    }
  }
  return null;
}

// ============================================================================
// STATE CHANGES
// ============================================================================

function buildStateChanges(meta: Record<string, unknown>, accounts: AccountRef[]): StateChange[] {
  const changes: StateChange[] = [];
  
  // SOL changes
  const preBalances = (meta.preBalances as number[]) || [];
  const postBalances = (meta.postBalances as number[]) || [];
  const accountKeys = accounts.map(a => a.pubkey);
  
  for (let i = 0; i < preBalances.length; i++) {
    const pre = preBalances[i] || 0;
    const post = postBalances[i] || 0;
    const delta = post - pre;
    
    if (delta !== 0 && accountKeys[i]) {
      changes.push({
        type: 'sol',
        account: accountKeys[i],
        pre,
        post,
        delta,
      });
    }
  }
  
  // Token changes
  const preTokens = (meta.preTokenBalances as unknown[]) || [];
  const postTokens = (meta.postTokenBalances as unknown[]) || [];
  
  for (const pre of preTokens) {
    const p = pre as Record<string, unknown>;
    const accountIndex = p.accountIndex as number;
    const mint = p.mint as string;
    const ui = p.uiTokenAmount as Record<string, unknown>;
    const account = accountKeys[accountIndex];
    
    if (!account) continue;
    
    const post = postTokens.find(
      (t) => (t as Record<string, unknown>).accountIndex === accountIndex &&
             (t as Record<string, unknown>).mint === mint
    ) as Record<string, unknown> | undefined;
    
    const postUi = post?.uiTokenAmount as Record<string, unknown>;
    
    const preAmount: TokenAmount = {
      raw: (ui?.amount as string) || '0',
      ui: (ui?.uiAmount as number)?.toString() || null,
    };
    
    const postAmount: TokenAmount = {
      raw: (postUi?.amount as string) || '0',
      ui: (postUi?.uiAmount as number)?.toString() || null,
    };
    
    const deltaRaw = BigInt(postAmount.raw) - BigInt(preAmount.raw);
    const decimals = (ui?.decimals as number) || 0;
    const deltaUi = Number(deltaRaw) / Math.pow(10, decimals);
    
    if (deltaRaw !== BigInt(0)) {
      changes.push({
        type: 'token',
        account,
        mint,
        pre: preAmount,
        post: postAmount,
        delta: {
          raw: deltaRaw.toString(),
          ui: deltaUi.toFixed(decimals),
        },
        decimals,
      });
    }
  }
  
  // Handle token accounts that only appear in post
  for (const post of postTokens) {
    const p = post as Record<string, unknown>;
    const accountIndex = p.accountIndex as number;
    const mint = p.mint as string;
    const account = accountKeys[accountIndex];
    
    if (!account) continue;
    
    const hasPre = preTokens.some(
      (t) => (t as Record<string, unknown>).accountIndex === accountIndex &&
             (t as Record<string, unknown>).mint === mint
    );
    
    if (!hasPre) {
      const ui = p.uiTokenAmount as Record<string, unknown>;
      const postAmount: TokenAmount = {
        raw: (ui?.amount as string) || '0',
        ui: (ui?.uiAmount as number)?.toString() || null,
      };
      const decimals = (ui?.decimals as number) || 0;
      const deltaRaw = BigInt(postAmount.raw);
      
      changes.push({
        type: 'token',
        account,
        mint,
        pre: { raw: '0', ui: '0' },
        post: postAmount,
        delta: {
          raw: deltaRaw.toString(),
          ui: (Number(deltaRaw) / Math.pow(10, decimals)).toFixed(decimals),
        },
        decimals,
      });
    }
  }
  
  return changes;
}

function associateStateChanges(steps: ExecutionStep[], changes: StateChange[]) {
  // Simple heuristic: associate state changes with steps based on
  // account overlap in instructions
  for (const step of steps) {
    const stepAccounts = new Set(
      step.instruction.accounts.map(a => a.pubkey)
    );
    
    for (const change of changes) {
      if (stepAccounts.has(change.account)) {
        step.stateChanges.push(change);
      }
    }
    
    // Recurse into children
    associateStateChanges(step.children, changes);
  }
}

// ============================================================================
// PROTOCOL DETECTION
// ============================================================================

function detectProtocols(allSteps: ExecutionStep[]): ProtocolInfo[] {
  const seen = new Set<string>();
  const protocols: ProtocolInfo[] = [];
  
  for (const step of allSteps) {
    if (step.protocol && !seen.has(step.protocol.programId)) {
      seen.add(step.protocol.programId);
      protocols.push(step.protocol);
    }
  }
  
  return protocols;
}

// ============================================================================
// FAILURE ANALYSIS
// ============================================================================

function buildFailureAnalysis(
  steps: ExecutionStep[],
  allSteps: ExecutionStep[],
  meta: Record<string, unknown>,
  fee: FeeBreakdown,
  compute: ComputeSummary,
  transaction: Record<string, unknown>
): ExecutionFailure | null {
  if (!meta.err) return null;

  // Find the failing step
  const failingStep = allSteps.find(s => s.result === 'failure') || steps[steps.length - 1];
  if (!failingStep) return null;

  // Decode the error
  const txMessage = (transaction.message as Record<string, unknown>) || {};
  const errAccountKeys = (txMessage.accountKeys as unknown[]) || [];
  const errInstructions = (txMessage.instructions as unknown[]) || [];
  const decodedError = decodeError(meta.err, errAccountKeys as string[], errInstructions);

  if (!decodedError) {
    return null;
  }

  const error: ExecutionError = {
    code: decodedError.code,
    name: decodedError.name,
    rawMessage: decodedError.message,
  };
  
  // Build failure analysis
  const analysis = analyzeFailure(
    failingStep,
    error,
    allSteps,
    fee,
    compute,
    meta
  );
  
  return {
    failingStep,
    error,
    analysis,
  };
}

function analyzeFailure(
  failingStep: ExecutionStep,
  error: ExecutionError,
  allSteps: ExecutionStep[],
  fee: FeeBreakdown,
  compute: ComputeSummary,
  meta: Record<string, unknown>
): FailureAnalysis {
  const context = buildFailureContext(failingStep, allSteps, fee, compute, meta);
  const errName = error.name.toLowerCase();
  const errMsg = error.rawMessage.toLowerCase();
  const errCode = String(error.code);

  // Determine category from error name, code, message, and context
  let category: FailureCategory = 'unknown';
  let explanation = '';
  let probableCause = '';
  let fix = '';

  // Check compute budget
  if (compute.exceeded || context.computeExceeded) {
    category = 'insufficient_compute';
    explanation = `The transaction exceeded its compute budget limit of ${compute.requestedLimit || 200000} CUs.`;
    probableCause = 'Too many instructions or expensive operations (e.g., many CPIs, large account data).';
    fix = 'Increase compute budget with SetComputeUnitLimit instruction, or optimize the transaction to use fewer resources.';
  }
  // Check slippage by error name or code
  else if (
    errName.includes('slippage') ||
    errMsg.includes('slippage') ||
    errCode === '6001' ||
    errCode === '6020'
  ) {
    category = 'slippage_exceeded';
    explanation = 'The swap could not be completed within the allowed slippage tolerance.';
    probableCause = 'Price moved between transaction creation and execution, or slippage tolerance was set too low.';
    fix = 'Increase slippage tolerance in your swap parameters, or retry the transaction during lower volatility.';
  }
  // Check insufficient funds by error name or code
  else if (
    errName.includes('insufficient') ||
    errName.includes('negative') ||
    errMsg.includes('insufficient') ||
    errMsg.includes('negative') ||
    errCode === '1' || // Token insufficient funds
    errCode === '5' || // System insufficient funds
    context.feePayerLowBalance
  ) {
    category = 'insufficient_funds';
    explanation = 'The transaction failed due to insufficient funds.';

    if (context.feePayerLowBalance) {
      probableCause = `Fee payer ${fee.payer.slice(0, 8)}... has insufficient SOL to cover the transaction fee of ${fee.total} lamports.`;
      fix = `Fund the fee payer account with at least ${fee.total + 10000} lamports to cover fees and rent.`;
    } else {
      probableCause = 'An account involved in the transaction lacks sufficient balance for the requested operation.';
      fix = 'Ensure all accounts have sufficient balances before executing the transaction.';
    }
  }
  // Check missing accounts
  else if (context.missingTokenAccounts.length > 0) {
    category = 'missing_account';
    explanation = 'The transaction references token accounts that do not exist.';
    probableCause = `Missing Associated Token Accounts: ${context.missingTokenAccounts.join(', ')}`;
    fix = 'Create the necessary Associated Token Accounts before executing this transaction.';
  }
  // Check account already exists
  else if (
    errName.includes('alreadyinuse') ||
    errMsg.includes('already in use') ||
    errCode === '0'
  ) {
    category = 'account_already_exists';
    explanation = 'The transaction attempted to create an account that already exists.';
    probableCause = 'The account address is already in use on-chain.';
    fix = 'Use a different account address, or use the existing account instead of creating a new one.';
  }
  // Check invalid instruction
  else if (
    errName.includes('invalid') ||
    errMsg.includes('invalid') ||
    errName.includes('malformed') ||
    errCode === '2' ||
    errCode === '3'
  ) {
    category = 'invalid_instruction';
    explanation = 'An instruction in the transaction is invalid or malformed.';
    probableCause = 'Incorrect instruction data, wrong accounts, or incompatible program version.';
    fix = 'Verify instruction parameters and account ordering match the program\'s expected format.';
  }
  // Check missing signer
  else if (
    errName.includes('signer') ||
    errMsg.includes('signer') ||
    errMsg.includes('missing required signature') ||
    errMsg.includes('signature')
  ) {
    category = 'missing_signer';
    explanation = 'The transaction is missing a required signature.';
    probableCause = 'An account that must sign the transaction was not included as a signer.';
    fix = 'Ensure all required accounts are marked as signers in the transaction.';
  }
  // Check rent exemption
  else if (
    errName.includes('rent') ||
    errName.includes('exempt') ||
    errMsg.includes('rent') ||
    errMsg.includes('exempt')
  ) {
    category = 'rent_exemption';
    explanation = 'An account does not have enough lamports to be rent-exempt.';
    probableCause = 'New accounts must hold the minimum lamports for rent exemption.';
    fix = 'Transfer additional lamports to the account to meet rent exemption requirements.';
  }
  // Custom program error (catch-all for known custom codes)
  else if (
    errMsg.includes('custom program error') ||
    errName.includes('custom') ||
    (failingStep.program.id !== '11111111111111111111111111111111' &&
     failingStep.program.id !== 'unknown' &&
     errCode !== '-1')
  ) {
    category = 'custom_program';
    explanation = `The program ${failingStep.program.name} returned a custom error: ${error.name} (${error.code})`;
    probableCause = 'Program-specific business logic constraint was violated.';
    fix = 'Check the program\'s documentation for the specific error code meaning.';
  }
  else {
    explanation = `Transaction failed: ${error.name} - ${error.rawMessage}`;
    probableCause = 'Unknown cause - review the transaction logs for more details.';
    fix = 'Check the program logs and verify all parameters are correct.';
  }

  return {
    category,
    explanation,
    probableCause,
    fixSuggestion: fix,
    severity: category === 'insufficient_compute' || category === 'insufficient_funds' ? 'critical' : 'warning',
    context,
  };
}

function buildFailureContext(
  failingStep: ExecutionStep,
  allSteps: ExecutionStep[],
  fee: FeeBreakdown,
  compute: ComputeSummary,
  meta: Record<string, unknown>
): FailureContext {
  const feePayer = fee.payer;
  const feePayerChange = allSteps
    .flatMap(s => s.stateChanges)
    .find((c): c is SolStateChange => c.type === 'sol' && c.account === feePayer);
  
  const feePayerLowBalance = feePayerChange ? feePayerChange.pre < fee.total : false;
  
  const computeExceeded = compute.exceeded || 
    (compute.consumed !== null && compute.requestedLimit !== null && compute.consumed > compute.requestedLimit);
  
  // Check for missing token accounts in logs
  const missingTokenAccounts: string[] = [];
  for (const log of failingStep.logs) {
    if (log.type === 'log' && log.message.includes('associated token account')) {
      const match = log.message.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
      if (match) missingTokenAccounts.push(match[0]);
    }
  }
  
  return {
    feePayerLowBalance,
    computeExceeded,
    missingTokenAccounts,
    programContext: {},
  };
}
