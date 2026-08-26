import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createPlaybackSteps, parseElapsedSeconds, parseTranscript } from "./parser";
import { demoTranscript } from "./demoTranscript";

describe("parseTranscript", () => {
  it("parses metadata, messages, and tool payloads", () => {
    const transcript = parseTranscript(demoTranscript, "demo.md");

    expect(transcript.title).toBe("Prepare a release summary");
    expect(transcript.metadata.sessionId).toBe("demo-session-001");
    expect(transcript.events).toHaveLength(7);
    expect(transcript.events[0]).toMatchObject({
      kind: "message",
      role: "user",
      elapsedSeconds: 0,
    });
    expect(transcript.events[2]).toMatchObject({
      kind: "tool",
      name: "powershell",
      status: "Completed",
      arguments: { language: "json" },
      result: { language: "text" },
    });
  });

  it("collapses only consecutive tool calls", () => {
    const transcript = parseTranscript(demoTranscript);
    const collapsed = createPlaybackSteps(transcript.events, true);
    const expanded = createPlaybackSteps(transcript.events, false);

    expect(collapsed).toHaveLength(6);
    expect(collapsed[2]).toMatchObject({ kind: "tools" });
    if (collapsed[2].kind === "tools") {
      expect(collapsed[2].events).toHaveLength(2);
    }
    expect(expanded).toHaveLength(7);
  });

  it("does not treat headings inside fenced tool results as events", () => {
    const transcript = parseTranscript(`Mark

---

<sub>0s</sub>

## User

Start

---

<sub>1s</sub>

## Tool: view - Completed

**Result**

\`\`\`\`text
## Copilot

---

\`\`\`nested\`\`\`
\`\`\`\`

---

<sub>2s</sub>

## Copilot

Done`);

    expect(transcript.events).toHaveLength(3);
    expect(transcript.events[1]).toMatchObject({ kind: "tool", name: "view" });
  });
});

describe("parseElapsedSeconds", () => {
  it("supports compound elapsed times", () => {
    expect(parseElapsedSeconds("1d 2h 3m 4s")).toBe(93_784);
  });
});

const externalSample = process.env.SAMPLE_TRANSCRIPT;

describe.skipIf(!externalSample)("provided transcript", () => {
  it("parses the full exported session", () => {
    const transcript = parseTranscript(readFileSync(externalSample!, "utf8"), "mirror-azure-pr.md");

    expect(transcript.events).toHaveLength(202);
    expect(transcript.events.filter((event) => event.kind === "tool")).toHaveLength(172);
    expect(transcript.events.filter((event) => event.kind === "message")).toHaveLength(30);
  });
});
