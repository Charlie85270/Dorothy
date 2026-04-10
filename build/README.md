# build/

Factor-echelon skill pipeline build system. Populated by **Plan 01 (Foundation)**.

Contents after Plan 01 execution:
- `build.ts` — main build orchestrator
- `lib/` — shared build utilities (skill-parser, schemas, validators)
- `targets/` — per-platform build targets (claude-code, openclaw, echelon)

**Note:** This directory also contains `entitlements.mac.plist` for Electron signing.
The build/ directory collision (Electron vs. skill pipeline) is resolved in Phase B.1.

See `docs/specs/2026-04-08-factor-echelon-design.md` for the full specification.
