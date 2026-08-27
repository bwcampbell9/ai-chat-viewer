import DOMPurify from "dompurify";
import { marked } from "marked";
import { useMemo } from "react";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

marked.setOptions({
  breaks: true,
  gfm: true,
});

export function MarkdownContent({ content, className = "" }: MarkdownContentProps) {
  const html = useMemo(() => {
    const rendered = marked.parse(content, { async: false }) as string;
    const sanitized = DOMPurify.sanitize(rendered, {
      FORBID_ATTR: ["style", "srcset"],
      FORBID_TAGS: ["audio", "embed", "iframe", "img", "object", "video"],
      USE_PROFILES: { html: true },
    });
    const container = document.createElement("div");
    container.innerHTML = sanitized;
    container.querySelectorAll("a").forEach((link) => {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    });
    return container.innerHTML;
  }, [content]);

  return (
    <div
      className={`markdown-content ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
