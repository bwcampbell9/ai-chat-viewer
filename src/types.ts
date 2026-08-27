export type MessageRole = "user" | "copilot";
export type AnimationMode = "none" | "fade" | "typewriter";
export type ToolAnimationMode = "none" | "fade" | "shimmer";
export type ThemePreference = "system" | "light" | "dark";
export type AiResponseAutoplayMode =
  | "off"
  | "before-user"
  | "after-user"
  | "before-and-after";

export interface TranscriptMetadata {
  sessionId?: string;
  started?: string;
  duration?: string;
  exported?: string;
}

interface BaseEvent {
  id: string;
  index: number;
  elapsedLabel: string;
  elapsedSeconds: number;
  rawContent: string;
}

export interface MessageEvent extends BaseEvent {
  kind: "message";
  role: MessageRole;
}

export interface SystemEvent extends BaseEvent {
  kind: "system";
}

export interface ToolPayload {
  language: string;
  content: string;
}

export interface ToolEvent extends BaseEvent {
  kind: "tool";
  name: string;
  status: string;
  arguments?: ToolPayload;
  result?: ToolPayload;
}

export interface SkillEvent extends BaseEvent {
  kind: "skill";
  skill: string;
  status: string;
}

export interface AskUserEvent extends BaseEvent {
  kind: "ask-user";
  question: string;
  choices: string[];
  answer?: string;
  status: string;
}

export type SessionEvent = MessageEvent | SystemEvent | ToolEvent | SkillEvent | AskUserEvent;

export interface Transcript {
  title: string;
  metadata: TranscriptMetadata;
  events: SessionEvent[];
  sourceName: string;
}

export interface MessagePlaybackStep {
  id: string;
  kind: "message";
  event: MessageEvent;
}

export interface ToolPlaybackStep {
  id: string;
  kind: "tools";
  events: ToolEvent[];
}

export interface SkillPlaybackStep {
  id: string;
  kind: "skill";
  event: SkillEvent;
}

export interface SystemPlaybackStep {
  id: string;
  kind: "system";
  event: SystemEvent;
}

export interface AskUserQuestionPlaybackStep {
  id: string;
  kind: "question";
  event: AskUserEvent;
}

export interface AskUserAnswerPlaybackStep {
  id: string;
  kind: "answer";
  event: AskUserEvent;
}

export type PlaybackStep =
  | MessagePlaybackStep
  | ToolPlaybackStep
  | SkillPlaybackStep
  | SystemPlaybackStep
  | AskUserQuestionPlaybackStep
  | AskUserAnswerPlaybackStep;

export interface ViewerSettings {
  showTools: boolean;
  showSystemMessages: boolean;
  collapseTools: boolean;
  userAnimation: AnimationMode;
  copilotAnimation: AnimationMode;
  toolAnimation: ToolAnimationMode;
  typingSpeed: number;
  shimmerSpeed: number;
  fadeSpeed: number;
  aiResponseAutoplay: AiResponseAutoplayMode;
  autoAdvanceDelay: number;
  theme: ThemePreference;
}
