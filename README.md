# Copilot Chat Replay

A static, local-only viewer for replaying exported GitHub Copilot chat sessions as deterministic
demos.

**Live site:** <https://bwcampbell9.github.io/ai-chat-viewer/>

## Features

- Upload a session history Markdown file or paste its contents.
- Step forward and backward through known user, Copilot, and tool-call output.
- Auto-play a session without waiting for model inference.
- Group consecutive tool calls into a compact `X tools called` activity.
- Configure user, Copilot, and tool-call animations independently.
- Expand individual tool arguments and results only when needed.
- Keep transcript content in the current browser tab; no backend or upload service is used.

Use <https://bwcampbell9.github.io/ai-chat-viewer/?demo=1> to open the built-in sample
conversation.

## Supported export format

The parser reads GitHub Copilot session exports with elapsed timestamps and event headings:

````markdown
<sub>0s</sub>

## User

Create a release summary.

---

<sub>3s</sub>

## Copilot

I’ll inspect the branch first.

---

<sub>4s</sub>

## Tool: powershell - Completed

**Arguments**

```json
{ "command": "git diff --stat main...HEAD" }
```

**Result**

```text
4 files changed
```
````

Session metadata such as `Session ID`, `Started`, `Duration`, and `Exported` is displayed when it
is present.

## Development

```powershell
npm ci
npm run dev
```

Run the parser tests and production build:

```powershell
npm test
npm run build
```

GitHub Actions deploys `dist` to GitHub Pages after pushes to `main` or the initial feature branch.
