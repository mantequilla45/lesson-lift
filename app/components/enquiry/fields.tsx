"use client";

// Field primitives shared by ContactForm and SchoolEnquiryForm.
//
// The class strings are lifted verbatim from app/(app)/help/NewConversation.tsx
// so a form rendered on the Help page beside the ticket composer is visually the
// same object. They live here rather than being retyped in both forms because
// two copies of a border radius is how two forms start to drift apart.

import type { ReactNode } from "react";

export const INPUT_CLASS =
  "w-full px-3.5 py-2.5 border rounded-2xl bg-white text-sm focus:outline-none focus:border-gray-400 transition-colors";

export const INPUT_STYLE = { borderColor: "var(--j-line)" } as const;

export const DISABLED_CLASS =
  "disabled:bg-(--j-tint) disabled:text-(--j-faint) disabled:cursor-not-allowed";

export function Field({
  label,
  htmlFor,
  hint,
  optional,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="mb-4">
      <label htmlFor={htmlFor} className="block text-sm font-medium mb-1.5">
        {label}
        {optional && (
          <span className="font-normal" style={{ color: "var(--j-faint)" }}>
            {" "}
            (optional)
          </span>
        )}
      </label>
      {children}
      {hint && (
        <p className="text-xs mt-1" style={{ color: "var(--j-faint)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * The honeypot.
 *
 * Not `display: none` and not `hidden`: a bot worth stopping checks for both.
 * This is off-screen and untabbable, so a person never reaches it while a
 * form-filler that walks the DOM does. `autoComplete="off"` keeps a browser
 * from helpfully filling it in and locking a real person out.
 */
export function Honeypot({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: "-9999px",
        width: 1,
        height: 1,
        overflow: "hidden",
      }}
    >
      <label htmlFor="enquiry-company">Company</label>
      <input
        id="enquiry-company"
        name="company"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
