import { useEffect, useState } from "react";
import { ImportScreen } from "./components/ImportScreen";
import { ReplayView } from "./components/ReplayView";
import { demoTranscript } from "./demoTranscript";
import { parseTranscript } from "./parser";
import {
  BASE_FADE_DURATION,
  BASE_SHIMMER_DURATION,
  normalizeAnimationSpeed,
} from "./settings";
import type { Transcript, ViewerSettings } from "./types";

const SETTINGS_KEY = "copilot-chat-replay:settings";

const defaultSettings: ViewerSettings = {
  showTools: true,
  collapseTools: true,
  userAnimation: "fade",
  copilotAnimation: "typewriter",
  toolAnimation: "shimmer",
  typingSpeed: 180,
  shimmerSpeed: 1,
  fadeSpeed: 1,
  aiResponseAutoplay: "off",
  autoAdvanceDelay: 900,
  theme: "system",
};

type StoredViewerSettings = Partial<ViewerSettings> & {
  shimmerDuration?: number;
  fadeDuration?: number;
  autoPlayAiResponses?: boolean;
};

function loadSettings(): ViewerSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) {
      return defaultSettings;
    }

    const storedSettings = JSON.parse(stored) as StoredViewerSettings;
    const usesPreviousTypingDefault =
      !Object.hasOwn(storedSettings, "shimmerDuration") &&
      !Object.hasOwn(storedSettings, "shimmerSpeed") &&
      storedSettings.typingSpeed === 120;
    const {
      autoPlayAiResponses,
      fadeDuration,
      shimmerDuration,
      ...currentSettings
    } = storedSettings;
    const shimmerSpeed = normalizeAnimationSpeed(
      currentSettings.shimmerSpeed ??
        (shimmerDuration ? BASE_SHIMMER_DURATION / shimmerDuration : defaultSettings.shimmerSpeed),
    );
    const fadeSpeed = normalizeAnimationSpeed(
      currentSettings.fadeSpeed ??
        (fadeDuration ? BASE_FADE_DURATION / fadeDuration : defaultSettings.fadeSpeed),
    );

    return {
      ...defaultSettings,
      ...currentSettings,
      shimmerSpeed,
      fadeSpeed,
      aiResponseAutoplay:
        currentSettings.aiResponseAutoplay ??
        (autoPlayAiResponses ? "before-user" : defaultSettings.aiResponseAutoplay),
      typingSpeed: usesPreviousTypingDefault
        ? defaultSettings.typingSpeed
        : (currentSettings.typingSpeed ?? defaultSettings.typingSpeed),
    };
  } catch (error) {
    console.warn("Replay settings could not be loaded.", error);
    return defaultSettings;
  }
}

function applyTheme(theme: ViewerSettings["theme"]) {
  const scoutTheme = new URLSearchParams(window.location.search).get("scoutTheme");
  const effectiveTheme =
    scoutTheme === "light" || scoutTheme === "dark"
      ? scoutTheme
      : theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
  document.documentElement.setAttribute("data-theme", effectiveTheme);
}

export default function App() {
  const [transcript, setTranscript] = useState<Transcript | null>(() =>
    new URLSearchParams(window.location.search).get("demo") === "1"
      ? parseTranscript(demoTranscript, "sample-session.md")
      : null,
  );
  const [settings, setSettings] = useState<ViewerSettings>(loadSettings);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.warn("Replay settings could not be saved.", error);
    }
    applyTheme(settings.theme);

    if (settings.theme !== "system") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyTheme("system");
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [settings]);

  const importTranscript = (markdown: string, sourceName: string) => {
    setTranscript(parseTranscript(markdown, sourceName));
  };

  if (!transcript) {
    return (
      <ImportScreen
        onImport={importTranscript}
        onDemo={() => importTranscript(demoTranscript, "sample-session.md")}
      />
    );
  }

  return (
    <ReplayView
      key={`${transcript.sourceName}:${transcript.metadata.sessionId ?? transcript.title}`}
      transcript={transcript}
      settings={settings}
      onSettingsChange={setSettings}
      onReplaceSession={() => setTranscript(null)}
    />
  );
}
