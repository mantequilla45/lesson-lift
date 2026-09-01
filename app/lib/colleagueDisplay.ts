import type { ColleagueProfile } from "@/app/lib/colleagues";

/*
 * How a colleague is rendered.
 *
 * Small, but shared by the Colleagues page, the share picker and the incoming
 * requests panel, and every one of them has to agree: a teacher whose name
 * renders as "Sarah M" in one list and "Sarah" in another looks like two people.
 *
 * These all cope with a null name. profiles.first_name and surname are NOT NULL
 * on the table, but a colleague's row reaches us through a join that can come
 * back empty, and a screen that prints "undefined" at a teacher is worse than
 * one that prints a fallback.
 */

/** Full name where there is one, then the handle, then a last resort. Never an
 *  empty string: this is used as link text and as an accessible name. */
export function displayName(profile: ColleagueProfile): string {
  const full = [profile.first_name, profile.surname]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  if (full) return full;
  if (profile.username) return `@${profile.username}`;
  return "A colleague";
}

/** Up to two letters for the avatar circle. Falls back to the username, then to
 *  a neutral mark rather than an empty circle. */
export function initialsOf(profile: ColleagueProfile): string {
  const parts = [profile.first_name, profile.surname]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  if (parts.length > 0) {
    return parts
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join("");
  }
  if (profile.username) return profile.username.slice(0, 2).toUpperCase();
  return "??";
}

/**
 * The line under a colleague's name.
 *
 * The prototype shows "@sarahm, Year 3, London". Year group and school are not
 * on profiles (school_id is, but it is an admin-managed FK to a school record
 * and not every teacher has one), so this is the handle alone until there is
 * something real to put beside it. An invented "Year 3" would be worse than a
 * short line.
 */
export function metaLine(profile: ColleagueProfile): string {
  return profile.username ? `@${profile.username}` : "Colleague";
}

/**
 * A short relative age, for feed rows: "2d", "4h", "now".
 *
 * The Library shows absolute dates because a resource is filed and found by
 * when it was made. A share is something that just arrived, and "2d" answers
 * the question being asked of it.
 */
export function shortAge(iso: string, now: Date = new Date()): string {
  const ms = now.getTime() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  return `${Math.floor(days / 30)}mo`;
}
