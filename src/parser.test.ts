import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createPlaybackSteps, parseElapsedSeconds, parseTranscript } from "./parser";
import { demoTranscript } from "./demoTranscript";

describe("parseTranscript", () => {
  it("parses metadata, messages, and tool payloads", () => {
    const transcript = parseTranscript(demoTranscript, "demo.md");

    expect(transcript.title).toBe("Prepare a release summary");
    expect(transcript.metadata.sessionId).toBe("demo-session-001");
    expect(transcript.events).toHaveLength(10);
    expect(transcript.events[0]).toMatchObject({
      kind: "message",
      role: "user",
      elapsedSeconds: 0,
      intervalLabel: "—",
      intervalSeconds: null,
    });
    expect(transcript.events[1]).toMatchObject({
      kind: "skill",
      skill: "release-note-writer",
      intervalLabel: "1s",
    });
    expect(transcript.events[3]).toMatchObject({
      kind: "tool",
      name: "powershell",
      status: "Completed",
      arguments: { language: "json" },
      result: { language: "text" },
    });
    expect(transcript.events[6]).toMatchObject({
      kind: "ask-user",
      answer: "Match the existing changelog style (Recommended)",
    });
    expect(transcript.events[8]).toMatchObject({
      kind: "ask-user",
      answer: "Internal platform maintainers",
    });
  });

  it("collapses only consecutive tool calls", () => {
    const transcript = parseTranscript(demoTranscript);
    const collapsed = createPlaybackSteps(transcript.events, true);
    const expanded = createPlaybackSteps(transcript.events, false);

    expect(collapsed).toHaveLength(11);
    expect(collapsed[3]).toMatchObject({ kind: "tools" });
    if (collapsed[3].kind === "tools") {
      expect(collapsed[3].events).toHaveLength(2);
    }
    expect(expanded).toHaveLength(12);
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

  it("parses system messages as standalone playback activity", () => {
    const transcript = parseTranscript(`System notice

---

<sub>20s</sub>

## User

Check the status

---

<sub>18s</sub>

## System

MCP server "es chat" requires sign-in.

---

<sub>28s</sub>

## Copilot

I’ll continue after sign-in.`);

    expect(transcript.events).toHaveLength(3);
    expect(transcript.events[0]).toMatchObject({
      kind: "message",
      rawContent: "Check the status",
      intervalLabel: "—",
    });
    expect(transcript.events[1]).toMatchObject({
      kind: "system",
      rawContent: 'MCP server "es chat" requires sign-in.',
      intervalLabel: "—",
    });
    expect(transcript.events[2]).toMatchObject({ intervalLabel: "10s", intervalSeconds: 10 });
    expect(createPlaybackSteps(transcript.events, true).map((step) => step.kind)).toEqual([
      "message",
      "system",
      "message",
    ]);
  });

  it("parses skill loads and splits questions from their selected answers", () => {
    const transcript = parseTranscript(`Special tools

---

<sub>0s</sub>

## User

Start

---

<sub>1s</sub>

## Tool: skill - Completed

**Arguments**

\`\`\`json
{ "skill": "elm-repository-migration" }
\`\`\`

**Result**

\`\`\`text
Skill loaded.
\`\`\`

---

<sub>2s</sub>

## Tool: ask_user - Completed

**Arguments**

\`\`\`json
{
  "question": "Continue?",
  "choices": ["Yes", "No"]
}
\`\`\`

**Result**

\`\`\`text
User selected: Yes
\`\`\``);

    expect(transcript.events[1]).toMatchObject({
      kind: "skill",
      skill: "elm-repository-migration",
    });
    expect(transcript.events[2]).toMatchObject({
      kind: "ask-user",
      question: "Continue?",
      choices: ["Yes", "No"],
      answer: "Yes",
    });
    expect(createPlaybackSteps(transcript.events, true).map((step) => step.kind)).toEqual([
      "message",
      "skill",
      "question",
      "answer",
    ]);
  });

  it("derives intervals from the previous event and handles equal timestamps", () => {
    const transcript = parseTranscript(`Event durations

---

<sub>0s</sub>

## User

Start

---

<sub>5s</sub>

## Copilot

I’ll run two tools.

---

<sub>5s</sub>

## Tool: first - Completed

Done

---

<sub>5s</sub>

## Tool: second - Completed

Done

---

<sub>12s</sub>

## Copilot

Finished`);

    expect(
      transcript.events.map((event) => [event.intervalLabel, event.intervalSeconds]),
    ).toEqual([
      ["—", null],
      ["5s", 5],
      ["<1s", 0],
      ["<1s", 0],
      ["7s", 7],
    ]);
  });

  it("preserves free-form answers that are not listed choices", () => {
    const transcript = parseTranscript(`Free-form answer

---

<sub>0s</sub>

## Tool: ask_user - Completed

**Arguments**

\`\`\`json
{
  "question": "Which repository?",
  "choices": ["One", "Two"]
}
\`\`\`

**Result**

\`\`\`text
User answered: A custom repository
\`\`\``);

    expect(transcript.events[0]).toMatchObject({
      kind: "ask-user",
      answer: "A custom repository",
    });
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
    expect(transcript.events.filter((event) => event.kind !== "message")).toHaveLength(172);
    expect(transcript.events.filter((event) => event.kind === "message")).toHaveLength(30);
  });
});

const interactiveSample = process.env.INTERACTIVE_SAMPLE_TRANSCRIPT;

describe.skipIf(!interactiveSample)("interactive tool transcript", () => {
  it("parses the provided skill and question interaction", () => {
    const transcript = parseTranscript(
      readFileSync(interactiveSample!, "utf8"),
      "elm-repository-migration.md",
    );

    expect(transcript.events).toContainEqual(
      expect.objectContaining({
        kind: "skill",
        skill: "elm-repository-migration",
      }),
    );
    expect(transcript.events).toContainEqual(
      expect.objectContaining({
        kind: "ask-user",
        answer: "Yes, continue with this repository (Recommended)",
      }),
    );
  });
});

const systemSample = process.env.SYSTEM_SAMPLE_TRANSCRIPT;

describe.skipIf(!systemSample)("system message transcript", () => {
  it("parses the provided system notice independently from user content", () => {
    const transcript = parseTranscript(readFileSync(systemSample!, "utf8"), "elm-migration-full.md");
    const systemEvents = transcript.events.filter((event) => event.kind === "system");

    expect(systemEvents).toHaveLength(1);
    expect(systemEvents[0]).toMatchObject({
      rawContent: 'MCP server "es chat" requires sign-in.',
      intervalLabel: "—",
    });
    expect(
      transcript.events.find(
        (event) =>
          event.kind === "message" &&
          event.role === "copilot" &&
          event.elapsedLabel === "2h 24m 28s",
      ),
    ).toMatchObject({
      intervalLabel: "10s",
    });
    expect(
      transcript.events
        .filter((event) => event.kind === "message" && event.role === "copilot")
        .slice(0, 3)
        .map((event) => event.intervalLabel),
    ).toEqual(["11s", "17s", "35s"]);
    expect(
      transcript.events.find(
        (event) => event.kind === "message" && event.rawContent === "Check the status",
      ),
    ).toBeDefined();
  });
});
