/**
 * Canonical Internal Execution Model (IR)
 * 
 * This is the normalized representation of a Solana transaction execution.
 * All downstream components (visualization, analysis, timeline) consume this IR.
 * It is produced once by the IR Builder and never mutated.
 */

// ============================================================================
// CORE EXECUTION IR
// ============================================================================

export interface ExecutionIR {
  /** Transaction signature (base58) */
  signature: string;
  
  /** Slot number */
  slot: number;
  
  /** Block timestamp (unix seconds) */
  timestamp: number | null;
  
  /** Overall success */
  success: boolean;
  
  /** Fee breakdown */
  fee: FeeBreakdown;
  
  /** Compute budget and consumption */
  compute: ComputeSummary;
  
  /** Account inputs to the transaction */
  accounts: AccountRef[];
  
  /** Root execution steps (top-level instructions) */
  steps: ExecutionStep[];
  
  /** Flat list of ALL steps (top-level + CPIs) for easy iteration */
  allSteps: ExecutionStep[];
  
  /** State changes (SOL + token) */
  stateChanges: StateChange[];
  
  /** Failure analysis (null if success) */
  failure: ExecutionFailure | null;
  
  /** Protocols detected in this transaction */
  protocols: ProtocolInfo[];
  
  /** Raw logs for reference */
  rawLogs: string[];
}

// ============================================================================
// EXECUTION STEP (INSTRUCTION OR CPI)
// ============================================================================

export interface ExecutionStep {
  /** Unique ID within the IR */
  id: string;
  
  /** Execution order (0-indexed, chronological) */
  order: number;
  
  /** Parent step ID (null for top-level instructions) */
  parentId: string | null;
  
  /** Nesting depth (0 = top-level, 1 = first CPI, etc.) */
  depth: number;
  
  /** Program that executed this step */
  program: ProgramRef;
  
  /** The instruction that triggered this execution */
  instruction: InstructionInfo;
  
  /** Compute units consumed by this step */
  computeUnits: ComputeUnits | null;
  
  /** Execution result */
  result: ExecutionResult;
  
  /** Error details (if failed) */
  error: ExecutionError | null;
  
  /** Logs emitted during this step */
  logs: ExecutionLog[];
  
  /** Program return data */
  returnData: string | null;
  
  /** Child steps (CPIs invoked by this step) */
  children: ExecutionStep[];
  
  /** Associated state changes caused by this step */
  stateChanges: StateChange[];
  
  /** Protocol context (if this step belongs to a known protocol) */
  protocol: ProtocolInfo | null;
}

export type ExecutionResult = 'success' | 'failure' | 'partial';

// ============================================================================
// PROGRAM & INSTRUCTION
// ============================================================================

export interface ProgramRef {
  /** Program ID (base58 pubkey) */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Short name for compact display */
  shortName: string;
}

export interface InstructionInfo {
  /** Instruction type (e.g., 'Transfer', 'Swap', 'Route') */
  type: string;
  
  /** Human-readable description */
  description: string;
  
  /** Semantic summary for protocol instructions */
  semanticSummary: string | null;
  
  /** Accounts involved */
  accounts: InstructionAccount[];
  
  /** Parsed parameters */
  params: Record<string, unknown>;
  
  /** Raw data (for debugging) */
  raw: unknown;
}

export interface InstructionAccount {
  /** Account pubkey */
  pubkey: string;
  
  /** Role in this instruction */
  role: 'signer' | 'writable' | 'readOnly';
  
  /** Semantic name (e.g., 'source', 'destination', 'mint') */
  name: string;
}

export interface AccountRef {
  /** Account pubkey */
  pubkey: string;
  
  /** Was this account a signer? */
  isSigner: boolean;
  
  /** Was this account writable? */
  isWritable: boolean;
  
  /** Was this the fee payer? */
  isFeePayer: boolean;
}

// ============================================================================
// COMPUTE & FEES
// ============================================================================

export interface ComputeSummary {
  /** Requested compute unit limit (from ComputeBudget instruction) */
  requestedLimit: number | null;
  
  /** Price per CU in micro-lamports */
  pricePerCu: number | null;
  
  /** Total CU consumed */
  consumed: number | null;
  
  /** Percentage of limit consumed */
  utilizationPercent: number | null;
  
  /** Was compute budget exceeded? */
  exceeded: boolean;
}

export interface ComputeUnits {
  /** CU consumed by this step */
  consumed: number;
  
  /** CU remaining after this step (from logs) */
  remaining: number | null;
}

export interface FeeBreakdown {
  /** Base fee (5000 lamports default) */
  base: number;
  
  /** Priority fee (from ComputeBudget) */
  priority: number;
  
  /** Total fee */
  total: number;
  
  /** Fee payer account */
  payer: string;
}

// ============================================================================
// STATE CHANGES
// ============================================================================

export type StateChange = SolStateChange | TokenStateChange;

export interface SolStateChange {
  type: 'sol';
  account: string;
  pre: number;
  post: number;
  delta: number;
}

export interface TokenStateChange {
  type: 'token';
  account: string;
  mint: string;
  pre: TokenAmount;
  post: TokenAmount;
  delta: TokenAmount;
  decimals: number;
}

export interface TokenAmount {
  raw: string;
  ui: string | null;
}

// ============================================================================
// ERRORS & FAILURE ANALYSIS
// ============================================================================

export interface ExecutionError {
  /** Error code */
  code: string | number;
  
  /** Error name */
  name: string;
  
  /** Raw error message from logs/RPC */
  rawMessage: string;
}

export interface ExecutionFailure {
  /** The step that failed */
  failingStep: ExecutionStep;
  
  /** The error */
  error: ExecutionError;
  
  /** Deterministic analysis */
  analysis: FailureAnalysis;
}

export interface FailureAnalysis {
  /** Category of failure */
  category: FailureCategory;
  
  /** Human-readable explanation */
  explanation: string;
  
  /** Most likely cause */
  probableCause: string;
  
  /** Actionable fix suggestion */
  fixSuggestion: string;
  
  /** Severity */
  severity: 'critical' | 'warning';
  
  /** Additional context for debugging */
  context: FailureContext;
}

export type FailureCategory =
  | 'insufficient_funds'
  | 'insufficient_compute'
  | 'slippage_exceeded'
  | 'missing_account'
  | 'invalid_instruction'
  | 'missing_signer'
  | 'account_already_exists'
  | 'rent_exemption'
  | 'custom_program'
  | 'unknown';

export interface FailureContext {
  /** Was the fee payer low on SOL? */
  feePayerLowBalance: boolean;
  
  /** Did compute exceed budget? */
  computeExceeded: boolean;
  
  /** Were any token accounts missing? */
  missingTokenAccounts: string[];
  
  /** Program-specific context */
  programContext: Record<string, unknown>;
}

// ============================================================================
// PROTOCOLS
// ============================================================================

export interface ProtocolInfo {
  /** Protocol name */
  name: string;
  
  /** Program ID */
  programId: string;
  
  /** Protocol category */
  category: ProtocolCategory;
  
  /** Human-readable summary of what this protocol did */
  semanticSummary: string | null;
}

export type ProtocolCategory = 'dex' | 'lending' | 'nft' | 'launchpad' | 'perps' | 'other';

// ============================================================================
// LOGS
// ============================================================================

export interface ExecutionLog {
  /** Log type */
  type: LogType;
  
  /** Raw log message */
  message: string;
  
  /** Depth (for invoke logs) */
  depth: number | null;
  
  /** Program that emitted this log */
  program: ProgramRef | null;
  
  /** Parsed data (type-specific) */
  data: unknown;
}

export type LogType =
  | 'invoke'
  | 'success'
  | 'failure'
  | 'log'
  | 'compute'
  | 'return'
  | 'data'
  | 'other';

// ============================================================================
// CPI TREE (for visualization)
// ============================================================================

export interface CpiTreeNode {
  /** Node ID */
  id: string;
  
  /** Step this node represents */
  step: ExecutionStep;
  
  /** Parent node (null for root) */
  parent: CpiTreeNode | null;
  
  /** Child nodes */
  children: CpiTreeNode[];
  
  /** Node position in tree (computed by layout engine) */
  position: { x: number; y: number } | null;
}

export interface CpiTreeEdge {
  /** Source node ID */
  from: string;
  
  /** Target node ID */
  to: string;
  
  /** Edge type */
  type: 'invoke' | 'return';
}
