import { useEffect, useState } from "react";
import { ImportScreen } from "./components/ImportScreen";
import { ReplayView } from "./components/ReplayView";
import { demoTranscript } from "./demoTranscript";
import { parseTranscript } from "./parser";
import type { Transcript, ViewerSettings } from "./types";

const SETTINGS_KEY = "copilot-chat-replay:settings";

const defaultSettings: ViewerSettings = {
  collapseTools: true,
  userAnimation: "fade",
  copilotAnimation: "typewriter",
  toolAnimation: "shimmer",
  typingSpeed: 180,
  shimmerDuration: 900,
  fadeDuration: 240,
  autoAdvanceDelay: 900,
  theme: "system",
};

function loadSettings(): ViewerSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) {
      return defaultSettings;
    }

    const storedSettings = JSON.parse(stored) as Partial<ViewerSettings>;
    const usesPreviousTypingDefault =
      !Object.hasOwn(storedSettings, "shimmerDuration") && storedSettings.typingSpeed === 120;

    return {
      ...defaultSettings,
      ...storedSettings,
      typingSpeed: usesPreviousTypingDefault
        ? defaultSettings.typingSpeed
        : (storedSettings.typingSpeed ?? defaultSettings.typingSpeed),
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
