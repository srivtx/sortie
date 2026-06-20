import { ParsedLog } from '../types';

const INVOKE_REGEX = /^Program (\S+) invoke \[(\d+)\]$/;
const SUCCESS_REGEX = /^Program (\S+) success$/;
const FAILED_REGEX = /^Program (\S+) failed: (.+)$/;
const LOG_REGEX = /^Program log: (.*)$/;
const COMPUTE_REGEX = /^Program (\S+) consumed (\d+) of (\d+) compute units$/;
const RETURN_REGEX = /^Program return: (\S+) (.+)$/;
const DATA_REGEX = /^Program data: (.+)$/;

export function parseLogs(logMessages: string[]): ParsedLog[] {
  const entries: ParsedLog[] = [];

  for (const log of logMessages) {
    let match: RegExpMatchArray | null;

    if ((match = log.match(INVOKE_REGEX))) {
      entries.push({
        program: match[1],
        programName: getProgramName(match[1]),
        depth: parseInt(match[2]),
        type: 'invoke',
      });
    } else if ((match = log.match(SUCCESS_REGEX))) {
      entries.push({
        program: match[1],
        programName: getProgramName(match[1]),
        depth: -1,
        type: 'success',
      });
    } else if ((match = log.match(FAILED_REGEX))) {
      entries.push({
        program: match[1],
        programName: getProgramName(match[1]),
        depth: -1,
        type: 'failure',
        error: match[2],
      });
    } else if ((match = log.match(LOG_REGEX))) {
      entries.push({
        program: '',
        programName: '',
        depth: -1,
        type: 'log',
        message: match[1],
      });
    } else if ((match = log.match(COMPUTE_REGEX))) {
      entries.push({
        program: match[1],
        programName: getProgramName(match[1]),
        depth: -1,
        type: 'compute',
        computeUnits: parseInt(match[2]),
      });
    } else if ((match = log.match(RETURN_REGEX))) {
      entries.push({
        program: match[1],
        programName: getProgramName(match[1]),
        depth: -1,
        type: 'return',
        message: match[2],
      });
    } else if ((match = log.match(DATA_REGEX))) {
      entries.push({
        program: '',
        programName: '',
        depth: -1,
        type: 'data',
        message: match[1],
      });
    }
  }

  return entries;
}

const KNOWN_PROGRAMS: Record<string, string> = {
  '11111111111111111111111111111111': 'System Program',
  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: 'SPL Token',
  TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb: 'Token-2022',
  ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL: 'Associated Token Account',
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'Jupiter',
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'Raydium AMM',
  whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc: 'Orca Whirlpool',
  ComputeBudget111111111111111111111111111111: 'Compute Budget',
  AddressLookupTab1e1111111111111111111111111: 'Address Lookup Table',
};

function getProgramName(programId: string): string {
  return KNOWN_PROGRAMS[programId] || programId.slice(0, 8) + '...';
}
