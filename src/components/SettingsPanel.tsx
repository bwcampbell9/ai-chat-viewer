import { Gauge, Moon, Monitor, Settings2, Sun, X } from "lucide-react";
import type {
  AnimationMode,
  ThemePreference,
  ToolAnimationMode,
  ViewerSettings,
} from "../types";

interface SettingsPanelProps {
  settings: ViewerSettings;
  onChange: (settings: ViewerSettings) => void;
  onClose: () => void;
}

const animationOptions: Array<{ value: AnimationMode; label: string }> = [
  { value: "typewriter", label: "Typewriter" },
  { value: "fade", label: "Fade in" },
  { value: "none", label: "Instant" },
];

const toolAnimationOptions: Array<{ value: ToolAnimationMode; label: string }> = [
  { value: "shimmer", label: "Shimmer" },
  { value: "fade", label: "Fade in" },
  { value: "none", label: "Instant" },
];

const themeOptions: Array<{
  value: ThemePreference;
  label: string;
  icon: typeof Monitor;
}> = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

export function SettingsPanel({ settings, onChange, onClose }: SettingsPanelProps) {
  const patchSettings = (patch: Partial<ViewerSettings>) => {
    onChange({ ...settings, ...patch });
  };

  const usesTypewriter =
    settings.userAnimation === "typewriter" || settings.copilotAnimation === "typewriter";
  const usesShimmer = settings.toolAnimation === "shimmer";
  const usesFade =
    settings.userAnimation === "fade" ||
    settings.copilotAnimation === "fade" ||
    settings.toolAnimation === "fade";

  return (
    <div className="settings-layer" role="presentation" onMouseDown={onClose}>
      <aside
        className="settings-panel"
        aria-label="Replay settings"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="settings-header">
          <span>
            <Settings2 size={17} />
            Replay settings
          </span>
          <button className="icon-button" type="button" aria-label="Close settings" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="settings-content">
          <section className="setting-section">
            <div className="setting-heading">
              <span>Tool calls</span>
              <small>Keep long runs compact in the feed.</small>
            </div>
            <label className="switch-row">
              <span>
                <strong>Group consecutive calls</strong>
                <small>Show “X tools called” as one activity.</small>
              </span>
              <button
                className={`switch ${settings.collapseTools ? "on" : ""}`}
                type="button"
                role="switch"
                aria-checked={settings.collapseTools}
                onClick={() => patchSettings({ collapseTools: !settings.collapseTools })}
              >
                <span />
              </button>
            </label>
          </section>

          <section className="setting-section">
            <div className="setting-heading">
              <span>Message animation</span>
              <small>Choose how each role enters the conversation.</small>
            </div>
            <label className="select-row">
              <span>User</span>
              <select
                value={settings.userAnimation}
                onChange={(event) =>
                  patchSettings({ userAnimation: event.target.value as AnimationMode })
                }
              >
                {animationOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="select-row">
              <span>Copilot</span>
              <select
                value={settings.copilotAnimation}
                onChange={(event) =>
                  patchSettings({ copilotAnimation: event.target.value as AnimationMode })
                }
              >
                {animationOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="select-row">
              <span>Tool calls</span>
              <select
                value={settings.toolAnimation}
                onChange={(event) =>
                  patchSettings({ toolAnimation: event.target.value as ToolAnimationMode })
                }
              >
                {toolAnimationOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={`range-setting ${usesTypewriter ? "" : "disabled"}`}>
              <span>
                <strong>
                  <Gauge size={15} />
                  Typing speed
                </strong>
                <output>{settings.typingSpeed} chars/sec</output>
              </span>
              <input
                type="range"
                min="20"
                max="240"
                step="10"
                disabled={!usesTypewriter}
                value={settings.typingSpeed}
                onChange={(event) => patchSettings({ typingSpeed: Number(event.target.value) })}
              />
            </label>
            <label className={`range-setting ${usesShimmer ? "" : "disabled"}`}>
              <span>
                <strong>Shimmer speed</strong>
                <output>{(settings.shimmerDuration / 1000).toFixed(1)} sec</output>
              </span>
              <input
                className="speed-range"
                type="range"
                min="300"
                max="2000"
                step="100"
                disabled={!usesShimmer}
                value={settings.shimmerDuration}
                onChange={(event) =>
                  patchSettings({ shimmerDuration: Number(event.target.value) })
                }
              />
            </label>
            <label className={`range-setting ${usesFade ? "" : "disabled"}`}>
              <span>
                <strong>Fade-in speed</strong>
                <output>{(settings.fadeDuration / 1000).toFixed(2)} sec</output>
              </span>
              <input
                className="speed-range"
                type="range"
                min="100"
                max="1000"
                step="20"
                disabled={!usesFade}
                value={settings.fadeDuration}
                onChange={(event) => patchSettings({ fadeDuration: Number(event.target.value) })}
              />
            </label>
          </section>

          <section className="setting-section">
            <div className="setting-heading">
              <span>Autoplay pacing</span>
              <small>Pause between completed activities.</small>
            </div>
            <label className="range-setting">
              <span>
                <strong>Step delay</strong>
                <output>{(settings.autoAdvanceDelay / 1000).toFixed(1)} sec</output>
              </span>
              <input
                type="range"
                min="300"
                max="3000"
                step="100"
                value={settings.autoAdvanceDelay}
                onChange={(event) =>
                  patchSettings({ autoAdvanceDelay: Number(event.target.value) })
                }
              />
            </label>
          </section>

          <section className="setting-section">
            <div className="setting-heading">
              <span>Appearance</span>
              <small>Use your device theme or override it here.</small>
            </div>
            <div className="theme-options" role="group" aria-label="Color theme">
              {themeOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    className={settings.theme === option.value ? "active" : ""}
                    type="button"
                    aria-pressed={settings.theme === option.value}
                    onClick={() => patchSettings({ theme: option.value })}
                  >
                    <Icon size={15} />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
