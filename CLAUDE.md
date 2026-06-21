# CLAUDE.md — pi monorepo

Working directory: `c:\Work\pi`
Branch convention: `feature/<short-slug>` off `main`

## What this repo is

Pi agent harness — a monorepo of four packages:

| Package | npm name | Purpose |
|---------|----------|---------|
| `packages/ai` | `@earendil-works/pi-ai` | Unified multi-provider LLM streaming API |
| `packages/agent` | `@earendil-works/pi-agent-core` | Agent runtime, tool calling, state |
| `packages/coding-agent` | `@earendil-works/pi-coding-agent` | Interactive coding agent CLI |
| `packages/tui` | `@earendil-works/pi-tui` | Terminal UI with differential rendering |

## Environment setup

```powershell
# Node >= 22.19.0 required (v26.3.1 currently installed)
npm install --ignore-scripts   # install deps, no lifecycle scripts
npm run build                  # builds tui → ai → agent → coding-agent in order
.\pi-test.ps1 --version        # smoke test from sources (Windows)
```

### Running tests (requires bash / WSL)

```bash
# WSL must be installed first (wsl --install in an elevated terminal, then reboot)
wsl bash test.sh               # run full non-e2e suite with API keys cleared
```

On Windows without WSL: run individual package tests from the package root:
```powershell
cd packages/ai
node ../../node_modules/vitest/dist/cli.js --run test/specific.test.ts
```

## Code rules (from AGENTS.md — read that file too)

- **TypeScript**: erasable-only syntax (Node strip mode). No `enum`, `namespace`, `module`, `import =`, `export =`, parameter properties. Use explicit fields + constructor assignment.
- **No `any`** unless absolutely necessary.
- **Top-level imports only** — no `await import()` inside functions, no inline type imports.
- **Inline single-use helpers** — no premature abstractions.
- **No backward-compat shims** unless asked.
- Run `npm run check` after every code change (not tests). Fix all errors, warnings, and infos before committing.
- Never `npm run build` or `npm test` unless requested.
- Check `node_modules` for external API types — never guess shapes.
- Never edit `packages/ai/src/models.generated.ts` directly; edit `packages/ai/scripts/generate-models.ts` and regenerate.

## Formatting / linting

Biome (`biome.json` at root). `npm run check` runs Biome + pinned-dep check + TS import check + shrinkwrap check + `tsgo --noEmit`.

## Dependency hygiene

- All direct external deps pinned to exact versions (`save-exact=true` in `.npmrc`).
- Workspace packages stay version-ranged.
- `npm install --ignore-scripts` for hydration; `npm ci --ignore-scripts` for clean installs.
- New deps with lifecycle scripts need an explicit allowlist entry in `scripts/generate-coding-agent-shrinkwrap.mjs`.
- Pre-commit hook blocks lockfile commits unless `PI_ALLOW_LOCKFILE_CHANGE=1`.

## Git conventions

Commit format: `{feat,fix,docs}[(ai,tui,agent,coding-agent)]: <message>`

Examples:
```
feat(ai): add ollama provider
fix(coding-agent): handle empty tool result in stream
docs(ai): document ollama setup in providers.md
```

**Never**: `git add -A`, `git add .`, `git reset --hard`, `git checkout .`, `git commit --no-verify`.
**Always**: stage explicit paths only (`git add <path1> <path2>`).
`packages/ai/src/models.generated.ts` may always be staged alongside your files.

## How providers work in `packages/ai`

The AI package is the focus for the Ollama adapter. Key files:

| File | Role |
|------|------|
| `src/types.ts` | `KnownApi`, `KnownProvider`, `StreamOptions`, `ApiOptionsMap` |
| `src/providers/<name>.ts` | Provider implementation (stream + streamSimple + register()) |
| `src/providers/register-builtins.ts` | Lazy-loads and registers all providers |
| `src/env-api-keys.ts` | Maps provider names to env var names |
| `src/models.generated.ts` | Auto-generated model list (do not edit manually) |
| `scripts/generate-models.ts` | Source of truth for model generation |
| `package.json` exports | Subpath export per provider (`./ollama`) |

Provider pattern (see `openai-completions.ts` as reference — Ollama is OpenAI-compatible):
1. Export options interface extending `StreamOptions`
2. Export `stream<Name>()` returning `AssistantMessageEventStream`
3. Export `streamSimple<Name>()` accepting `SimpleStreamOptions`
4. Export `register()` that calls `registerApiProvider({ api, stream, streamSimple })`

Registration is **lazy**: `register-builtins.ts` wraps each provider in `createLazyApiProvider()` — the actual module is only imported when first called.

## Ollama adapter plan

Ollama exposes an OpenAI-compatible `/v1/chat/completions` endpoint at `http://localhost:11434`. The adapter reuses the `openai-completions` API type with a custom base URL.

Files to touch in order (follow `add-llm-provider.md` skill checklist at `.pi/skills/add-llm-provider.md`):

1. **`packages/ai/src/types.ts`** — add `"ollama"` to `KnownProvider`
2. **`packages/ai/src/providers/ollama.ts`** — new file; thin wrapper over `openai-completions` logic with `baseUrl` defaulting to `http://localhost:11434/v1` (overridable via `OLLAMA_HOST` env var)
3. **`packages/ai/src/providers/register-builtins.ts`** — lazy-register the ollama provider under `"openai-completions"` api
4. **`packages/ai/package.json`** — add `"./ollama"` subpath export
5. **`packages/ai/src/index.ts`** — re-export Ollama option types
6. **`packages/ai/src/env-api-keys.ts`** — Ollama is local/keyless, return `"<authenticated>"` when `OLLAMA_HOST` or default localhost is reachable (or simply skip — no key needed)
7. **`packages/ai/scripts/generate-models.ts`** — fetch models from `OLLAMA_HOST/api/tags` at generation time; gate behind `PI_NO_LOCAL_LLM` (already used in `test.sh`)
8. **`packages/coding-agent/src/core/model-resolver.ts`** — add `ollama: "llama3.2"` default
9. **`packages/coding-agent/src/core/provider-display-names.ts`** — add display name
10. **`packages/coding-agent/src/cli/args.ts`** — document `OLLAMA_HOST` env var
11. **`packages/coding-agent/README.md`** + **`docs/providers.md`** — setup instructions
12. **Tests** — add to `stream.test.ts`, `tokens.test.ts`, `abort.test.ts`, `empty.test.ts`, `cross-provider-handoff.test.ts` (gate with `PI_NO_LOCAL_LLM`)

## Contribution gate

This repo auto-closes new contributor issues and PRs. Maintainers review daily.
- `lgtmi` from a maintainer = your issues won't be auto-closed
- `lgtm` from a maintainer = your issues AND PRs won't be auto-closed

Do not open a PR until you have `lgtm`. Open an issue first describing the Ollama adapter (concisely, one screen max, in your own voice).

## Useful scripts

```powershell
.\pi-test.ps1                          # run pi from sources (interactive)
.\pi-test.ps1 --list-models            # list all known models
.\pi-test.ps1 -p "Say exactly: ok"     # one-shot prompt
npm run check                          # lint + type check (run after every change)
node scripts/generate-coding-agent-shrinkwrap.mjs --check  # verify shrinkwrap
```

## Where to find things

- Contribution rules: `CONTRIBUTING.md`, `AGENTS.md`
- Provider how-to checklist: `.pi/skills/add-llm-provider.md`
- Existing OpenAI-compat provider (reference): `packages/ai/src/providers/openai-completions.ts`
- Cloudflare provider (custom base URL pattern): `packages/ai/src/providers/cloudflare.ts`
- Test matrix: `packages/ai/test/stream.test.ts`, `cross-provider-handoff.test.ts`
- Coding agent docs: `packages/coding-agent/docs/providers.md`, `docs/custom-provider.md`
- RFCs: https://rfc.earendil.com/keyword/pi/
- Discord: https://discord.com/invite/3cU7Bz4UPx
