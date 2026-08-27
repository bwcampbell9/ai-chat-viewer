import {
  BookOpenCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleHelp,
  FileText,
  Info,
  LockKeyhole,
  Pause,
  PanelBottomClose,
  PanelBottomOpen,
  PanelTopClose,
  PanelTopOpen,
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
import {
  BASE_FADE_DURATION,
  BASE_SHIMMER_DURATION,
  durationForSpeed,
} from "../settings";
import type {
  AiResponseAutoplayMode,
  AnimationMode,
  AskUserEvent,
  PlaybackStep,
  SkillEvent,
  SystemEvent,
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

type PlaybackMode = "stopped" | "all" | "ai-responses";
type RevealSource = "manual" | "automatic";

type ReplayTimingStyle = CSSProperties & {
  "--cp-shimmer-duration": string;
  "--cp-fade-duration": string;
};

function lastEventIndex(step?: PlaybackStep): number | undefined {
  if (!step) {
    return undefined;
  }
  return step.kind === "tools" ? step.events.at(-1)?.index : step.event.index;
}

function isUserTurnStep(step?: PlaybackStep): boolean {
  return (
    step?.kind === "answer" || (step?.kind === "message" && step.event.role === "user")
  );
}

function hasCssStepAnimation(step: PlaybackStep, settings: ViewerSettings): boolean {
  if (step.kind === "tools" || step.kind === "skill" || step.kind === "system") {
    return settings.toolAnimation !== "none";
  }
  if (step.kind === "question") {
    return settings.userAnimation === "fade";
  }
  if (step.kind === "answer") {
    return true;
  }
  if (step.kind === "message") {
    const animation =
      step.event.role === "user" ? settings.userAnimation : settings.copilotAnimation;
    return animation === "fade";
  }
  return false;
}

function pausesBeforeUser(mode: AiResponseAutoplayMode): boolean {
  return mode === "before-user" || mode === "before-and-after";
}

function pausesAfterUser(mode: AiResponseAutoplayMode): boolean {
  return mode === "after-user" || mode === "before-and-after";
}

function toolAnimationClass(isLatest: boolean, animation: ToolAnimationMode): string {
  if (!isLatest) {
    return "";
  }
  if (animation === "shimmer") {
    return "shimmer-entry";
  }
  return animation === "fade" ? "fade-entry" : "";
}

function messageAnimationClass(isLatest: boolean, animation: AnimationMode): string {
  return isLatest && animation === "fade" ? "fade-entry" : "";
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
  const animationClass = toolAnimationClass(isLatest, animation);

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

function SkillEntry({
  event,
  animation,
  isLatest,
}: {
  event: SkillEvent;
  animation: ToolAnimationMode;
  isLatest: boolean;
}) {
  return (
    <div
      className={`activity-entry skill-entry ${toolAnimationClass(isLatest, animation)}`.trim()}
    >
      <span className="activity-icon completed">
        <BookOpenCheck size={15} />
      </span>
      <span className="activity-label">Loaded skill</span>
      <span className="activity-meta">{event.skill}</span>
      <span className="tool-time">{event.elapsedLabel}</span>
    </div>
  );
}

function SystemEntry({
  event,
  animation,
  isLatest,
}: {
  event: SystemEvent;
  animation: ToolAnimationMode;
  isLatest: boolean;
}) {
  return (
    <aside
      className={`activity-entry system-entry ${toolAnimationClass(isLatest, animation)}`.trim()}
      aria-label="System message"
    >
      <span className="activity-icon neutral">
        <Info size={15} />
      </span>
      <span className="activity-label">System</span>
      <div className="activity-meta">{event.rawContent}</div>
      <span className="tool-time">{event.elapsedLabel}</span>
    </aside>
  );
}

function AskUserEntry({
  event,
  answered,
  questionContent,
  animation,
  isLatest,
  isTyping,
}: {
  event: AskUserEvent;
  answered: boolean;
  questionContent: string;
  animation: AnimationMode;
  isLatest: boolean;
  isTyping: boolean;
}) {
  const selectedChoice =
    answered && event.answer
      ? event.choices.find((choice) => choice === event.answer)
      : undefined;
  const freeformAnswer =
    event.answer && !event.choices.includes(event.answer) ? event.answer : undefined;
  const animationClass = answered ? "" : messageAnimationClass(isLatest, animation);

  return (
    <article
      className={`ask-user-entry ${answered ? "answered" : ""} ${animationClass}`.trim()}
      aria-label={answered ? "Question answered" : "Question"}
    >
      <div className="ask-user-label">
        <CircleHelp size={15} />
        <span className="ask-user-state-label">
          <span className={answered ? "" : "active"} aria-hidden={answered}>
            Question
          </span>
          <span className={answered ? "active" : ""} aria-hidden={!answered}>
            Answer recorded
          </span>
        </span>
        <span className="message-time">{event.elapsedLabel}</span>
      </div>
      <div className="ask-user-card">
        <div className="ask-user-question-content">
          <MarkdownContent content={questionContent} className="ask-user-question" />
          {isTyping ? <span className="typing-cursor" aria-hidden="true" /> : null}
        </div>
        {event.choices.length ? (
          <div className="answer-options" role="list" aria-label="Response options">
            {event.choices.map((choice, index) => {
              const selected = choice === selectedChoice;
              return (
                <div
                  key={`${index}:${choice}`}
                  className={`answer-option ${selected ? "selected" : ""}`.trim()}
                  role="listitem"
                >
                  <span className="answer-option-marker" aria-hidden="true">
                    {selected ? <Check size={12} /> : <Circle size={12} />}
                  </span>
                  <span>{choice}</span>
                  <span className="answer-option-state" aria-hidden={!selected}>
                    Selected
                  </span>
                </div>
              );
            })}
          </div>
        ) : !answered ? (
          <div className="freeform-prompt">Free-form response</div>
        ) : null}
        {answered && freeformAnswer ? (
          <div className="freeform-answer">
            <span>Free-form answer</span>
            <strong>{freeformAnswer}</strong>
          </div>
        ) : null}
      </div>
    </article>
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
  const animationClass = messageAnimationClass(isLatest, animation);

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
  const playbackEvents = useMemo(
    () =>
      transcript.events.filter((event) => {
        if (event.kind === "message" || event.kind === "ask-user") {
          return true;
        }
        if (event.kind === "system") {
          return settings.showSystemMessages;
        }
        return settings.showTools;
      }),
    [settings.showSystemMessages, settings.showTools, transcript.events],
  );
  const steps = useMemo(
    () => createPlaybackSteps(playbackEvents, settings.collapseTools),
    [playbackEvents, settings.collapseTools],
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
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>("stopped");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [controlsCollapsed, setControlsCollapsed] = useState(false);
  const [activeAnimation, setActiveAnimation] = useState<ActiveAnimation | null>(null);
  const [pendingVisualAnimation, setPendingVisualAnimation] = useState<string | null>(null);
  const previousStepsRef = useRef(steps);
  const feedEndRef = useRef<HTMLDivElement>(null);

  const turnCount = useMemo(
    () => transcript.events.filter((event) => event.kind === "message").length,
    [transcript.events],
  );
  const systemCount = useMemo(
    () => transcript.events.filter((event) => event.kind === "system").length,
    [transcript.events],
  );
  const questionCount = useMemo(
    () => transcript.events.filter((event) => event.kind === "ask-user").length,
    [transcript.events],
  );
  const toolCount = transcript.events.length - turnCount - systemCount - questionCount;
  const lastVisibleStep = previousStepsRef.current[cursor - 1];
  const lastVisibleStepId = lastVisibleStep?.id;
  const lastVisibleIndex = lastEventIndex(lastVisibleStep);

  useEffect(() => {
    if (previousStepsRef.current === steps) {
      return;
    }

    const matchingStepIndex = lastVisibleStepId
      ? steps.findIndex((step) => step.id === lastVisibleStepId)
      : -1;
    if (matchingStepIndex >= 0) {
      setCursor(matchingStepIndex + 1);
    } else if (lastVisibleIndex !== undefined) {
      const nextCursor = steps.filter(
        (step) => (lastEventIndex(step) ?? Number.POSITIVE_INFINITY) <= lastVisibleIndex,
      ).length;
      setCursor(nextCursor);
    }
    previousStepsRef.current = steps;
    setActiveAnimation(null);
    setPendingVisualAnimation(null);
  }, [lastVisibleIndex, lastVisibleStepId, steps]);

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

  useEffect(() => {
    if (!pendingVisualAnimation) {
      return;
    }

    let cancelled = false;
    const clearPendingAnimation = () => {
      if (!cancelled) {
        setPendingVisualAnimation((current) =>
          current === pendingVisualAnimation ? null : current,
        );
      }
    };
    const frame = window.requestAnimationFrame(() => {
      const animationRoot = feedEndRef.current?.previousElementSibling;
      if (!animationRoot) {
        clearPendingAnimation();
        return;
      }

      const animations = animationRoot
        .getAnimations({ subtree: true })
        .filter((animation) => animation.playState === "running");
      if (!animations.length) {
        clearPendingAnimation();
        return;
      }

      void Promise.allSettled(animations.map((animation) => animation.finished)).then(
        clearPendingAnimation,
      );
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [pendingVisualAnimation]);

  const revealNext = useCallback((source: RevealSource) => {
    if (cursor >= steps.length) {
      setPlaybackMode("stopped");
      setPendingVisualAnimation(null);
      return;
    }

    const step = steps[cursor];
    const previousStep = steps[cursor - 1];
    const autoplayMode = settings.aiResponseAutoplay;
    setCursor((current) => current + 1);
    setPendingVisualAnimation(hasCssStepAnimation(step, settings) ? step.id : null);

    if (
      playbackMode === "ai-responses" &&
      isUserTurnStep(step) &&
      pausesAfterUser(autoplayMode)
    ) {
      setPlaybackMode("stopped");
    } else if (
      source === "manual" &&
      playbackMode !== "all" &&
      autoplayMode !== "off"
    ) {
      if (autoplayMode === "continuous") {
        setPlaybackMode("ai-responses");
      } else if (isUserTurnStep(step) && !pausesAfterUser(autoplayMode)) {
        setPlaybackMode("ai-responses");
      } else if (
        !isUserTurnStep(step) &&
        playbackMode === "stopped" &&
        isUserTurnStep(previousStep)
      ) {
        setPlaybackMode("ai-responses");
      }
    }

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
    } else if (
      step.kind === "question" &&
      settings.userAnimation === "typewriter" &&
      step.event.question
    ) {
      setActiveAnimation({
        stepId: step.id,
        visibleChars: 0,
        totalChars: step.event.question.length,
      });
    }
  }, [
    cursor,
    playbackMode,
    settings.aiResponseAutoplay,
    settings.copilotAnimation,
    settings.toolAnimation,
    settings.userAnimation,
    steps,
  ]);

  const next = useCallback(() => {
    if (activeAnimation) {
      setActiveAnimation(null);
      return;
    }
    revealNext("manual");
  }, [activeAnimation, revealNext]);

  const previous = useCallback(() => {
    setPlaybackMode("stopped");
    setActiveAnimation(null);
    setPendingVisualAnimation(null);
    setCursor((current) => Math.max(0, current - 1));
  }, []);

  const restart = useCallback(() => {
    setPlaybackMode("stopped");
    setActiveAnimation(null);
    setPendingVisualAnimation(null);
    setCursor(0);
  }, []);

  const togglePlayback = useCallback(() => {
    if (playbackMode !== "stopped") {
      setPlaybackMode("stopped");
      return;
    }

    if (cursor >= steps.length) {
      setCursor(0);
      setActiveAnimation(null);
      setPendingVisualAnimation(null);
      setPlaybackMode("all");
      return;
    }
    setPlaybackMode("all");
  }, [cursor, playbackMode, steps.length]);

  const toggleChrome = useCallback(() => {
    const shouldCollapse = !headerCollapsed || !controlsCollapsed;
    setHeaderCollapsed(shouldCollapse);
    setControlsCollapsed(shouldCollapse);
  }, [controlsCollapsed, headerCollapsed]);

  useEffect(() => {
    if (playbackMode === "stopped" || activeAnimation || pendingVisualAnimation) {
      return;
    }
    if (cursor >= steps.length) {
      setPlaybackMode("stopped");
      return;
    }

    const nextStep = steps[cursor];
    if (
      playbackMode === "ai-responses" &&
      (settings.aiResponseAutoplay === "off" ||
        (isUserTurnStep(nextStep) && pausesBeforeUser(settings.aiResponseAutoplay)))
    ) {
      setPlaybackMode("stopped");
      return;
    }

    const timer = window.setTimeout(
      () => revealNext("automatic"),
      cursor === 0 ? 250 : settings.autoAdvanceDelay,
    );
    return () => window.clearTimeout(timer);
  }, [
    activeAnimation,
    cursor,
    pendingVisualAnimation,
    playbackMode,
    revealNext,
    settings.aiResponseAutoplay,
    settings.autoAdvanceDelay,
    steps,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.matches("input, textarea, select") || target?.isContentEditable) {
        return;
      }

      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        restart();
      } else if (event.key.toLowerCase() === "m") {
        event.preventDefault();
        toggleChrome();
      } else if (target?.matches("button, summary")) {
        return;
      } else if (event.key === "ArrowRight") {
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
  }, [next, previous, restart, toggleChrome, togglePlayback]);

  const seek = (event: ChangeEvent<HTMLInputElement>) => {
    setPlaybackMode("stopped");
    setActiveAnimation(null);
    setPendingVisualAnimation(null);
    setCursor(Number(event.target.value));
  };

  const visibleSteps = steps.slice(0, cursor);
  const latestStep = visibleSteps.at(-1);
  const answeredQuestionIds = new Set(
    visibleSteps
      .filter((step) => step.kind === "answer")
      .map((step) => step.event.id),
  );
  const playing = playbackMode !== "stopped";
  const progress = steps.length ? Math.round((cursor / steps.length) * 100) : 0;
  const replayTimingStyle: ReplayTimingStyle = {
    "--cp-shimmer-duration": `${durationForSpeed(
      BASE_SHIMMER_DURATION,
      settings.shimmerSpeed,
    )}ms`,
    "--cp-fade-duration": `${durationForSpeed(BASE_FADE_DURATION, settings.fadeSpeed)}ms`,
  };

  return (
    <div className="replay-page" style={replayTimingStyle}>
      {headerCollapsed ? (
        <button
          className="icon-button chrome-toggle show-header-toggle"
          type="button"
          aria-label="Show application header"
          title="Show application header"
          onClick={() => setHeaderCollapsed(false)}
        >
          <PanelTopOpen size={16} />
        </button>
      ) : (
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
            <button
              className="icon-button"
              type="button"
              aria-label="Import another session"
              title="Import another session"
              onClick={onReplaceSession}
            >
              <Upload size={15} />
            </button>
            <button
              className="icon-button settings-button"
              type="button"
              aria-label="Open replay settings"
              title="Open replay settings"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings2 size={15} />
            </button>
            <button
              className="icon-button chrome-toggle"
              type="button"
              aria-label="Hide application header"
              title="Hide application header"
              onClick={() => setHeaderCollapsed(true)}
            >
              <PanelTopClose size={16} />
            </button>
          </div>
        </header>
      )}

      <main className="replay-main">
        <section className="session-heading" aria-labelledby="session-title">
          <div>
            <span className="eyebrow">
              <FileText size={15} />
              {transcript.sourceName}
            </span>
            <h1 id="session-title">{transcript.title}</h1>
            <p>
              {turnCount} messages
              {settings.showTools ? ` · ${toolCount} tool calls` : " · tool calls hidden"}
              {questionCount
                ? ` · ${questionCount} ${questionCount === 1 ? "question" : "questions"}`
                : ""}
              {systemCount
                ? settings.showSystemMessages
                  ? ` · ${systemCount} system ${systemCount === 1 ? "message" : "messages"}`
                  : " · system messages hidden"
                : ""}
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
                <button
                  className="icon-button"
                  type="button"
                  aria-label="Start replay"
                  title="Start replay"
                  onClick={next}
                >
                  <Play size={16} />
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

              if (step.kind === "skill") {
                return (
                  <SkillEntry
                    key={step.id}
                    event={step.event}
                    animation={settings.toolAnimation}
                    isLatest={latestStep?.id === step.id}
                  />
                );
              }

              if (step.kind === "system") {
                return (
                  <SystemEntry
                    key={step.id}
                    event={step.event}
                    animation={settings.toolAnimation}
                    isLatest={latestStep?.id === step.id}
                  />
                );
              }

              if (step.kind === "question") {
                if (answeredQuestionIds.has(step.event.id)) {
                  return null;
                }
                const isTyping = activeAnimation?.stepId === step.id;
                const questionContent = isTyping
                  ? step.event.question.slice(0, activeAnimation.visibleChars)
                  : step.event.question;
                return (
                  <AskUserEntry
                    key={`ask-user-${step.event.id}`}
                    event={step.event}
                    answered={false}
                    questionContent={questionContent}
                    animation={settings.userAnimation}
                    isLatest={latestStep?.id === step.id}
                    isTyping={isTyping}
                  />
                );
              }

              if (step.kind === "answer") {
                return (
                  <AskUserEntry
                    key={`ask-user-${step.event.id}`}
                    event={step.event}
                    answered
                    questionContent={step.event.question}
                    animation={settings.userAnimation}
                    isLatest={latestStep?.id === step.id}
                    isTyping={false}
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

          {controlsCollapsed ? (
            <button
              className="icon-button chrome-toggle show-controls-toggle"
              type="button"
              aria-label="Show replay controls"
              title="Show replay controls"
              onClick={() => setControlsCollapsed(false)}
            >
              <PanelBottomOpen size={16} />
            </button>
          ) : (
            <div className="playback-bar">
              <button
                className="icon-button chrome-toggle collapse-controls-button"
                type="button"
                aria-label="Hide replay controls"
                title="Hide replay controls"
                onClick={() => setControlsCollapsed(true)}
              >
                <PanelBottomClose size={16} />
              </button>
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
                <button
                  className="icon-button"
                  type="button"
                  aria-label="Reset replay"
                  title="Reset replay (R)"
                  onClick={restart}
                >
                  <RotateCcw size={17} />
                </button>
                <button
                  className="icon-button"
                  type="button"
                  aria-label="Previous activity"
                  title="Previous activity (Left arrow)"
                  disabled={cursor === 0}
                  onClick={previous}
                >
                  <SkipBack size={17} />
                </button>
                <button
                  className="icon-button"
                  type="button"
                  aria-label={playing ? "Pause autoplay" : "Start autoplay"}
                  title={playing ? "Pause autoplay (Space)" : "Start autoplay (Space)"}
                  onClick={togglePlayback}
                >
                  {playing ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <button
                  className="icon-button"
                  type="button"
                  aria-label={
                    activeAnimation
                      ? "Skip typing animation"
                      : cursor >= steps.length
                        ? "Replay complete"
                        : "Next activity"
                  }
                  title={activeAnimation ? "Skip typing animation" : "Next activity (Right arrow)"}
                  disabled={!activeAnimation && cursor >= steps.length}
                  onClick={next}
                >
                  <StepForward size={17} />
                </button>
              </div>
              <span className="keyboard-hint">
                ← previous · space autoplay · next → · R reset · M full screen
              </span>
            </div>
          )}
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
