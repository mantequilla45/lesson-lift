<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Project docs

Before implementing navigation, routing, loading states, Suspense, skeletons, or URL state, read:

- `docs/instant-navigation-guide.md` — canonical reference for `<Link>`, `loading.tsx`, Suspense streaming, skeleton UI, URL state, debounced search, and the Suspense `key` trick
<!-- END:nextjs-agent-rules -->

# Jooma V2

A UI and feature overhaul is in progress. Before working on the landing page, the dashboard or the mobile app, read:

- `docs/JOOMA VERSION 2/0-jooma-developer-handover.md` — build order, behaviour rules, and six known traps that will recur
- `docs/JOOMA VERSION 2/jooma-brand-bible.png` — colour, type and spacing

Two language rules are enforced by `pnpm lint` (`scripts/check-language.mjs`): no em dashes, and no "AI" in anything a teacher can see. Terms and privacy are exempt.
