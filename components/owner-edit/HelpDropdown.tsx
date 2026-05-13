"use client";

import { useId, useState, useRef, useEffect, ReactNode } from "react";

interface Props {
  label: string;
  ariaLabel?: string;
  children: ReactNode;
}

export default function HelpDropdown({ label, ariaLabel, children }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const panelId = `help-panel-${id}`;
  const containerRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={containerRef} className="inline-block relative">
      <button
        type="button"
        aria-label={ariaLabel || `Help: ${label}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full border border-gray-400 text-gray-600 text-xs font-bold hover:bg-gray-100 hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        ?
      </button>
      {open && (
        <div
          id={panelId}
          role="region"
          aria-label={`${label} help`}
          className="absolute z-20 left-0 mt-2 w-80 max-w-[90vw] bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-sm text-gray-700 space-y-2"
        >
          {children}
        </div>
      )}
    </span>
  );
}
