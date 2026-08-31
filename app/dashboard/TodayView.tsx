"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  Clock,
  Fire,
  Medal,
  ChatTeardropDots,
  ArrowRight,
  CalendarBlank,
} from "@phosphor-icons/react/dist/ssr";
import AppShellV2 from "@/app/components/v2/AppShellV2";
import UpgradeGate from "@/app/components/UpgradeGate";
import { ToolTile } from "@/app/components/v2/Squircle";
import { minutesSavedFor, V2_TOOLS, v2ToolForSlug, toolSolid } from "@/app/lib/tools";
import { listRecentRuns, type ToolRun } from "@/app/lib/toolRuns";
import { createChat, saveMessage } from "@/app/lib/assistantChats";
import { createClient } from "@/app/lib/auth/client";
import type { CopyMap } from "@/app/lib/copy";
import app from "@/app/components/v2/app.module.css";
import styles from "./TodayView.module.css";

/*
 * Today.
 *
 * The order here is the one the handover specifies, and it matters: this screen
 * starts work rather than reporting on it. Ask Mo and the tools come before the
 * numbers.
 *
 * Three of the prototype's panels have no data behind them yet — day streak,
 * badges and the week from the timetable. They keep their place in the layout
 * and say plainly that they are not set up, rather than rendering a zero. A
 * zero reads as "you have achieved nothing", which is both discouraging and, in
 * the case of a feature that does not exist, untrue.
 */

/** Six sensible starting tools for a teacher with no history yet. */
const STARTER_SLUGS = [
  "lesson-planner",
  "worksheet-generator",
  "comprehension-generator",
  "quiz-generator",
  "lesson-slideshow",
  "cover-lesson",
];

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/*
 * The mount-time clock, as an external store.
 *
 * getSnapshot MUST return a stable reference. Handing back a fresh Date on
 * every call would make React see a changed store on every render and loop
 * forever, so the value is created once, lazily, and cached.
 *
 * The clock is only read for the greeting and the 30 day ranking window, so
 * there is nothing to subscribe to: it never changes within a visit.
 */
let clock: Date | null = null;
const subscribeToClock = () => () => {};
function getClock(): Date {
  if (!clock) clock = new Date();
  return clock;
}
/** null on the server, so the greeting renders blank rather than in the
 *  server's timezone and then changing under the teacher on hydration. */
const getServerClock = (): Date | null => null;

function greetingFor(hour: number): string {
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

export default function TodayView({
  copy,
}: {
  copy: Pick<CopyMap, "dash.empty.title" | "dash.empty.body">;
}) {
  const router = useRouter();
  const [runs, setRuns] = useState<ToolRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [ask, setAsk] = useState("");
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  // One fetch, every derivation below computed from it. 1,000 is the same
  // ceiling /analytics uses, and covers the ranking window comfortably.
  useEffect(() => {
    listRecentRuns(1000)
      .then(setRuns)
      .catch(() => setRuns([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;
      const { data } = await supabase
        .from("profiles")
        .select("first_name")
        .eq("id", uid)
        .maybeSingle();
      if (!cancelled) setFirstName(data?.first_name ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // The clock, read on the client only.
  //
  // `new Date()` on the server is the server's clock in its own timezone, which
  // for a teacher in the evening can differ by a whole greeting, and a mismatch
  // between the server and client renders is a hydration error.
  //
  // A store rather than a setState in an effect: this hook exists precisely for
  // "external value that differs between server and client", and it gives the
  // server snapshot (null) for free without a second render. Same shape as the
  // collapse preference in the sidebar.
  const now = useSyncExternalStore(subscribeToClock, getClock, getServerClock);

  const stats = useMemo(() => {
    const minutes = runs.reduce((sum, r) => sum + minutesSavedFor(r.tool_slug), 0);
    return {
      resources: runs.length,
      // Rounded to the nearest hour. Below an hour this reads "under an hour"
      // rather than "0h", which is the same rule as the empty case.
      hours: Math.round(minutes / 60),
      minutes,
    };
  }, [runs]);

  /**
   * Six tools, ranked by this teacher's own use over the last 30 days.
   *
   * The window is measured from `now`, the mount-time clock, rather than a
   * fresh Date.now(): reading the clock during render is impure, and would give
   * this memo a different answer on every render for no benefit.
   *
   * Before `now` is set, on the server render and the first client one, the
   * window is left open rather than clamped shut — a ranking over all history
   * is a reasonable thing to show for one frame; an empty row is not.
   */
  const mostUsed = useMemo(() => {
    const cutoff = now ? now.getTime() - THIRTY_DAYS_MS : 0;
    const counts = new Map<string, number>();
    for (const run of runs) {
      if (new Date(run.created_at).getTime() < cutoff) continue;
      counts.set(run.tool_slug, (counts.get(run.tool_slug) ?? 0) + 1);
    }

    const ranked = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .flatMap(([slug]) => {
        const tool = v2ToolForSlug(slug);
        return tool ? [tool] : [];
      });

    // Top up to six: first from the starters, then from the catalogue at large,
    // so a teacher who has used two tools still gets a full row rather than a
    // gap. Deduplicated against everything already chosen — the href is the
    // React key below, and a tool appearing in both the ranking and the filler
    // would render twice under the same key.
    const seen = new Set(ranked.map((t) => t.href));
    const out = [...ranked];
    for (const tool of [...STARTER_SLUGS.flatMap((s) => v2ToolForSlug(s) ?? []), ...V2_TOOLS]) {
      if (out.length >= 6) break;
      if (seen.has(tool.href)) continue;
      seen.add(tool.href);
      out.push(tool);
    }
    return out.slice(0, 6);
  }, [runs, now]);

  const recent = runs.slice(0, 5);

  // The line under the greeting. With no timetable there is no "next unplanned
  // lesson" to name, so it reports the most recent thing made instead, which is
  // the other half of what the prototype's line does.
  const subline = (() => {
    if (loading) return "Getting your week together.";
    if (runs.length === 0) return "Nothing made yet. Pick a tool and see what it does.";
    const latest = v2ToolForSlug(runs[0]!.tool_slug);
    const title = runs[0]!.title?.trim();
    if (title) return `Last up: ${title}.`;
    return latest ? `Last up: a ${latest.name.toLowerCase()}.` : "Ready when you are.";
  })();

  /*
   * Hand off to Ask Mo.
   *
   * Deliberately not a second chat implementation: this creates the chat,
   * stores the opening message, and navigates to /assistant/[id], which owns
   * streaming and history. AssistantView notices a conversation that ends on a
   * user turn and answers it, so a refresh mid-answer resumes correctly too.
   *
   * Mo never generates straight from free text. It parses the intent, opens the
   * matched tool with the fields filled, and lets the teacher confirm, so a
   * misread costs nothing. That routing lives in the assistant; this is only the
   * way in.
   */
  const submitAsk = async () => {
    const q = ask.trim();
    if (!q || asking) return;
    setAsking(true);
    setAskError(null);
    try {
      const chat = await createChat(q);
      await saveMessage({ chatId: chat.id, role: "user", content: q });
      router.push(`/assistant/${chat.id}`);
    } catch {
      setAskError("Could not start that chat. Please try again.");
      setAsking(false);
    }
  };

  return (
    /* UpgradeGate catches a 402 from the assistant's plan gate or spend ceiling
       and opens the upgrade modal. Today is a sibling of /tools, so it does not
       inherit the one mounted in that layout. */
    <AppShellV2 title="Today" slot={<UpgradeGate />}>
      <div className={app.hello}>
        <p className={app.helloWhen}>
          {now
            ? now.toLocaleDateString("en-GB", { weekday: "long" }) +
              " " +
              greetingFor(now.getHours()).toLowerCase()
            : " "}
        </p>
        <h1>
          {now ? greetingFor(now.getHours()) : "Hello"}
          {firstName ? `, ${firstName}.` : "."}
        </h1>
        <p className={app.helloSub}>{subline}</p>
      </div>

      {/* Namespaced `moAsk`, never `mo`: in the prototype a bare `.mo` also
          matched `.msg.mo` in the chat and painted every message as a purple
          card. */}
      <div className={styles.moAsk}>
        <span className={styles.moFace}>
          <ChatTeardropDots weight="fill" className={styles.moFaceIcon} />
        </span>
        <div className={styles.moText}>
          <b>Ask Mo</b>
          <p>Tell it what you need and it opens the right tool, filled in.</p>
        </div>
        <form
          className={styles.moIn}
          onSubmit={(e) => {
            e.preventDefault();
            void submitAsk();
          }}
        >
          <input
            value={ask}
            onChange={(e) => setAsk(e.target.value)}
            placeholder="Year 4 fractions lesson with a worksheet"
            aria-label="Ask Mo"
            disabled={asking}
            className={styles.moInput}
          />
          <button type="submit" disabled={asking || !ask.trim()} className={styles.moGo}>
            {asking ? "Starting…" : "Ask Mo"}
          </button>
        </form>
      </div>

      {askError && (
        <p className={styles.moError} role="alert">
          {askError}
        </p>
      )}

      <div className={styles.metrics}>
        <div className={styles.metric}>
          <span className={styles.metricIcon} data-tone="violet">
            <FileText weight="fill" />
          </span>
          <div>
            <b>{loading ? "—" : stats.resources}</b>
            <span>Resources made</span>
          </div>
        </div>

        <div className={styles.metric}>
          <span className={styles.metricIcon} data-tone="green">
            <Clock weight="fill" />
          </span>
          <div>
            {/* Never a zero headline. Before the first resource there is no
                figure worth showing, and under an hour rounds to 0h, which
                reads as "this saved you nothing". */}
            <b>
              {loading
                ? "—"
                : stats.resources === 0
                  ? "Let us find out"
                  : stats.hours === 0
                    ? "Under an hour"
                    : `${stats.hours}h`}
            </b>
            <span>Time saved</span>
          </div>
        </div>

        {/* No streak data: there is no table for it, and it cannot be inferred
            honestly from runs alone without deciding what breaks a streak. */}
        <div className={`${styles.metric} ${styles.metricSoon}`}>
          <span className={styles.metricIcon} data-tone="orange">
            <Fire weight="fill" />
          </span>
          <div>
            <b className={styles.metricSoonValue}>Not yet</b>
            <span>Day streak</span>
          </div>
        </div>

        <div className={`${styles.metric} ${styles.metricSoon}`}>
          <span className={styles.metricIcon} data-tone="amber">
            <Medal weight="fill" />
          </span>
          <div>
            <b className={styles.metricSoonValue}>Not yet</b>
            <span>Badges earned</span>
          </div>
        </div>
      </div>

      <div className={app.sh}>
        <div className={app.shTitle}>
          <h2>Your most used</h2>
          <span className={app.shSub}>based on the last month</span>
        </div>
        <Link href="/tools" className={app.shLink}>
          All {V2_TOOLS.length}
        </Link>
      </div>

      {/* No credit costs on these cards. Credits live in the sidebar meter and
          the account page only. */}
      <div className={styles.quick}>
        {mostUsed.map((tool) => (
          <Link key={tool.href} href={tool.href} className={styles.qt}>
            <ToolTile icon={tool.icon} solid={toolSolid(tool)} size="md" />
            <h3>{tool.name}</h3>
            <span>{tool.description}</span>
          </Link>
        ))}
      </div>

      <div className={styles.bento}>
        <section className={app.panel}>
          <div className={`${app.sh} ${styles.shFlush}`}>
            <div className={app.shTitle}>
              <h2>Pick up where you left off</h2>
            </div>
            <Link href="/folders" className={app.shLink}>
              Library
            </Link>
          </div>

          {loading ? (
            <p className={styles.quiet}>Loading…</p>
          ) : recent.length === 0 ? (
            <div className={app.empty}>
              <span className={app.emptyIcon}>
                <FileText weight="fill" />
              </span>
              <p className={app.emptyTitle}>{copy["dash.empty.title"]}</p>
              <p className={app.emptyBody}>{copy["dash.empty.body"]}</p>
            </div>
          ) : (
            <div className={app.rows}>
              {recent.map((run) => {
                const tool = v2ToolForSlug(run.tool_slug);
                return (
                  <button
                    key={run.id}
                    type="button"
                    className={app.row}
                    // ?run= reopens THIS run. Without it the row opened an empty
                    // tool and silently discarded what was clicked.
                    onClick={() => tool && router.push(`${tool.href}?run=${run.id}`)}
                  >
                    <ToolTile
                      icon={tool?.icon ?? "file-text"}
                      solid={toolSolid(tool)}
                      size="sm"
                    />
                    <span className={app.rowMain}>
                      <span className={app.rowTitle}>
                        {run.title?.trim() || "Untitled"}
                      </span>
                      <span className={app.rowMeta}>{tool?.name ?? run.tool_slug}</span>
                    </span>
                    <ArrowRight className={styles.rowGo} />
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className={app.panel}>
          <div className={`${app.sh} ${styles.shFlush}`}>
            <div className={app.shTitle}>
              <h2>This week</h2>
            </div>
          </div>
          {/* The timetable is the source for this panel and does not exist yet.
              Showing fabricated lessons would be worse than showing none. */}
          <div className={app.empty}>
            <span className={app.emptyIcon}>
              <CalendarBlank weight="fill" />
            </span>
            <p className={app.emptyTitle}>Your week goes here</p>
            <p className={app.emptyBody}>
              Once you tell Jooma what you teach and when, this shows the lessons
              coming up and what still needs making.
            </p>
          </div>
        </section>
      </div>

      <div className={app.sh}>
        <div className={app.shTitle}>
          <h2>Badges</h2>
        </div>
      </div>
      <section className={app.panel}>
        <div className={app.empty}>
          <span className={app.emptyIcon}>
            <Medal weight="fill" />
          </span>
          <p className={app.emptyTitle}>Badges are on the way</p>
          <p className={app.emptyBody}>
            Ten levels of them, earned for the teaching habits worth building.
            Nothing to collect just yet.
          </p>
        </div>
      </section>
    </AppShellV2>
  );
}
