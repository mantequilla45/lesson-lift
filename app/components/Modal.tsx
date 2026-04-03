"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  width?: string;
  height?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export default function Modal({
  open,
  onClose,
  title,
  width = "min(640px, 95vw)",
  height,
  actions,
  children,
}: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Two rAFs ensure the element is in the DOM before we add the visible class
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (mounted) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mounted]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center p-4"
      style={{
        transition: "background-color 200ms ease",
        backgroundColor: visible ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0)",
      }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl flex flex-col"
        style={{
          width,
          height,
          maxHeight: height ? undefined : "90vh",
          transition: "opacity 200ms ease, transform 200ms ease",
          opacity: visible ? 1 : 0,
          transform: visible ? "scale(1) translateY(0)" : "scale(0.96) translateY(8px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {(title !== undefined || actions !== undefined) && (
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 shrink-0">
            {title !== undefined && (
              <span className="text-sm font-semibold text-gray-900">{title}</span>
            )}
            <div className="flex items-center gap-2 ml-auto">
              {actions}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        <div className="flex-1 overflow-auto min-h-0">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
