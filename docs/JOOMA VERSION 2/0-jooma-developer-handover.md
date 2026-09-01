# Jooma developer handover

Notes for building the landing page, the web dashboard and the mobile app from the prototypes.

**Files**

| File | What it is |
|---|---|
| `1-jooma-landing.html` | Marketing site, responsive, desktop and mobile in one file |
| `2-jooma-dashboard-web.html` | Web app, seven screens |
| `3-jooma-app-ios.html` | Mobile app, phone frame on desktop, full bleed on a phone |
| `6-jooma-tools.json` | Seed data for all 35 tools |
| `10-jooma-brand-bible.png` | Colour, type, spacing reference |
| `4-jooma-build-spec.md` | Behaviour rules, states, edge cases |
| `5-jooma-tools-system.md` | Naming, icons, credits, language rules |

The prototypes are visual and behavioural references, not production code. Rebuild them properly in your stack. Everything is inlined so you can open any file offline and inspect it.

---

## 1. Shared foundations

Do these first. All three products depend on them.

### Design tokens

Every colour, radius and spacing value is in the brand bible. Put them in one place as CSS custom properties or a theme object. Do not type hex values into components.

The critical ones:

```
--purple: #5B2ED6    brand, buttons, active nav
--deep:   #3A1C8F    dark panels
--bg:     #F7F5FC    page background
--card:   #FFFFFF
--ink:    #1D1730    headings
--body:   #3C3552    paragraphs
--muted:  #6D6683    supporting
--faint:  #9A93AD    metadata only, never body copy
--line:   #EAE6F5    hairlines
```

Category colours for tool tiles are in `6-jooma-tools.json` under `categories[].solid`.

### Typography

Plus Jakarta Sans. Three weights only: 400, 600, 800. Self host it rather than using the Google Fonts CDN, for speed and for GDPR.

### Icons

Phosphor Icons. Install `@phosphor-icons/react`.

Two weights, two jobs:
- **fill** inside coloured tiles, orbs and buttons
- **regular** for interface chrome, nav, chevrons, search

Every tool's icon name is in the JSON.

### The squircle tile

Tool icons sit on a superellipse, not a rounded rectangle. In the prototypes it is an SVG `clipPath` with `clipPathUnits="objectBoundingBox"`, defined once and referenced by CSS `clip-path: url(#sq)`. Copy that approach so it scales at any size.

Tile sizes are tokens, not per-call values:
```
--tile-md: 42px   tool cards, list rows, quick tiles
--tile-sm: 38px   option rows, secondary lists
--tile-lg: 58px   tool page header
```
Glyph is 60% of the tile, centred absolutely.

### Two language rules, enforced in CI

**No em dashes.** Add a lint rule that fails the build on `—` or `–` in any user facing string. Use a full stop, colon or comma.

**No "AI" anywhere a teacher can see.** Not in tool names, buttons, empty states or marketing. Allowed only in the terms, privacy policy and school procurement documents. Also remove sparkle glyphs, wand icons and gradient shimmer.

---

## 2. Landing page

### What is real and what is not

**Real, keep as is:** all copy, the 35 tool names and descriptions, pricing, FAQ, the DfE and UCL statistics with their sources.

**Placeholder, must be replaced before launch:**
- The three demo outputs in the hero. Ash is supplying real Jooma outputs.
- There is no testimonial section yet. Add one with a named teacher, their school and a photo once you have permission. This is the single biggest conversion item still missing.

### The hero demo

This is the most important element on the page. A teacher must understand the product within about four seconds of landing.

Behaviour:
1. On load it runs the Slides build automatically.
2. Three tabs: Slides, Comprehension, Worksheets. Switching tabs reruns the build sequence.
3. The topic field is prefilled and editable. Enter or the button reruns.
4. Suggestion chips replace the topic and rerun.
5. Build sequence is five steps at roughly 420ms each, then the output fades in.
6. `prefers-reduced-motion` skips straight to the output.

The comprehension tab has a reading age switcher, ages 7, 9 and 11. Changing it rewrites both the passage and the questions. **Keep this.** It demonstrates differentiation in a way no description can, and it is the thing that will land with a mixed ability teacher.

Options for production: keep the outputs static and pre-rendered, which is fastest and cheapest, or wire the demo to a real capped endpoint. If you go live, rate limit hard by IP and cache aggressively, because this sits on your highest traffic page.

### Sections, in order

Nav, hero with demo, problem statistics, Slides showcase, Comprehension showcase, Ask Mo showcase, Your staffroom, tools grid, value band, pricing, FAQ, closing, footer.

The tools grid is generated from the same JSON as the app. One source of truth.

### Notes

- Anchors: `#try`, `#tools`, `#pricing`, `#schools`.
- Reveal on scroll uses `IntersectionObserver` with `threshold: 0.1`, unobserving after firing.
- `overflow-x: hidden` on body plus `minmax(0, 1fr)` on grid columns. Without both, the slide thumbnail strip pushes the page wider than the viewport on a phone.
- Pricing has all four tiers. The live site currently shows outdated placeholders, so this needs replacing.
- The footer links to `/refunds`. That page does not exist yet and Stripe will ask for it.

---

## 3. Web dashboard

### Navigation

Sidebar, 250px fixed: Today, Make (35), Library (24), Timetable, Colleagues (6), Ask Mo. Below that, the level box, then credits with a top up button pinned to the bottom.

Counts are live values, not decoration.

### Today

Order matters. This screen starts work rather than reporting on it.

1. **Greeting.** Time aware, plus the next unplanned lesson pulled from the timetable.
2. **Ask Mo card.** Free text goes to intent parsing, then opens the matched tool prefilled.
3. **Metrics.** Day streak, resources made, badges earned, time saved.
4. **Most used tools.** Six, ranked by that teacher's 30 day usage. New users get the six most used product wide.
5. **Pick up where you left off.** Five most recent, each with a share action.
6. **This week.** From the timetable. Lessons with nothing attached get a "Make it" chip that deep links to the right tool with year, subject and topic prefilled.
7. **Badges.** Current level strip.

**Time saved formula:** `resourceCount × 20 minutes`, shown in hours. Never display a zero as a headline. Pre first resource it reads "Let us find out".

### Make

Search filters across name, description and synonyms. Keep the old tool names as hidden synonyms for at least a year, so "worksheet generator" still finds Worksheets and anyone arriving from Google lands correctly.

Category chips filter the sections. No credit costs on the cards.

### Library, behaves like Google Drive

- New folder and Upload buttons, drop zone, breadcrumbs, list and grid toggle.
- Folder grid including a permanent **Unfiled** folder for anything not sorted.
- File rows are `draggable`. Dropping a row on a folder moves it.
- Each row has a three dot menu: Edit, Share with colleagues, Move to folder, Download, Delete.
- A resource belongs to at most one folder.
- Auto filing: a resource generated from a "Make it" chip on a timetabled lesson files into that subject's folder automatically.

### Timetable

Week grid, five days by four slots. Empty cells are click to add and accept a dragged resource. Lessons with nothing attached show an orange "Nothing made" state.

**This needs a data source you do not have yet.** Minimum viable capture: which year group, which subjects, which days. Decide this before building the panel, because "This week" on Today depends on it.

### Colleagues

Search by name, username or email. Invite by email or link, with a referral bonus both ways.

Each colleague shows level plus the same four metrics as your own dashboard: day streak, resources made, badges earned, time saved. Separate "Shared with you" feed.

### Ask Mo

Chat list on the left, conversation in the centre, input docked at the bottom.

Two behaviours that matter:

**Mo never generates directly from free text.** It parses intent, opens the right tool with fields filled, and lets the teacher confirm. Generating straight from a sentence burns credits on misunderstandings and teaches people not to trust it.

**Mo asks a clarifying question when something is ambiguous**, offering two or three concrete options plus a "just build it" escape. This is the behaviour that makes it feel like an assistant rather than a slot machine.

Every Mo reply can be shared with colleagues or saved to the library.

### Account

Profile photo with upload, four headline metrics, full badge collection, plan and usage.

### Credits, in one place only

The sidebar balance, refill date and top up button. Plus the top up modal and the account page. **Nowhere else.** No per tool costs on cards, no chips on list rows.

Top up packs: 500 for £2.49, 1,500 for £5.99, 4,000 for £12.99. Middle pack preselected.

When the balance is below the cost of the current tool, do not block. Replace the cost line with what is needed, change the button to "Top up and build", and complete the job after payment.

### Badges

100 badges across 10 levels, 10 per level. Five metal tiers: bronze, silver, gold, sapphire, amethyst.

The medallion artwork is generated SVG, not image files. `badgeSVG(glyphPath, tier, locked, uid)` composes a scalloped metal edge, ribbon tails, inner disc, glyph and gloss. Port this function directly. It scales to any size and recolours with the brand.

Every badge needs a name and one sentence describing what it represents. The 30 in the prototype are examples. The full 100 is a product decision, not a build task.

**Reward behaviour that helps the teacher, not volume.** A badge for using five different tools is healthy. A badge for generating 500 resources encourages waste and costs you credits.

### Sharing

Available from the library row menu, tool results, Ask Mo replies, recent rows on Today, and next to each colleague.

The model is **copy, not link**. The recipient gets their own editable copy. The sender's original is untouched. Live collaborative editing is a much larger piece of work and should be a separate decision.

---

## 4. Mobile app

### What is different, and why

The mobile app is not a shrunken dashboard. A teacher will not build a twelve slide deck on a phone. It is built around three things that genuinely happen on a phone: capture an idea, check what you already made, and kick off something that finishes while you do something else.

That is why the create button is the centre tab, why there is a microphone in the ask bar, and why every build screen says you can leave and be notified.

### Structure

Five tab bar: Today, Make, centre create button, Library, You. Timetable, Colleagues and Ask Mo are reached from Today and You rather than taking tab slots.

### Native patterns to preserve

- Large titles above the fold, not a centred nav bar title.
- Bottom sheets with a grab handle, sliding up. Not modals dropping in.
- Horizontal rails for the week and tool shortcuts, so scanning is a thumb flick.
- Real toggle switches with a sliding knob.
- Cards scale down slightly on press.
- Safe area insets respected. The file already uses `viewport-fit=cover` and `env(safe-area-inset-bottom)`.

### Layout differences from desktop

| Screen | Desktop | Mobile |
|---|---|---|
| Timetable | Week grid, 5 by 4 | Day cards stacked. A five column grid is unreadable on a phone |
| Badges | Grid with hover tooltip | Grid on Today, full list with visible descriptions on You |
| Colleagues | Row with inline metrics | Card with a 2 by 2 metric block |
| Share | Modal | Bottom sheet |
| Row actions | Three dot dropdown | Action sheet |
| Ask Mo | Chat list sidebar | Horizontal chat history chips |

### The case for native

Push notifications are the main reason to build native rather than wrapping the web app. Two that matter: "your deck is ready" and a Sunday evening "you have nothing for Tuesday's Science yet". Those are worth more for retention than anything on screen.

If you go native, the timetable also enables a home screen widget showing tomorrow's lessons and what is missing.

---

## 5. Data model sketch

```
User            id, name, username, email, photo, yearGroup, school,
                level, badgeCount, streak, resourceCount, minutesSaved,
                creditBalance, creditRefillDate, plan
Tool            id, name, oldName[], category, icon, credits, description
Resource        id, userId, toolId, title, subject, folderId?, body,
                versions[], createdAt, updatedAt
Folder          id, userId, name, colour
TimetableSlot   id, userId, weekday, period, subject, topic, resourceId?
Badge           id, name, description, tier, level, icon, criteria
UserBadge       userId, badgeId, earnedAt
Colleague       userId, colleagueId, status
Share           resourceId, fromUserId, toUserId, savedAt?
CreditLedger    userId, delta, reason, toolId?, createdAt
```

Credits need a ledger, not a running total. You will be asked "where did my credits go" and you need to answer it.

---

## 6. Known traps

These are real bugs I hit while building the prototypes. All three will recur.

**Bare element selectors capture nested content.** `.row span { display: block }` also matched `<span class="tile">` and, at higher specificity, overrode `display: grid`, which pushed every icon to the top left of its tile. Give elements their own class rather than selecting on the tag.

**Size utilities leak onto generated children.** Copying an element's class onto a generated SVG let `.ic.sm { width: 18px }` beat `.tile svg { width: 60% }`. Size tile glyphs with a percentage on the container, never a utility class on the icon.

**Duplicate rules drift.** Four stale tile rules sat below the new ones and quietly won, producing three different tile sizes across two files. One token, one rule.

**Class name collisions.** `.mo` for the Ask Mo card also matched `.msg.mo` in the chat and styled every message as a purple card. Namespace component classes.

---

## 7. Suggested build order

1. Tokens, fonts, icons, squircle tile, the two lint rules.
2. Landing page. It is standalone, it is the acquisition surface, and the current live pricing page is wrong.
3. Auth, tools table seeded from the JSON, credit ledger.
4. Make, tool form, generation, result. The core loop.
5. Library with folders, drag and drop, and the row menu.
6. Today, once there is real usage data to show.
7. Ask Mo intent parsing. Use the cheapest model available: this is routing, not generation.
8. Colleagues and sharing.
9. Badges.
10. Timetable, once the capture flow is decided.
11. Mobile.

---

## 8. Decisions still open

These are product calls, not build tasks. They need answering before the relevant piece is built.

1. **Timetable capture.** How do teachers tell Jooma what they teach and when? Blocks the timetable and half of Today.
2. **The full 100 badges.** Names, descriptions and criteria.
3. **Referral bonus.** The prototype offers 200 credits both ways. Confirm the number.
4. **Per tool credit costs.** Removed from the interface for now. When they are set, they go back on the tool form only, not on cards.
5. **Auto filing rules.** By subject, by half term, or not at all. The prototype assumes subject.
6. **Refunds page.** Does not exist, and Stripe will ask for it.
