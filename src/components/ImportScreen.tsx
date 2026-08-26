import {
  CheckCircle2,
  ClipboardPaste,
  FileText,
  FileUp,
  LockKeyhole,
  Play,
  Sparkles,
  Upload,
} from "lucide-react";
import { useRef, useState, type DragEvent } from "react";

type ImportMode = "upload" | "paste";

interface ImportScreenProps {
  onImport: (markdown: string, sourceName: string) => void;
  onDemo: () => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function ImportScreen({ onImport, onDemo }: ImportScreenProps) {
  const [mode, setMode] = useState<ImportMode>("upload");
  const [pasteValue, setPasteValue] = useState("");
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importMarkdown = (markdown: string, sourceName: string) => {
    try {
      onImport(markdown, sourceName);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The session could not be imported.");
    }
  };

  const importFile = async (file?: File) => {
    if (!file) {
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("Choose a Markdown file smaller than 10 MB.");
      return;
    }

    try {
      importMarkdown(await file.text(), file.name);
    } catch {
      setError("The selected file could not be read.");
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    void importFile(event.dataTransfer.files[0]);
  };

  return (
    <div className="import-page">
      <header className="app-header">
        <a className="brand" href="./" aria-label="Copilot Chat Replay home">
          <span className="brand-mark" aria-hidden="true">
            <Sparkles size={17} />
          </span>
          <span>Copilot Chat Replay</span>
        </a>
        <span className="local-badge">
          <LockKeyhole size={14} />
          Local only
        </span>
      </header>

      <main className="import-main">
        <div className="status-feed" aria-label="Application status">
          <div className="activity-line">
            <CheckCircle2 size={16} />
            <span>Replay workspace ready</span>
            <span className="activity-meta">Static GitHub Pages app</span>
          </div>
          <div className="activity-line">
            <CheckCircle2 size={16} />
            <span>Copilot session viewer started</span>
          </div>
        </div>

        <section className="import-card" aria-labelledby="import-title">
          <div className="import-card-copy">
            <span className="eyebrow">
              <FileText size={15} />
              Session source
            </span>
            <h1 id="import-title">Replay a Copilot conversation</h1>
            <p>
              Load an exported session and step through its known messages and tool calls without
              waiting for a model.
            </p>
          </div>

          <div className="mode-tabs" role="tablist" aria-label="Import method">
            <button
              className={mode === "upload" ? "active" : ""}
              type="button"
              role="tab"
              aria-selected={mode === "upload"}
              onClick={() => {
                setMode("upload");
                setError("");
              }}
            >
              <FileUp size={16} />
              Upload
            </button>
            <button
              className={mode === "paste" ? "active" : ""}
              type="button"
              role="tab"
              aria-selected={mode === "paste"}
              onClick={() => {
                setMode("paste");
                setError("");
              }}
            >
              <ClipboardPaste size={16} />
              Paste
            </button>
          </div>

          {mode === "upload" ? (
            <div
              className={`drop-zone ${isDragging ? "dragging" : ""}`}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setIsDragging(false);
                }
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
            >
              <span className="drop-icon" aria-hidden="true">
                <Upload size={22} />
              </span>
              <strong>Drop a session history Markdown file</strong>
              <span>or choose a local .md file up to 10 MB</span>
              <button
                className="primary-button"
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose Markdown
              </button>
              <input
                ref={fileInputRef}
                className="visually-hidden"
                type="file"
                accept=".md,.markdown,text/markdown,text/plain"
                onChange={(event) => void importFile(event.target.files?.[0])}
              />
            </div>
          ) : (
            <div className="paste-panel">
              <label htmlFor="session-markdown">Session history Markdown</label>
              <textarea
                id="session-markdown"
                value={pasteValue}
                placeholder="# Session title&#10;&#10;&lt;sub&gt;0s&lt;/sub&gt;&#10;&#10;## User&#10;&#10;..."
                spellCheck={false}
                onChange={(event) => setPasteValue(event.target.value)}
              />
              <button
                className="primary-button"
                type="button"
                disabled={!pasteValue.trim()}
                onClick={() => importMarkdown(pasteValue, "Pasted session")}
              >
                <Play size={16} />
                Prepare replay
              </button>
            </div>
          )}

          {error ? (
            <p className="error-message" role="alert">
              {error}
            </p>
          ) : null}

          <div className="demo-row">
            <span>Want to see how playback works first?</span>
            <button className="text-button" type="button" onClick={onDemo}>
              Try the sample session
            </button>
          </div>
        </section>

        <p className="privacy-note">
          <LockKeyhole size={14} />
          Session content stays in this browser tab and is never uploaded.
        </p>
      </main>
    </div>
  );
}
