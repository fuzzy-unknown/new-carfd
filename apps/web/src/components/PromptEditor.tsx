import { useState, useRef, useEffect, useCallback } from "react";
import type { ReferenceMedia } from "./ReferenceUploadZone";

interface Props {
  references: ReferenceMedia[];
  modelId: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function getTag(modelId: string, idx: number): string {
  return modelId === "wan2.7-r2v" ? `图${idx + 1}` : `[Image ${idx + 1}]`;
}

function serialize(root: HTMLElement): string {
  let text = "";
  for (const node of root.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    } else if (node instanceof HTMLElement && node.dataset.tag) {
      text += node.dataset.tag;
    } else if (node instanceof HTMLElement) {
      text += (node as HTMLElement).textContent || "";
    }
  }
  return text;
}

export function PromptEditor({ references, modelId, value, onChange, placeholder }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [showMention, setShowMention] = useState(false);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  const isInternal = useRef(false);

  // Initialize content from value when it changes externally (e.g. model switch)
  useEffect(() => {
    if (!editorRef.current || isInternal.current) return;
    if (document.activeElement !== editorRef.current) {
      editorRef.current.innerHTML = value || "";
    }
    isInternal.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelId]);

  const syncValue = useCallback(() => {
    if (!editorRef.current) return;
    isInternal.current = true;
    onChange(serialize(editorRef.current));
  }, [onChange]);

  const handleInput = () => {
    syncValue();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "@" && references.length > 0) {
      // Defer position calculation to after the @ character is inserted into DOM,
      // so the cursor range is anchored to a proper text node (fixes first-use positioning)
      requestAnimationFrame(() => {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const editorRect = editorRef.current?.getBoundingClientRect();
          if (editorRect) {
            setPopupStyle({
              top: rect.top - editorRect.top + rect.height + 4,
              left: Math.max(0, rect.left - editorRect.left),
            });
          }
        }
        setShowMention(true);
      });
      return;
    }

    if (showMention && e.key === "Escape") {
      setShowMention(false);
      return;
    }

    if (showMention && e.key === "Enter" && references.length === 1) {
      e.preventDefault();
      insertReference(references[0], 0);
      return;
    }
  };

  // Close popup on click outside
  useEffect(() => {
    if (!showMention) return;
    const handleClick = (e: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node) &&
        editorRef.current &&
        !editorRef.current.contains(e.target as Node)
      ) {
        setShowMention(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMention]);

  const insertReference = (ref: ReferenceMedia, idx: number) => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) {
      setShowMention(false);
      return;
    }

    const range = sel.getRangeAt(0);
    const textNode = range.startContainer;

    // Find and replace the '@' that triggered the popup
    if (textNode.nodeType === Node.TEXT_NODE) {
      const text = textNode.textContent || "";
      const cursorPos = range.startOffset;
      const atPos = text.lastIndexOf("@", cursorPos - 1);
      if (atPos !== -1) {
        range.setStart(textNode, atPos);
        range.deleteContents();
      }
    }

    // Create badge element
    const tag = getTag(modelId, idx);
    const badge = document.createElement("span");
    badge.contentEditable = "false";
    badge.dataset.tag = tag;
    badge.className =
      "inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded bg-primary/15 text-primary text-sm font-medium border border-primary/20 align-middle";

    if (ref.type === "image") {
      const img = document.createElement("img");
      img.src = ref.url;
      img.className = "w-4 h-4 rounded object-cover inline-block";
      img.alt = "";
      badge.appendChild(img);
    } else {
      const icon = document.createElement("span");
      icon.textContent = "🎬";
      icon.className = "text-xs";
      badge.appendChild(icon);
    }

    const label = document.createElement("span");
    label.textContent = String(idx + 1);
    badge.appendChild(label);

    range.insertNode(badge);

    // Move cursor after the badge
    const newRange = document.createRange();
    newRange.setStartAfter(badge);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);

    setShowMention(false);
    editorRef.current?.focus();
    syncValue();
  };

  return (
    <div className="relative">
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:outline-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] cursor-text whitespace-pre-wrap break-words"
        data-placeholder={placeholder || ""}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onBlur={syncValue}
      />

      {/* @mention popup */}
      {showMention && (
        <div
          ref={popupRef}
          className="absolute z-50 bg-popover border rounded-lg shadow-lg p-1.5 min-w-[200px] max-w-[280px]"
          style={popupStyle}
        >
          <p className="text-[11px] text-muted-foreground px-2 py-1">选择参考素材</p>
          <div className="space-y-0.5">
            {references.map((ref, idx) => (
              <button
                key={ref.id}
                onClick={() => insertReference(ref, idx)}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover:bg-accent transition-colors text-left"
              >
                {ref.type === "image" ? (
                  <img src={ref.url} alt="" className="w-7 h-7 rounded object-cover shrink-0" />
                ) : (
                  <div className="w-7 h-7 rounded bg-muted flex items-center justify-center shrink-0 text-xs">
                    🎬
                  </div>
                )}
                <span className="flex-1 truncate">{ref.name}</span>
                <span className="text-xs text-muted-foreground font-mono shrink-0">
                  {getTag(modelId, idx)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
