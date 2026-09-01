"use client";

// The teacher-facing form primitives: a labelled wrapper, a text input, and a
// searchable country combobox.
//
// These were local, unexported helpers at the bottom of
// app/complete-profile/page.tsx. The profile page needs the same three, and a
// second copy is a second place for the focus ring, the placeholder weight and
// the country list to drift — so they were promoted here and complete-profile
// now imports them like everyone else.
//
// Teacher palette only, on the V2 tokens. The admin console has its own field
// kit in app/admin/ui.tsx; the two must not meet.

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { COUNTRIES, Flag, useClickOutside } from "@/app/components/DialCodeSelect";

/** The input styling, exported so a one-off field (a textarea, a native select)
 *  can match without restating the class string. */
export const INPUT_CLASS =
  "w-full px-4 py-3 border border-(--j-line-2) rounded-xl bg-(--j-bg) text-sm leading-tight tracking-tight font-medium text-(--j-ink) placeholder-(--j-faint) placeholder:font-light focus:outline-none focus:border-(--j-mid) focus:bg-(--j-card) transition-colors";

export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-sm mb-2 leading-tight tracking-tight font-medium"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export function TextInput({
  id,
  value,
  onChange,
  placeholder,
  type = "text",
  disabled = false,
  autoComplete,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  type?: string;
  disabled?: boolean;
  autoComplete?: string;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      autoComplete={autoComplete}
      className={`${INPUT_CLASS} disabled:bg-(--j-tint) disabled:text-(--j-faint) disabled:cursor-not-allowed`}
    />
  );
}

export function CountrySelect({
  value,
  onChange,
  id = "country",
}: {
  value: string | null;
  onChange: (next: string) => void;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const selected = value ? COUNTRIES.find((c) => c.code === value) ?? null : null;

  useClickOutside(wrapperRef, () => setOpen(false));

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    } else {
      setQuery("");
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q));
  }, [query]);

  const displayValue = open ? query : selected?.name ?? "";

  return (
    <div ref={wrapperRef} className="relative">
      <div
        onClick={() => {
          setOpen(true);
          inputRef.current?.focus();
        }}
        className={`w-full flex items-center gap-3 pl-4 pr-10 py-3 border rounded-xl bg-(--j-bg) text-sm leading-tight tracking-tight font-medium transition-colors cursor-text ${
          open ? "border-(--j-mid)" : "border-(--j-line-2) hover:border-(--j-lilac-2)"
        }`}
      >
        {selected && !open && <Flag code={selected.code} className="w-6 h-4" />}
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={displayValue}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search or select a country"
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex-1 min-w-0 bg-transparent text-left placeholder-(--j-faint) placeholder:font-light focus:outline-none"
        />
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
      </div>
      {open && (
        <div className="absolute z-10 mt-1 w-full max-h-72 overflow-y-auto rounded-xl border border-(--j-line) bg-(--j-card) shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted">No matches</p>
          ) : (
            <ul role="listbox" className="py-1">
              {filtered.map((c) => (
                <li key={c.code}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(c.code);
                      setOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-(--j-tint) transition-colors"
                  >
                    <Flag code={c.code} className="w-6 h-4" />
                    <span className="text-left">{c.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
