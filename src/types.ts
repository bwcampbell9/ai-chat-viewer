export type MessageRole = "user" | "copilot";
export type AnimationMode = "none" | "fade" | "typewriter";
export type ToolAnimationMode = "none" | "fade" | "shimmer";
export type ThemePreference = "system" | "light" | "dark";

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

export type SessionEvent = MessageEvent | ToolEvent;

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

export type PlaybackStep = MessagePlaybackStep | ToolPlaybackStep;

export interface ViewerSettings {
  showTools: boolean;
  collapseTools: boolean;
  userAnimation: AnimationMode;
  copilotAnimation: AnimationMode;
  toolAnimation: ToolAnimationMode;
  typingSpeed: number;
  shimmerSpeed: number;
  fadeSpeed: number;
  autoPlayAiResponses: boolean;
  autoAdvanceDelay: number;
  theme: ThemePreference;
}
