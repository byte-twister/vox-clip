# AGENTS.md
This file is for coding agents working in `vox-clip`.
It captures repository workflow, conventions, and validation steps.

## Project Snapshot
- Type: Chrome extension (Manifest V3), no bundler.
- Stack: plain JavaScript, HTML, CSS.
- Runtime split:
  - `background.js`: service worker, context menu, options open action.
  - `contentScript.js`: selection toolbar, playback state, provider routing.
  - `settings.html` + `settings.js` + `settings.css`: options UI and storage.
- Product intent: built-in browser speech works out-of-the-box; AI providers are optional.

## Rule Precedence (Cursor/Copilot)
- `.cursor/rules/`: not present in this repository.
- `.cursorrules`: not present in this repository.
- `.github/copilot-instructions.md`: not present in this repository.
- If any appear later, treat them as higher-priority repository instructions.

## Build, Lint, Test
There is no `package.json`, Makefile, or CI pipeline at this time.

### Build / Packaging
- No compile step exists.
- Manual package sanity check:
  - `zip -r voxclip.zip manifest.json background.js contentScript.js contentStyles.css settings.html settings.js settings.css`

### Lint / Static Checks
- JS syntax checks:
  - `node --check background.js`
  - `node --check contentScript.js`
  - `node --check settings.js`
- Combined syntax check:
  - `node --check background.js && node --check contentScript.js && node --check settings.js`
- Manifest parse check:
  - `node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('manifest ok')"`
- Diff hygiene:
  - `git diff --check`

### Tests (Current State)
- No automated unit/integration framework is configured.
- Validation is manual in Chrome.

### Running a Single Test
- Automated single-test command is currently unavailable.
- Do a targeted manual behavior check (one behavior per run), such as:
  - selection toolbar appears after text highlight,
  - context menu trigger starts playback,
  - pause/resume toggles state,
  - stop returns controls to idle,
  - provider falls back to built-in when API key is missing,
  - settings persist after reload.

## Manual Validation Workflow
1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click **Load unpacked** and select repo root.
4. Reload extension after each change.
5. Run at least one targeted behavior check relevant to your change.

## Code Style Guidelines
Inferred from the current codebase; follow for consistency.

### Formatting
- Use 2-space indentation.
- End statements with semicolons.
- Prefer double-quoted strings.
- Keep long objects/calls split across lines for readability.
- Use trailing commas in multiline literals where natural.

### Imports / Modules
- Scripts are non-module files loaded by manifest/options page.
- Do not introduce bundler-only patterns.
- Avoid large shared abstractions that require a build system.

### File Organization
- Keep behavior in runtime-appropriate file:
  - background concerns in `background.js`,
  - page interaction/playback in `contentScript.js`,
  - options state/UI in `settings.js`.
- Keep constants near top (`DEFAULT_SETTINGS`, IDs).
- Keep helper functions grouped by concern.

### Naming Conventions
- Use `camelCase` for variables/functions.
- Use `UPPER_SNAKE_CASE` for true constants.
- Favor verb-based function names (`playText`, `updateSelectionToolbar`).
- Keep DOM references in concise maps (`els`, `state`).

### Types and Data Handling
- JavaScript only (no TypeScript).
- Normalize user/config input at boundaries.
- Coerce numeric settings explicitly (`Number(value) || fallback`).
- Trim sensitive/user-provided text values before storage/use.
- Guard optional data with early returns and optional chaining.

### Async and State
- Prefer `async`/`await` over nested callbacks.
- Wrap callback-style Chrome APIs in Promises when reused.
- Keep mutable playback/UI state centralized in one object.
- Reset old playback state before starting new playback.

### Error Handling
- Throw `Error` objects with actionable context.
- Catch near UI boundaries and show concise user-facing status.
- Include provider/API context for network failures when useful.
- Fail safe by returning UI controls to idle state.

### DOM, Accessibility, and UI
- Create toolbar DOM once; update visibility/state afterward.
- Set explicit control attributes (`type`, `role`, `aria-label`).
- Use class prefixes like `voxclip-` to avoid host-page collisions.
- Keep UI updates small and state-driven.

### Chrome Extension Practices
- Keep permissions minimal and intentional in `manifest.json`.
- Limit host permissions to required endpoints.
- Store user settings via `chrome.storage.local`.
- Validate incoming messages by `type` and required payload.

### Security and Secrets
- Never hardcode API keys.
- Treat API keys as sensitive; do not log them.
- Do not print auth headers or full token values.
- Preserve fallback behavior when provider credentials are missing.

### CSS Conventions
- Prefer CSS variables for reusable color/spacing tokens.
- Scope styles with component-specific classes.
- Keep transitions subtle and purposeful.

## Change Management for Agents
- Prefer minimal, surgical edits over broad rewrites.
- Preserve existing behavior unless the task requires a behavior change.
- If tooling is added, update this file with exact commands.
- If a test framework is added, document:
  - all-tests command,
  - single-file command,
  - single-test-by-name command.

## Quick Pre-PR Checklist
- Syntax checks pass.
- Manual behavior checks are completed for changed functionality.
- `manifest.json` permissions remain minimal.
- No secrets are committed.
- Documentation is updated when workflow/conventions change.
