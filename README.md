# Copilot Chat Replay

A static, local-only viewer for replaying exported GitHub Copilot chat sessions as deterministic
demos.

**Live site:** <https://bwcampbell9.github.io/ai-chat-viewer/>

## Features

- Upload a session history Markdown file or paste its contents.
- Step forward and backward through known user, Copilot, and tool-call output.
- Auto-play a session with each step delay beginning after its reveal animation finishes.
- Choose full autoplay or pause around user turns, including recorded question answers.
- Hide tool and skill activity while keeping recorded questions and answers visible.
- Group consecutive calls into a compact `X tools called` activity.
- Show system notices as compact AI-side activity or hide them independently.
- Replay skill loads and `ask_user` prompts with dedicated selected-choice and free-form answer UI.
- Configure user, Copilot, and tool-call animations with independent typing, shimmer, and fade
  speeds.
- Expand individual tool arguments and results only when needed.
- Collapse the application header and replay controls for a clean presentation view.
- Keep transcript content in the current browser tab; no backend or upload service is used.

Use <https://bwcampbell9.github.io/ai-chat-viewer/?demo=1> to open the built-in sample
conversation.

## Replay controls

Use the replay buttons or the keyboard: `←` and `→` move between activities, `Space` toggles
autoplay, `R` resets the replay, and `M` toggles a distraction-free full-screen view. Keyboard
shortcuts are ignored while editing a field.

## Supported export format

The parser reads GitHub Copilot session exports with elapsed timestamps and User, Copilot, System,
and Tool event headings:

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
is present. Event timestamps in the export are cumulative session offsets; the replay displays the
time since the previous exported activity and keeps the original offset in a hover tooltip. Copilot
Markdown exports do not contain exact tool-execution or model-response durations, so the replay
does not present these intervals as exact durations.

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

## License

This project is licensed under the [MIT License](LICENSE).
