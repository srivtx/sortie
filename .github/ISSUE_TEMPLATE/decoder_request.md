---
name: Add protocol decoder
about: Add a new Solana program to the failure decoder
title: "[decoder] "
labels: enhancement
assignees: srivtx
---

## Protocol

- **Name:**
- **Program ID:** `<!-- paste the base58 program ID -->`
- **Website:**
- **GitHub:**

## Source of error codes

<!-- Where did you get the error code mappings? Link to docs, IDL, GitHub issues, etc. -->

## Error codes

<!-- Paste the error code → message mapping here, or link to the source -->

```ts
const errors: Record<number, string> = {
  0: '',
  1: '',
  // ...
};
```

## Test transactions

<!-- Real mainnet transactions that show the decoder working -->

| Signature | Error code | Expected message |
|-----------|-----------|------------------|
| | | |

## Checklist

- [ ] I have a decoder file ready in `lib/parser/protocols/<name>.ts`
- [ ] I have tested it with real mainnet transactions
- [ ] I have registered it in `lib/parser/protocols/index.ts`
- [ ] I have cited the source of the error codes
