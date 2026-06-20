# Contributing to SORTIE

Thanks for considering a contribution. This guide covers adding a new
program decoder, fixing a bug, or improving the docs.

## Adding a new program decoder

The most useful contribution. Covers more protocols so the failure
decoder and live feed can decode more transactions.

### 1. Pick a protocol that matters

Check the live demo to see which programs are currently supported. Common
gaps: lending protocols (Solend, MarginFi), perps (Zeta, Flash Trade),
NFT marketplaces (Tensor, Magic Eden), bridges (Wormhole, Mayan).

### 2. Find the program's IDL or error codes

You need either:
- An Anchor IDL file (the program's source code that defines the
  instructions and error types), or
- A documented list of error codes (e.g., from the protocol's docs), or
- Sample mainnet transactions that fail with specific errors (reverse-
  engineer from `getTransaction` output)

If the program is open-source, start there. If not, the GitHub issues
or Discord for the protocol often have users posting error codes.

### 3. Create the decoder file

```ts
// lib/parser/protocols/my-program.ts
import { ProtocolDecoder } from './types';

export const myProgram: ProtocolDecoder = {
  programId: 'MyProgram11111111111111111111111111111111',
  decodeError: (code: number) => {
    const errors: Record<number, string> = {
      0: 'Success',
      1: 'Insufficient liquidity',
      2: 'Slippage exceeded',
      // ...
    };
    return errors[code] ?? `Unknown error: 0x${code.toString(16)}`;
  },
  decodeInstruction: (data: Buffer) => {
    // Parse the instruction data buffer.
    // Return an object with `type` and parsed `params`.
    return { type: 'swap', params: { /* ... */ } };
  },
};
```

### 4. Register the decoder

Add it to `lib/parser/protocols/index.ts`:

```ts
import { myProgram } from './my-program';

export const decoders: ProtocolDecoder[] = [
  jupiter,
  raydium,
  // ...
  myProgram,  // add here
];
```

### 5. Test with real transactions

Find a few mainnet transactions that involve your protocol (use
Solscan or Solana FM). For each:
- Confirm the failure is decoded correctly
- Confirm the success path doesn't show a false error
- Confirm the instruction is decoded with sensible params

If you don't have test transactions, you can construct one (call the
program with deliberately bad inputs) but real mainnet failures are
better.

### 6. Open a PR

Include in the PR description:
- The protocol name and program ID
- Source of the error codes (link to docs, IDL, or issues)
- Example transaction signatures that show the decoder working
- Any edge cases you found

## Fixing bugs

- **Wrong error message:** fix in the protocol decoder. Add a test
  transaction in the PR description.
- **Parser crash on certain transactions:** open an issue with the
  transaction signature and the error. We can reproduce and fix.
- **UI bug:** open an issue with a screenshot and the steps to reproduce.
- **Performance issue:** profile it first (`npx tsc --noEmit`, React
  DevTools Profiler). Open an issue with the profile.

## Reporting issues

- Bug reports: [github.com/srivtx/sortie/issues](https://github.com/srivtx/sortie/issues)
- Security issues: DM the maintainer
- Feature requests: open an issue with the `enhancement` label

## Documentation

Docs are in `README.md` and inline in the code. If something is unclear
in the README, that's a bug. Open a PR with the fix.

## Style guide

- **No emojis** in docs (matches the style of [solana-superchargers](https://github.com/srivtx/solana-superchargers))
- **Cite sources** for any pricing, version numbers, or API details
- **Verified content** — if you write about an SDK, link to the actual
  repo and check the current version
- **No AI slop** — test your decoders against real mainnet transactions
  before opening a PR

## License

By contributing, you agree to license your work under [MIT](./LICENSE).
