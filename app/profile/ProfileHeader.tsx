"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Avatar from "@/app/components/ui/Avatar";
import { createClient } from "@/app/lib/auth/client";
import { useProfileIdentity } from "@/app/lib/useProfileIdentity";
import { listRecentRuns } from "@/app/lib/toolRuns";
import { minutesSavedFor } from "@/app/lib/tools";
import { asPlanId, PLANS } from "@/app/lib/plans";
import styles from "./ProfileHeader.module.css";

/*
 * The banner above the settings menu: who you are, and what you have made.
 *
 * The name and photo come from the shared identity store rather than a fetch of
 * their own, so this and the top bar can never disagree about which photo is
 * current — the profile form publishes to that store when it saves.
 *
 * Two of the mockup's four stats have no data behind them: there is no level and
 * no badge earning yet. They are rendered as "not yet" rather than as a zero,
 * which is the same rule Today follows. A zero here would read as a judgement on
 * the teacher rather than on the feature.
 */
export default function ProfileHeader() {
  const identity = useProfileIdentity();
  const [plan, setPlan] = useState<string | null>(null);
  const [joined, setJoined] = useState<string | null>(null);
  const [stats, setStats] = useState<{ resources: number; hours: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user || cancelled) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("plan")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;

      setPlan(PLANS[asPlanId(profile?.plan)].name);
      // created_at is on the auth user, not the profile row.
      if (user.created_at) setJoined(user.created_at);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    listRecentRuns(1000)
      .then((runs) => {
        if (cancelled) return;
        const minutes = runs.reduce((sum, r) => sum + minutesSavedFor(r.tool_slug), 0);
        setStats({ resources: runs.length, hours: Math.round(minutes / 60) });
      })
      .catch(() => {
        if (!cancelled) setStats({ resources: 0, hours: 0 });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const name = identity?.name?.trim();

  return (
    <header className={styles.head}>
      {/* The photo is changed in Personal info, which is one click away, so this
          links there rather than carrying a second uploader. */}
      <Link
        href="/profile?section=personal"
        className={styles.avatar}
        aria-label="Change your photo in Personal info"
      >
        <Avatar url={identity?.avatarUrl ?? null} name={name ?? ""} size={84} />
      </Link>

      <div className={styles.who}>
        <h1 className={styles.name}>{name || "Your profile"}</h1>
        <p className={styles.meta}>
          {[
            plan,
            joined
              ? `Joined ${new Date(joined).toLocaleDateString("en-GB", {
                  month: "long",
                  year: "numeric",
                })}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      <dl className={styles.stats}>
        <div className={styles.stat}>
          <dt>Resources</dt>
          <dd>{stats ? stats.resources : "—"}</dd>
        </div>
        <div className={styles.stat}>
          <dt>Time saved</dt>
          {/* Never a zero headline: before the first resource there is no figure
              worth showing, and under an hour rounds to 0h. */}
          <dd>
            {!stats
              ? "—"
              : stats.resources === 0
                ? "Not yet"
                : stats.hours === 0
                  ? "< 1h"
                  : `${stats.hours}h`}
          </dd>
        </div>
        <div className={`${styles.stat} ${styles.statSoon}`}>
          <dt>Level</dt>
          <dd>Not yet</dd>
        </div>
        <div className={`${styles.stat} ${styles.statSoon}`}>
          <dt>Badges</dt>
          <dd>Not yet</dd>
        </div>
      </dl>
    </header>
  );
}
