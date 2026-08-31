"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MagnifyingGlass,
  DotsThreeVertical,
  CaretDown,
  ArrowsDownUp,
  GridFour,
  List as ListIcon,
  PushPin,
  Check,
  FolderOpen,
} from "@phosphor-icons/react/dist/ssr";
import AppShellV2 from "@/app/components/v2/AppShellV2";
import { ToolTile } from "@/app/components/v2/Squircle";
import { listRecentRuns, type ToolRun } from "@/app/lib/toolRuns";
import { v2ToolForSlug, toolSolid } from "@/app/lib/tools";
import { typeLabel, formatDate, catalogIndex } from "@/app/lib/toolRunDisplay";
import { usePinnedTools, togglePin } from "@/app/lib/usePinnedTools";
import app from "@/app/components/v2/app.module.css";
import styles from "./folders.module.css";

/*
 * Library.
 *
 * Folders here are DERIVED from tool_runs.tool_slug — one folder per tool that
 * has at least one saved resource. There is no folders table, so a teacher
 * cannot create, rename or move between them. The prototype's New folder,
 * Upload and drag-to-move affordances are therefore absent rather than present
 * and inert: an affordance that does nothing is worse than one that is missing.
 */

const DATE_RANGES = ["Any time", "Last 7 days", "Last 30 days", "This year"] as const;
const COUNT_BUCKETS = ["Any", "1–5", "6–10", "11+"] as const;
const SORTS = [
  { key: "catalog", label: "Tools order" },
  { key: "recent", label: "Recently updated" },
  { key: "name", label: "Name (A–Z)" },
  { key: "count", label: "Most resources" },
] as const;

interface FolderData {
  slug: string;
  label: string;
  tag: string;
  /** Phosphor icon name, and the tile colour for this tool's category. */
  icon: string;
  solid: string;
  count: number;
  subjects: string[];
  years: string[];
  latest: number;
}

const DAY = 86_400_000;

function inDateRange(ts: number, range: string) {
  if (range === "Last 7 days") return ts >= Date.now() - 7 * DAY;
  if (range === "Last 30 days") return ts >= Date.now() - 30 * DAY;
  if (range === "This year") return new Date(ts).getFullYear() === new Date().getFullYear();
  return true;
}

function inCountBucket(c: number, b: string) {
  if (b === "1–5") return c >= 1 && c <= 5;
  if (b === "6–10") return c >= 6 && c <= 10;
  if (b === "11+") return c >= 11;
  return true;
}

export default function FoldersPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<ToolRun[]>([]);
  const [loading, setLoading] = useState(true);

  // The shared store, NOT a local copy. This page used to keep its own
  // useState mirror of the same localStorage key, so a pin made here did not
  // reach the sidebar until a reload.
  const pinnedHrefs = usePinnedTools();

  const [query, setQuery] = useState("");
  const [type, setType] = useState<string | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [toolName, setToolName] = useState<string | null>(null);
  const [year, setYear] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<string>("Any time");
  const [countBucket, setCountBucket] = useState<string>("Any");
  const [sort, setSort] = useState<string>("catalog");
  const [view, setView] = useState<"grid" | "list">("grid");

  useEffect(() => {
    listRecentRuns(1000)
      .then(setRuns)
      .catch(() => setRuns([]))
      .finally(() => setLoading(false));
  }, []);

  // One folder per tool that has at least one saved run.
  const folders = useMemo<FolderData[]>(() => {
    const map = new Map<string, FolderData>();
    for (const r of runs) {
      const tool = v2ToolForSlug(r.tool_slug);
      const input = r.input as Record<string, unknown>;
      const f = map.get(r.tool_slug) ?? {
        slug: r.tool_slug,
        label: tool?.name ?? typeLabel(r.tool_slug),
        tag: tool?.tag ?? "",
        // A run whose tool has been renamed or removed still belongs to the
        // teacher, so it gets a neutral folder rather than being dropped.
        icon: tool?.icon ?? "folder",
        solid: toolSolid(tool),
        count: 0,
        subjects: [],
        years: [],
        latest: 0,
      };
      f.count++;
      const subj = input.subject as string | undefined;
      const yr = input.yearGroup as string | undefined;
      if (subj && !f.subjects.includes(subj)) f.subjects.push(subj);
      if (yr && !f.years.includes(yr)) f.years.push(yr);
      f.latest = Math.max(f.latest, new Date(r.created_at).getTime());
      map.set(r.tool_slug, f);
    }
    return [...map.values()];
  }, [runs]);

  const options = useMemo(() => {
    const subjects = new Set<string>();
    const years = new Set<string>();
    for (const r of runs) {
      const input = r.input as Record<string, unknown>;
      if (input.subject) subjects.add(input.subject as string);
      if (input.yearGroup) years.add(input.yearGroup as string);
    }
    return {
      types: [...new Set(folders.map((f) => f.tag).filter(Boolean))].sort(),
      toolNames: folders.map((f) => f.label).sort(),
      subjects: [...subjects].sort(),
      years: [...years].sort(),
    };
  }, [runs, folders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = folders.filter(
      (f) =>
        (!q || f.label.toLowerCase().includes(q)) &&
        (!type || f.tag === type) &&
        (!toolName || f.label === toolName) &&
        (!subject || f.subjects.includes(subject)) &&
        (!year || f.years.includes(year)) &&
        inDateRange(f.latest, dateRange) &&
        inCountBucket(f.count, countBucket),
    );
    out.sort((a, b) => {
      if (sort === "name") return a.label.localeCompare(b.label);
      if (sort === "count") return b.count - a.count;
      if (sort === "recent") return b.latest - a.latest;
      // "catalog" — mirror the Make grid so folders stay put between visits
      // instead of reshuffling every time something is generated. Slugs missing
      // from the catalogue land together at the end, ordered A–Z.
      const d = catalogIndex(a.slug) - catalogIndex(b.slug);
      return d !== 0 ? d : a.label.localeCompare(b.label);
    });
    return out;
  }, [folders, query, type, toolName, subject, year, dateRange, countBucket, sort]);

  const pinned = filtered.filter((f) => pinnedHrefs.includes(`/tools/${f.slug}`));
  const rest = filtered.filter((f) => !pinnedHrefs.includes(`/tools/${f.slug}`));

  const total = runs.length;
  const open = (slug: string) => router.push(`/folders/${slug}`);
  const pin = (slug: string) => togglePin(`/tools/${slug}`);

  return (
    <AppShellV2 title="Library">
      <div className={app.hello}>
        <p className={app.helloWhen}>
          {loading ? " " : `${total} ${total === 1 ? "resource" : "resources"}`}
        </p>
        <h1>Library</h1>
        <p className={app.helloSub}>
          Everything you make is filed here, grouped by the tool that made it.
        </p>
      </div>

      <div className={styles.bar}>
        <div className={app.search}>
          <MagnifyingGlass className={app.searchIcon} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your library"
            aria-label="Search your library"
            className={app.searchInput}
          />
        </div>
        <button type="button" className={app.btn} onClick={() => router.push("/tools")}>
          Browse tools
        </button>
      </div>

      <div className={styles.filters}>
        <FilterDropdown label="Type" value={type} options={options.types} onChange={setType} />
        <FilterDropdown label="Subject" value={subject} options={options.subjects} onChange={setSubject} />
        <FilterDropdown label="Tool" value={toolName} options={options.toolNames} onChange={setToolName} />
        <FilterDropdown label="Year" value={year} options={options.years} onChange={setYear} />
        <FilterDropdown
          label="Date created"
          value={dateRange === "Any time" ? null : dateRange}
          options={[...DATE_RANGES]}
          onChange={(v) => setDateRange(v ?? "Any time")}
          allLabel="Any time"
        />
        <FilterDropdown
          label="Number of resources"
          value={countBucket === "Any" ? null : countBucket}
          options={[...COUNT_BUCKETS]}
          onChange={(v) => setCountBucket(v ?? "Any")}
          allLabel="Any"
        />

        <SortMenu value={sort} onChange={setSort} />

        {/* On a phone the eight controls above wrap, and `margin-left: auto`
            would strand this toggle alone on its own right-pushed line. */}
        <div className={styles.viewToggle}>
          <button
            type="button"
            onClick={() => setView("grid")}
            aria-label="Grid view"
            aria-pressed={view === "grid"}
            className={`${styles.viewBtn} ${view === "grid" ? styles.viewBtnOn : ""}`}
          >
            <GridFour className={styles.viewIcon} />
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            aria-label="List view"
            aria-pressed={view === "list"}
            className={`${styles.viewBtn} ${view === "list" ? styles.viewBtnOn : ""}`}
          >
            <ListIcon className={styles.viewIcon} />
          </button>
        </div>
      </div>

      {loading ? (
        <p className={styles.quiet}>Loading…</p>
      ) : folders.length === 0 ? (
        <div className={app.panel}>
          <div className={app.empty}>
            <span className={app.emptyIcon}>
              <FolderOpen weight="fill" />
            </span>
            <p className={app.emptyTitle}>Nothing filed yet</p>
            <p className={app.emptyBody}>
              Make something with any tool and it lands here automatically.
            </p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className={app.panel}>
          <div className={app.empty}>
            <span className={app.emptyIcon}>
              <MagnifyingGlass weight="fill" />
            </span>
            <p className={app.emptyTitle}>Nothing matches those filters</p>
            <p className={app.emptyBody}>Clear one of them, or search for a tool by name.</p>
          </div>
        </div>
      ) : (
        <>
          {pinned.length > 0 && (
            <Section
              title="Pinned"
              folders={pinned}
              view={view}
              pinnedHrefs={pinnedHrefs}
              onTogglePin={pin}
              onOpen={open}
            />
          )}
          <Section
            title={pinned.length > 0 ? "Everything else" : "All folders"}
            folders={rest}
            view={view}
            pinnedHrefs={pinnedHrefs}
            onTogglePin={pin}
            onOpen={open}
          />
        </>
      )}
    </AppShellV2>
  );
}

function Section({
  title,
  folders,
  view,
  pinnedHrefs,
  onTogglePin,
  onOpen,
}: {
  title: string;
  folders: FolderData[];
  view: "grid" | "list";
  pinnedHrefs: string[];
  onTogglePin: (slug: string) => void;
  onOpen: (slug: string) => void;
}) {
  if (folders.length === 0) return null;
  return (
    <section className={styles.section}>
      <div className={app.sh}>
        <div className={app.shTitle}>
          <h2>{title}</h2>
          <span className={app.shSub}>
            {folders.length} {folders.length === 1 ? "folder" : "folders"}
          </span>
        </div>
      </div>

      {view === "grid" ? (
        <div className={styles.grid}>
          {folders.map((f) => (
            <FolderCard
              key={f.slug}
              folder={f}
              pinned={pinnedHrefs.includes(`/tools/${f.slug}`)}
              onTogglePin={onTogglePin}
              onOpen={onOpen}
            />
          ))}
        </div>
      ) : (
        <div className={styles.list}>
          {folders.map((f) => (
            <FolderRow
              key={f.slug}
              folder={f}
              pinned={pinnedHrefs.includes(`/tools/${f.slug}`)}
              onTogglePin={onTogglePin}
              onOpen={onOpen}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function FolderCard({
  folder,
  pinned,
  onTogglePin,
  onOpen,
}: {
  folder: FolderData;
  pinned: boolean;
  onTogglePin: (slug: string) => void;
  onOpen: (slug: string) => void;
}) {
  return (
    <div className={styles.card} onClick={() => onOpen(folder.slug)}>
      <FolderMenu
        pinned={pinned}
        onTogglePin={() => onTogglePin(folder.slug)}
        onOpen={() => onOpen(folder.slug)}
      />
      <ToolTile icon={folder.icon} solid={folder.solid} size="md" />
      <h3 className={styles.cardName}>{folder.label}</h3>
      <p className={styles.cardCount}>
        {folder.count} {folder.count === 1 ? "resource" : "resources"}
      </p>
    </div>
  );
}

function FolderRow({
  folder,
  pinned,
  onTogglePin,
  onOpen,
}: {
  folder: FolderData;
  pinned: boolean;
  onTogglePin: (slug: string) => void;
  onOpen: (slug: string) => void;
}) {
  return (
    <div className={styles.listRow} onClick={() => onOpen(folder.slug)}>
      <ToolTile icon={folder.icon} solid={folder.solid} size="sm" />
      <span className={styles.rowName}>{folder.label}</span>
      {/* Hidden on a phone, where icon + name + menu is the right amount of
          information for the width available. */}
      <span className={styles.rowCount}>
        {folder.count} {folder.count === 1 ? "resource" : "resources"}
      </span>
      <span className={styles.rowDate}>
        {formatDate(new Date(folder.latest).toISOString())}
      </span>
      <FolderMenu
        pinned={pinned}
        onTogglePin={() => onTogglePin(folder.slug)}
        onOpen={() => onOpen(folder.slug)}
        inline
      />
    </div>
  );
}

function FolderMenu({
  pinned,
  onTogglePin,
  onOpen,
  inline,
}: {
  pinned: boolean;
  onTogglePin: () => void;
  onOpen: () => void;
  inline?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} className={inline ? styles.menuInline : styles.menuCorner}>
      <button
        type="button"
        aria-label="Folder menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={styles.menuBtn}
      >
        <DotsThreeVertical weight="bold" className={styles.menuIcon} />
      </button>
      {open && (
        <div className={styles.menuPanel} role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onOpen();
            }}
            className={styles.menuItem}
          >
            Open
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onTogglePin();
            }}
            className={styles.menuItem}
          >
            <PushPin
              weight={pinned ? "fill" : "regular"}
              className={styles.menuItemIcon}
            />
            {pinned ? "Unpin" : "Pin to sidebar"}
          </button>
        </div>
      )}
    </div>
  );
}

function FilterDropdown({
  label,
  value,
  options,
  onChange,
  allLabel = "All",
}: {
  label: string;
  value: string | null;
  options: string[];
  onChange: (v: string | null) => void;
  allLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const active = value !== null;
  return (
    <div ref={ref} className={styles.filter}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`${app.chip} ${active ? app.chipOn : ""}`}
      >
        {value ?? label}
        <CaretDown className={styles.caret} />
      </button>
      {open && (
        <div className={styles.filterPanel} role="listbox">
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className={styles.filterItem}
          >
            {allLabel}
            {!active && <Check className={styles.check} />}
          </button>
          {options.length === 0 ? (
            <p className={styles.filterNone}>No options</p>
          ) : (
            options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={styles.filterItem}
              >
                <span className={styles.filterLabel}>{opt}</span>
                {value === opt && <Check className={styles.check} />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function SortMenu({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} className={styles.filter}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Sort"
        aria-haspopup="listbox"
        aria-expanded={open}
        className={styles.sortBtn}
      >
        <ArrowsDownUp className={styles.viewIcon} />
      </button>
      {open && (
        <div className={`${styles.filterPanel} ${styles.filterPanelRight}`} role="listbox">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                onChange(s.key);
                setOpen(false);
              }}
              className={styles.filterItem}
            >
              {s.label}
              {value === s.key && <Check className={styles.check} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
