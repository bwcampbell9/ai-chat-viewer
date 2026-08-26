import {
  CheckCircle2,
  ChevronDown,
  Circle,
  FileText,
  LockKeyhole,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  SkipBack,
  Sparkles,
  StepForward,
  Terminal,
  Upload,
  Wrench,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from "react";
import { createPlaybackSteps } from "../parser";
import type {
  AnimationMode,
  PlaybackStep,
  ToolEvent,
  ToolAnimationMode,
  ToolPayload,
  Transcript,
  ViewerSettings,
} from "../types";
import { MarkdownContent } from "./MarkdownContent";
import { SettingsPanel } from "./SettingsPanel";

interface ReplayViewProps {
  transcript: Transcript;
  settings: ViewerSettings;
  onSettingsChange: (settings: ViewerSettings) => void;
  onReplaceSession: () => void;
}

interface ActiveAnimation {
  stepId: string;
  visibleChars: number;
  totalChars: number;
}

type ReplayTimingStyle = CSSProperties & {
  "--cp-shimmer-duration": string;
  "--cp-fade-duration": string;
};

function lastEventId(step?: PlaybackStep): string | undefined {
  if (!step) {
    return undefined;
  }
  return step.kind === "message" ? step.event.id : step.events.at(-1)?.id;
}

function containsEvent(step: PlaybackStep, eventId: string): boolean {
  return step.kind === "message"
    ? step.event.id === eventId
    : step.events.some((event) => event.id === eventId);
}

function statusClass(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized.includes("fail") || normalized.includes("error")) {
    return "failed";
  }
  if (normalized.includes("complete") || normalized.includes("success")) {
    return "completed";
  }
  return "neutral";
}

function PayloadBlock({ label, payload }: { label: string; payload?: ToolPayload }) {
  if (!payload) {
    return null;
  }

  return (
    <section className="tool-payload">
      <span>{label}</span>
      <pre>
        <code data-language={payload.language || undefined}>{payload.content}</code>
      </pre>
    </section>
  );
}

function ToolCall({ event }: { event: ToolEvent }) {
  const [open, setOpen] = useState(false);
  const StatusIcon = statusClass(event.status) === "completed" ? CheckCircle2 : Circle;

  return (
    <details
      className="tool-call"
      onToggle={(toggleEvent) => setOpen(toggleEvent.currentTarget.open)}
    >
      <summary>
        <span className={`tool-status ${statusClass(event.status)}`}>
          <StatusIcon size={14} />
        </span>
        <span className="tool-call-name">{event.name}</span>
        <span className="tool-call-status">{event.status}</span>
        <span className="tool-time">{event.elapsedLabel}</span>
        <ChevronDown className="details-chevron" size={15} />
      </summary>
      {open ? (
        <div className="tool-call-body">
          <PayloadBlock label="Arguments" payload={event.arguments} />
          <PayloadBlock label="Result" payload={event.result} />
        </div>
      ) : null}
    </details>
  );
}

function ToolGroup({
  events,
  animation,
  isLatest,
}: {
  events: ToolEvent[];
  animation: ToolAnimationMode;
  isLatest: boolean;
}) {
  const [open, setOpen] = useState(false);
  const names = [...new Set(events.map((event) => event.name))];
  const failures = events.filter((event) => statusClass(event.status) === "failed").length;
  const summary =
    events.length === 1 ? `${events[0].name} called` : `${events.length} tools called`;
  const animationClass =
    isLatest && animation === "shimmer"
      ? "shimmer-entry"
      : isLatest && animation === "fade"
        ? "fade-entry"
        : "";

  return (
    <details
      className={`tool-group ${animationClass}`.trim()}
      onToggle={(toggleEvent) => setOpen(toggleEvent.currentTarget.open)}
    >
      <summary>
        <span className={`activity-icon ${failures ? "failed" : "completed"}`}>
          {events.length === 1 ? <Terminal size={15} /> : <Wrench size={15} />}
        </span>
        <span className="activity-label">{summary}</span>
        <span className="activity-meta">
          {names.slice(0, 3).join(", ")}
          {names.length > 3 ? ` +${names.length - 3}` : ""}
        </span>
        <span className="tool-time">{events[0].elapsedLabel}</span>
        <ChevronDown className="details-chevron" size={15} />
      </summary>
      {open ? (
        <div className="tool-list">
          {events.map((event) => (
            <ToolCall key={event.id} event={event} />
          ))}
        </div>
      ) : null}
    </details>
  );
}

function MessageEntry({
  step,
  content,
  animation,
  isLatest,
  isTyping,
}: {
  step: Extract<PlaybackStep, { kind: "message" }>;
  content: string;
  animation: AnimationMode;
  isLatest: boolean;
  isTyping: boolean;
}) {
  const { event } = step;
  const animationClass = isLatest && animation === "fade" ? "fade-entry" : "";

  if (event.role === "user") {
    return (
      <article className={`message-entry user-entry ${animationClass}`.trim()}>
        <div className="user-message">
          <MarkdownContent content={content} />
          <span className="message-time">{event.elapsedLabel}</span>
        </div>
        {isTyping ? <span className="typing-cursor" aria-hidden="true" /> : null}
      </article>
    );
  }

  return (
    <article className={`message-entry copilot-entry ${animationClass}`.trim()}>
      <div className="speaker-label">
        <Sparkles size={15} />
        <span>Copilot</span>
        <span className="message-time">{event.elapsedLabel}</span>
      </div>
      <MarkdownContent content={content} />
      {isTyping ? <span className="typing-cursor" aria-hidden="true" /> : null}
    </article>
  );
}

export function ReplayView({
  transcript,
  settings,
  onSettingsChange,
  onReplaceSession,
}: ReplayViewProps) {
  const steps = useMemo(
    () => createPlaybackSteps(transcript.events, settings.collapseTools),
    [settings.collapseTools, transcript.events],
  );
  const [cursor, setCursor] = useState(() => {
    const requestedStep = Number.parseInt(
      new URLSearchParams(window.location.search).get("step") ?? "0",
      10,
    );
    return Number.isFinite(requestedStep)
      ? Math.min(Math.max(requestedStep, 0), steps.length)
      : 0;
  });
  const [playing, setPlaying] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeAnimation, setActiveAnimation] = useState<ActiveAnimation | null>(null);
  const previousStepsRef = useRef(steps);
  const feedEndRef = useRef<HTMLDivElement>(null);

  const toolCount = useMemo(
    () => transcript.events.filter((event) => event.kind === "tool").length,
    [transcript.events],
  );
  const turnCount = transcript.events.length - toolCount;
  const lastVisibleId = lastEventId(previousStepsRef.current[cursor - 1]);

  useEffect(() => {
    if (previousStepsRef.current === steps) {
      return;
    }

    if (lastVisibleId) {
      const nextCursor = steps.findIndex((step) => containsEvent(step, lastVisibleId));
      setCursor(nextCursor < 0 ? 0 : nextCursor + 1);
    }
    previousStepsRef.current = steps;
    setActiveAnimation(null);
  }, [lastVisibleId, steps]);

  useEffect(() => {
    if (!activeAnimation) {
      return;
    }

    const maximumDurationSeconds = 8;
    const effectiveSpeed = Math.max(
      settings.typingSpeed,
      activeAnimation.totalChars / maximumDurationSeconds,
    );
    const charactersPerTick = Math.max(1, Math.ceil(effectiveSpeed / 30));
    const timer = window.setInterval(() => {
      setActiveAnimation((current) => {
        if (!current) {
          return null;
        }
        const nextVisible = Math.min(current.totalChars, current.visibleChars + charactersPerTick);
        return nextVisible >= current.totalChars
          ? null
          : { ...current, visibleChars: nextVisible };
      });
    }, 33);

    return () => window.clearInterval(timer);
  }, [activeAnimation?.stepId, activeAnimation?.totalChars, settings.typingSpeed]);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({
      behavior: activeAnimation ? "auto" : "smooth",
      block: "end",
    });
  }, [activeAnimation?.visibleChars, cursor]);

  const revealNext = useCallback(() => {
    if (cursor >= steps.length) {
      setPlaying(false);
      return;
    }

    const step = steps[cursor];
    setCursor((current) => current + 1);

    if (step.kind === "message") {
      const mode =
        step.event.role === "user" ? settings.userAnimation : settings.copilotAnimation;
      if (mode === "typewriter" && step.event.rawContent) {
        setActiveAnimation({
          stepId: step.id,
          visibleChars: 0,
          totalChars: step.event.rawContent.length,
        });
      }
    }
  }, [
    cursor,
    settings.copilotAnimation,
    settings.userAnimation,
    steps,
  ]);

  const next = useCallback(() => {
    if (activeAnimation) {
      setActiveAnimation(null);
      return;
    }
    revealNext();
  }, [activeAnimation, revealNext]);

  const previous = useCallback(() => {
    setPlaying(false);
    setActiveAnimation(null);
    setCursor((current) => Math.max(0, current - 1));
  }, []);

  const restart = useCallback(() => {
    setPlaying(false);
    setActiveAnimation(null);
    setCursor(0);
  }, []);

  const togglePlayback = useCallback(() => {
    if (cursor >= steps.length) {
      setCursor(0);
      setActiveAnimation(null);
      setPlaying(true);
      return;
    }
    setPlaying((current) => !current);
  }, [cursor, steps.length]);

  useEffect(() => {
    if (!playing || activeAnimation) {
      return;
    }
    if (cursor >= steps.length) {
      setPlaying(false);
      return;
    }

    const timer = window.setTimeout(revealNext, cursor === 0 ? 250 : settings.autoAdvanceDelay);
    return () => window.clearTimeout(timer);
  }, [
    activeAnimation,
    cursor,
    playing,
    revealNext,
    settings.autoAdvanceDelay,
    steps.length,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, button, summary")) {
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        next();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        previous();
      } else if (event.key === " ") {
        event.preventDefault();
        togglePlayback();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [next, previous, togglePlayback]);

  const seek = (event: ChangeEvent<HTMLInputElement>) => {
    setPlaying(false);
    setActiveAnimation(null);
    setCursor(Number(event.target.value));
  };

  const visibleSteps = steps.slice(0, cursor);
  const latestStep = visibleSteps.at(-1);
  const progress = steps.length ? Math.round((cursor / steps.length) * 100) : 0;
  const replayTimingStyle: ReplayTimingStyle = {
    "--cp-shimmer-duration": `${settings.shimmerDuration}ms`,
    "--cp-fade-duration": `${settings.fadeDuration}ms`,
  };

  return (
    <div className="replay-page" style={replayTimingStyle}>
      <header className="app-header replay-header">
        <a className="brand" href="./" aria-label="Copilot Chat Replay home">
          <span className="brand-mark" aria-hidden="true">
            <Sparkles size={17} />
          </span>
          <span>Copilot Chat Replay</span>
        </a>
        <div className="header-actions">
          <span className="local-badge">
            <LockKeyhole size={14} />
            Local only
          </span>
          <button className="secondary-button" type="button" onClick={onReplaceSession}>
            <Upload size={15} />
            Import
          </button>
          <button
            className="secondary-button settings-button"
            type="button"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 size={15} />
            Settings
          </button>
        </div>
      </header>

      <main className="replay-main">
        <section className="session-heading" aria-labelledby="session-title">
          <div>
            <span className="eyebrow">
              <FileText size={15} />
              {transcript.sourceName}
            </span>
            <h1 id="session-title">{transcript.title}</h1>
            <p>
              {turnCount} messages · {toolCount} tool calls
              {transcript.metadata.duration ? ` · ${transcript.metadata.duration}` : ""}
            </p>
          </div>
          <span className="progress-label">{progress}% replayed</span>
        </section>

        <section className="conversation-shell" aria-label="Conversation replay">
          <div className="conversation-feed" aria-live="polite">
            <div className="feed-context">
              <div className="activity-entry context-entry">
                <span className="activity-icon completed">
                  <CheckCircle2 size={15} />
                </span>
                <span className="activity-label">Session loaded</span>
                <span className="activity-meta">{transcript.sourceName}</span>
              </div>
              <div className="activity-entry context-entry">
                <span className="activity-icon neutral">
                  <Circle size={14} />
                </span>
                <span className="activity-label">Copilot session started</span>
                {transcript.metadata.started ? (
                  <span className="activity-meta">{transcript.metadata.started}</span>
                ) : null}
              </div>
            </div>

            {!visibleSteps.length ? (
              <div className="replay-ready">
                <span className="replay-ready-icon">
                  <Play size={20} />
                </span>
                <strong>Ready to replay</strong>
                <span>Use Start or the right arrow key to reveal the first turn.</span>
                <button className="primary-button" type="button" onClick={next}>
                  <Play size={16} />
                  Start replay
                </button>
              </div>
            ) : null}

            {visibleSteps.map((step) => {
              if (step.kind === "tools") {
                return (
                  <ToolGroup
                    key={step.id}
                    events={step.events}
                    animation={settings.toolAnimation}
                    isLatest={latestStep?.id === step.id}
                  />
                );
              }

              const isTyping = activeAnimation?.stepId === step.id;
              const content = isTyping
                ? step.event.rawContent.slice(0, activeAnimation.visibleChars)
                : step.event.rawContent;
              const animation =
                step.event.role === "user"
                  ? settings.userAnimation
                  : settings.copilotAnimation;

              return (
                <MessageEntry
                  key={step.id}
                  step={step}
                  content={content}
                  animation={animation}
                  isLatest={latestStep?.id === step.id}
                  isTyping={isTyping}
                />
              );
            })}
            <div ref={feedEndRef} className="feed-end" />
          </div>

          <div className="playback-bar">
            <div className="timeline-row">
              <span>
                Step {cursor} of {steps.length}
              </span>
              <input
                aria-label="Replay position"
                type="range"
                min="0"
                max={steps.length}
                value={cursor}
                onChange={seek}
              />
              <span>{progress}%</span>
            </div>
            <div className="playback-controls">
              <button className="icon-button" type="button" aria-label="Restart" onClick={restart}>
                <RotateCcw size={17} />
              </button>
              <button
                className="icon-button"
                type="button"
                aria-label="Previous activity"
                disabled={cursor === 0}
                onClick={previous}
              >
                <SkipBack size={17} />
              </button>
              <button
                className="play-button"
                type="button"
                aria-label={playing ? "Pause autoplay" : "Start autoplay"}
                onClick={togglePlayback}
              >
                {playing ? <Pause size={18} /> : <Play size={18} />}
                {playing ? "Pause" : "Auto play"}
              </button>
              <button
                className="next-button"
                type="button"
                disabled={!activeAnimation && cursor >= steps.length}
                onClick={next}
              >
                {activeAnimation ? "Skip typing" : cursor >= steps.length ? "Complete" : "Next"}
                <StepForward size={17} />
              </button>
            </div>
            <span className="keyboard-hint">← previous · space autoplay · next →</span>
          </div>
        </section>
      </main>

      {settingsOpen ? (
        <SettingsPanel
          settings={settings}
          onChange={onSettingsChange}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </div>
  );
}
