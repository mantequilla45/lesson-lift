import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/app/lib/auth/server";
import { v2ToolForSlug, toolSolid } from "@/app/lib/tools";
import { SquircleDefs, ToolTile } from "@/app/components/v2/Squircle";
import Wordmark from "@/app/components/v2/Wordmark";
import styles from "./welcome.module.css";

/*
 * The first screen a new teacher sees.
 *
 * Reached once, from the end of /complete-profile, which both the email and the
 * Google signup paths pass through. Signing in goes straight to /tools, so this
 * is not a screen anyone has to dismiss twice. Nothing is persisted to mark it
 * seen: it is a one-shot redirect target, not a flag on the profile.
 *
 * It sits outside the (app) route group deliberately, so it inherits the bare
 * root layout rather than the signed-in shell, the same way every other page in
 * the signup funnel opts out. That means SquircleDefs has to be mounted here:
 * `clip-path: url(#jsq)` resolves against the current document, and without it
 * every tool tile renders as an unclipped square.
 */

export const metadata = { title: "Welcome to Jooma" };

/** Four tools worth opening first, one from each of four categories so the
 *  tiles read as different kinds of job rather than a row of one colour. */
const FIRST_STOPS = ["slideshow", "lesson-planner", "worksheet-generator", "quiz-generator"];

export default async function WelcomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name")
    .eq("id", user.id)
    .maybeSingle();

  const firstName = (profile?.first_name ?? "").trim();

  // A tool that has been renamed out of the catalogue is dropped rather than
  // rendered as a blank tile, matching how the rest of the app treats a miss.
  const tools = FIRST_STOPS.map((slug) => v2ToolForSlug(slug)).filter((t) => !!t);

  return (
    <main className={styles.page}>
      <SquircleDefs />
      <div className={styles.shell}>
        <span className={styles.mark}>
          <Wordmark height={28} />
        </span>

        <h1 className={styles.title}>
          {firstName ? `Welcome to Jooma, ${firstName}` : "Welcome to Jooma"}
        </h1>
        <p className={styles.lede}>
          Everything you need for tomorrow is here, and most of it takes about a minute.
          Pick something to make first.
        </p>

        <ul className={styles.grid}>
          {tools.map((tool) => (
            <li key={tool.href}>
              <Link href={tool.href} className={styles.card}>
                <ToolTile icon={tool.icon} solid={toolSolid(tool)} />
                <span className={styles.cardText}>
                  <span className={styles.cardName}>{tool.name}</span>
                  <span className={styles.cardDesc}>{tool.description}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <Link href="/tools" className={styles.cta}>
          Go to my tools
        </Link>
        <p className={styles.foot}>All thirty five tools are waiting there.</p>
      </div>
    </main>
  );
}
