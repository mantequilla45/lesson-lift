# Jooma Admin Console — Manual Test Plan

Covers all 20 sidebar items. Written against the **Jooma staging** Supabase
project (`tkvzsqtgsesodifcakko`).

Every test has a **Do**, an **Expect**, and where relevant a **Why it matters** —
because several of these check that the console *refuses* to do something, and
those are easy to skim past as "nothing happened".

---

## Before you start

### Environment

```bash
pnpm dev          # http://localhost:3000
```

Sign in as an admin. Any of these four work:

| Email | Notes |
|---|---|
| `kitkitporcil2@gmail.com` | 58 generations this month — best for testing usage views |
| `admin@jooma.ai` | On the Pro plan |
| `info@jooma.ai` | 2 generations |
| `info@workwhale.ph` | The original seeded admin |

Go to `/admin`. If you land on `/tools` instead, your account doesn't have
`profiles.is_admin = true`.

### The most important thing to know

**Staging starts with no schools, no tickets, no invoices, no flags and no
audit entries.** Empty pages are the *correct* result at first, not a bug.

The plan is ordered so that **Part 2 creates the data Parts 3–7 need.** Run it
in order the first time.

### Test data naming

Prefix everything you create with **`ZZ`** — `ZZ Test Primary`, `ZZTESTCODE`.
It sorts to the bottom and makes cleanup unambiguous. Cleanup SQL is in
Appendix A.

### A note on the Supabase SQL editor

A few tests seed or clean up data there. Be aware it connects as the table
**owner**, which **bypasses row-level security**. That's convenient for setup
and cleanup, but it means the SQL editor is *not* a valid way to test whether a
permission rule works — it will happily do things the app itself is refused.

Where a test checks an actual restriction (7B.3), it uses
`set local role authenticated` to drop to the role the app uses. Don't remove
that line.

### Two known-empty areas

These are built but not fed by anything yet. Empty is expected:

- **Safeguarding flags** — no content filter writes to them ([#28](https://github.com/work-whale/jooma/issues/28))
- **Announcements** — no teacher-facing banner renders them ([#25](https://github.com/work-whale/jooma/issues/25))

---

## Part 0 — Access control

Do these first. If access control is broken, nothing else matters.

### 0.1 Non-admins are refused

**Do:** Sign out. Sign in as `dev@jooma.ai` or `kitkitporcil3@gmail.com`
(neither is an admin). Navigate to `/admin`.

**Expect:** Redirected to `/tools`. No flash of admin content.

### 0.2 Signed-out users are refused

**Do:** Sign out entirely. Visit `/admin/users` directly.

**Expect:** Redirected to `/login`.

### 0.3 The database refuses too, not just the UI

**Why it matters:** the redirect is a convenience. The real boundary is in
Postgres. If this test fails, hiding the UI is worthless.

**Do:** Signed out, in a terminal:

```bash
curl -s -X POST \
  "https://tkvzsqtgsesodifcakko.supabase.co/rest/v1/rpc/admin_users" \
  -H "apikey: <NEXT_PUBLIC_SUPABASE_ANON_KEY from .env.local>" \
  -H "Content-Type: application/json" -d '{}'
```

**Expect:** An error — not a list of teachers. Either `permission denied` (the
anon role has no EXECUTE grant) or `not authorized` (the in-function guard).
Both are correct.

### 0.4 Every page reloads cleanly

**Do:** Visit each of the 20 sidebar links, then hard-refresh (Ctrl+Shift+R) on
each.

**Expect:** No page 500s. Briefly you should see a grey skeleton, then content.

---

## Part 1 — Overview (Dashboard)

`/admin`

### 1.1 Stat tiles

**Do:** Read the eight tiles.

**Expect:** Teachers 10 · Paying 1 · MRR £7.99 · Gross margin ~86% · AI cost
~£1.11 · Generations 60 · Seats 0 · Open tickets 0.

Figures move as you work through this plan — that's the point.

### 1.2 "Needs you today"

**Do:** Read the right-hand panel.

**Expect (before Part 2):** "Nothing needs attention."

**Expect (after Part 2):** Rows appear — an idle school, an overdue invoice, a
high-priority ticket. Each has a working **Open →** link.

### 1.3 Signups chart

**Expect:** Six monthly bars with counts beneath. The footer states that signup
source isn't recorded — that's honest, not a gap in the test.

### 1.4 Margin panel

**Expect:** "What's eating the margin" shows AI-generated images, Audio and Text
generation with share bars summing to 100%.

---

## Part 2 — People

### 2A · Teachers (`/admin/users`)

#### 2A.1 The list

**Expect:** 10 teachers. Four carry a black **ADMIN** badge.

#### 2A.2 Admin bypass indicator

**Why it matters:** admins skip the generation cap. Without this, an admin's 58
generations reads as a free teacher blowing through a 5-generation limit.

**Do:** Find `kitkitporcil2@gmail.com`. Look at Resources.

**Expect:** "58 used · no cap" — **not** a meter showing "0 left of 5". Hover
the ADMIN badge for a tooltip explaining the bypass.

#### 2A.3 Filters

**Do:** Try each: search "kitkit", plan = Free, status, margin = "Losing money".
Then **Clear**.

**Expect:** Row count updates each time; Clear restores all 10.

#### 2A.4 Teacher drawer

**Do:** Click any row.

**Expect:** Drawer slides in from the right (~220ms). Shows This month,
Account, Subscription, Recent activity, Support history, Internal notes.
**Escape closes it.**

#### 2A.5 Grant resources — a real write

**Do:** In the drawer, **Grant resources** → 100 → reason → **Grant**.

**Expect:**
- The modal shows a live cost estimate before you confirm (~£0.86 for 100)
- Toast confirms
- The meter updates **without reopening the drawer**
- Reopen → the top-up is reflected

**Then:** Go to `/admin/audit`. A "Granted 100 resources" entry is there with
your email.

#### 2A.6 Grant AI images

**Do:** Same, but **Grant AI images** → 10.

**Expect:** The estimate is dramatically higher (~£2.84 vs £0.86) — AI images
cost ~33× a text resource, and the modal makes that visible at the moment of
granting.

#### 2A.7 Grant limits

**Do:** Try to grant **600** AI images.

**Expect:** Refused — "AI-image grants are capped at 500". A fat-fingered 1000
would be ~£280 of cost.

---

### 2B · Schools (`/admin/schools`)

#### 2B.1 Empty state

**Expect (first run):** "No schools yet" with an **Onboard a school** button —
not a blank table.

#### 2B.2 Seat price ladder

**Expect:** Four bands: 10–19 £4.25 · 20–49 £3.50 · 50–99 £2.95 · 100+ £2.50.
The 14-seat example reads **£714/year**.

---

### 2C · Onboard a school (`/admin/onboard`)

#### 2C.1 Walk the wizard

**Do:** Six steps. Use **`ZZ Test Primary`**, URN `999999`, Leeds, Primary,
**14 seats**.

**Expect at step 2:** A live price preview — "14 seats × £4.25 = £59.50 a
month", £714 a year, and a green note that it's under £1,000 so most heads can
approve it without governors.

#### 2C.2 Band crossing

**Do:** Still at step 2, change seats to **20**.

**Expect:** Rate drops to £3.50 and a warning appears that this re-prices
**every** seat, not just the new ones. Set it back to 14.

#### 2C.3 Minimum seats

**Do:** Enter **5** seats.

**Expect:** "Minimum is 10 seats." Set back to 14.

#### 2C.4 URL state

**Why it matters:** wizard state in the URL means back/forward and refresh work.

**Do:** At step 3, press browser **Back**.

**Expect:** Returns to step 2, not out of the wizard. URL shows `?step=2`.

#### 2C.5 Create it

**Do:** Complete all six steps. At step 5 add two emails:
`zz.teacher1@test.sch.uk`, `zz.teacher2@test.sch.uk`. Then **Create school**.

**Expect:** Redirected to `/admin/schools` with `ZZ Test Primary` listed —
14 seats, £4.25 band, status **Not started**.

#### 2C.6 Seat pool visualisation

**Do:** Open the school.

**Expect:** 14 small squares — 2 dashed (invited), 12 grey (free). Counts read
Bought 14 · Assigned 0 · Invited 2 · Free 12.

#### 2C.7 The shrink guard

**Why it matters:** without it, shrinking a school silently orphans teachers.

**Do:** **Change seat count** → **10** → Save. (10 ≥ 2 occupied, so this is
allowed.) Then try to invite 9 more teachers, then shrink to **10** again.

**Expect:** Once more than 10 seats are occupied, the shrink is refused:
"cannot drop to 10 seats: N seat(s) are assigned or invited. Reclaim seats
first."

#### 2C.8 Invite handling

**Do:** **Invite teachers** → paste:

```
zz.teacher1@test.sch.uk
not-an-email
zz.teacher3@test.sch.uk
```

**Expect:** Reports fewer invited than pasted — the duplicate and the malformed
address are skipped rather than failing the whole batch.

#### 2C.9 Onboarding checklist

**Do:** Tick "Contract and DPA signed".

**Expect:** Strikethrough; the school's "% set up" rises. An audit entry appears.

---

## Part 3 — Money

### 3A · Plans & pricing (`/admin/plans`)

#### 3A.1 Four plan cards

**Expect:** Free £0 · Pro £7.99 · Max £14.99 · School £4.25/seat. Each shows
resources, AI slideshows, users on plan, and **worst-case contribution**.

#### 3A.2 Worst-case margin

**Why it matters:** this is the number that decides whether a plan is viable.

**Expect:** Pro shows a lower worst-case contribution than its £7.99 price,
because 12 AI slideshows at ~28p each is most of the plan's value.

#### 3A.3 Edit a plan

**Do:** Edit Pro → change the description → Save.

**Expect:** Saves; audit entry appears. The modal states plainly that this does
**not** touch Stripe — Price objects are immutable.

#### 3A.4 Pricing rules

**Do:** Toggle "Show annual as the default option" off, then on.

**Expect:** Both changes persist through a refresh and appear in the audit log.

---

### 3B · Payments & invoices (`/admin/revenue`)

#### 3B.1 Empty state

**Expect (first run):** "No invoices yet", explaining card charges arrive from
Stripe automatically and school invoices are raised manually.

#### 3B.2 Raise an invoice

**Do:** **Raise invoice** → `ZZ Test Primary` → leave amount blank → Create.

**Expect:** A draft with reference `INV-2026-0001`, amount defaulted to a full
year at the banded rate.

#### 3B.3 Overdue is derived

**Do:** In Supabase SQL editor:

```sql
update invoices set status = 'sent', due_at = current_date - 15
where reference like 'INV-2026-%';
```

Refresh the page.

**Expect:** Status now reads **Overdue** — derived from the due date, no nightly
job needed. It also appears in the "act on these" panel at the top, and on the
dashboard's "Needs you today".

#### 3B.4 Mark paid

**Do:** Click **Mark paid**.

**Expect:** Status → Paid; "Collected this month" rises; audit entry appears.

#### 3B.5 Stripe webhook (optional, needs Stripe CLI)

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
stripe trigger invoice.payment_failed
```

**Expect:** A card-type invoice appears with status **failed**. Triggering the
same event twice must produce **one row, not two** — the upsert is keyed on the
Stripe invoice ID.

---

### 3C · Top-ups (`/admin/topups`)

#### 3C.1 Four packs with real margin

**Expect:** 100 resources £3.99 · 300 £8.99 · 10 AI images £2.99 · 25 £5.99.

Margin on **resource** packs is high (~80%+); on **AI-image** packs it's much
thinner. That's deliberate and the footer says so — they exist to stop heavy
users going underwater, not to make money.

#### 3C.2 Edit a pack

**Do:** Edit "10 AI-image slideshows" → price £3.49 → Save.

**Expect:** Live margin recalculation in the modal before saving. Set it back
to £2.99.

---

### 3D · Promo codes (`/admin/promos`)

#### 3D.1 Read-only, live from Stripe

**Why it matters:** Stripe validates codes at checkout. A code that existed only
in our database would be rejected the moment a teacher typed it.

**Expect:** Either an empty state ("No promotion codes in Stripe") or a list of
**real** Stripe codes. There is deliberately **no "create code" button.**

#### 3D.2 Create one in Stripe and see it appear

**Do:** In the Stripe **test-mode** dashboard, create a coupon (50% off, 3
months) and a promotion code `ZZTESTPROMO`. Add metadata `channel` =
`Test campaign`. Refresh the page.

**Expect:** `ZZTESTPROMO` appears — offer reads "50% off 3 months", channel
shows "Test campaign", redemption count 0.

**Cleanup:** Deactivate it in Stripe. (Stripe can't delete promotion codes,
only deactivate — three inert `ZZ*` codes from earlier testing may already be
there.)

---

## Part 4 — Product

### 4A · Usage & margins (`/admin/usage`)

#### 4A.1 Layout

**Expect, top to bottom:** four stats → AI-image callout → two-column grid
("Where the money goes" beside "Thinnest margins") → Model routing → Fair use →
"Every tool" detail table.

#### 4A.2 Headline figures

**Expect:** AI spend ~£1.11 · image share ~17% · cost per active teacher ~£0.55
· gross margin ~86%.

"Cost per active teacher" divides by teachers who **generated something**
(2), not all 10 signups.

#### 4A.3 Thinnest margins excludes admins

**Why it matters:** before this was fixed, both rows here were admin accounts
and the panel reported "2 accounts losing money" — flagging internal testing as
a business problem.

**Expect:** Admin rows show a **bypass** tag and margin reads **internal**, not
a red percentage. The "losing money" count excludes them.

#### 4A.4 Model routing

**Expect:** Real models — `gpt-4o`, `gpt-4o-2024-08-06`, `gpt-4o-mini` — with
per-model cost. `gpt-4o-mini` is tagged green as the cheap one.

#### 4A.5 Fair use toggles

**Do:** Change "Rate limit" from 40 to 50, click away.

**Expect:** Saves, audit entry. The footer notes these aren't enforced yet
([#26](https://github.com/work-whale/jooma/issues/26)).

#### 4A.6 Tool detail table

**Do:** Expand a slideshow row.

**Expect:** Step breakdown children. Columns include 10× and 100× projections.

---

### 4B · Tools (`/admin/tools`)

#### 4B.1 The list

**Expect:** 36 tools, ~26 with real usage. Sorted by cost.

#### 4B.2 The unlisted tool

**Do:** Filter → "Not listed to teachers".

**Expect:** `lesson-slideshow` appears, tagged **not listed**, with a callout
explaining the route exists and can record cost but doesn't appear in the
teacher grid. This is a real, known drift — [#20](https://github.com/work-whale/jooma/issues/20).

#### 4B.3 Toggle a tool off

**Do:** Toggle any tool off, then back on.

**Expect:** Both changes persist and appear in the audit log.

#### 4B.4 Plan gating

**Do:** Click a tool name → untick **free** → Save.

**Expect:** The Plans column updates. Unticking *every* plan shows a red warning
that the tool becomes unreachable. **Restore all four plans afterwards.**

---

### 4C · Safeguarding flags (`/admin/flags`)

#### 4C.1 Empty is expected

**Expect:** "Nothing flagged", explicitly stating that no filter writes to this
table yet — an empty safeguarding page is only reassuring if something is
actually looking.

#### 4C.2 Review flow (needs a seeded row)

**Do:** In Supabase SQL editor:

```sql
insert into safeguarding_flags (user_id, tool_slug, reason, excerpt, severity, status)
values ((select id from profiles limit 1), 'quiz-generator',
        'ZZ TEST — historical violence, WWII topic',
        'Sample excerpt for testing', 'medium', 'review');
```

Refresh, click the row, add a note, click **Clear — false positive**.

**Expect:** Status → Cleared; "Awaiting review" drops to 0; audit entry appears.

---

### 4D · Presentations (`/admin/presentations`)

**Expect:** Recent decks with owner email, title, slide count, date. 57 exist.

---

## Part 5 — Support

### 5A · Inbox (`/admin/inbox`)

#### 5A.1 Empty state

**Expect:** Three-pane layout; left pane says tickets appear when a teacher gets
in touch.

#### 5A.2 Create a ticket

**Do:** In Supabase SQL editor:

```sql
select admin_create_thread(
  (select id from profiles where not is_admin limit 1),
  'ZZ TEST — ran out of resources mid-lesson',
  'Hi, I can add 100 resources to keep you going.', 'high');
```

Refresh `/admin/inbox`.

**Expect:** Ticket appears with a red high-priority dot. Sidebar **Inbox** now
carries a badge.

#### 5A.3 Internal notes — the most important test here

**Why it matters:** getting this wrong is the one mistake in this feature that
reaches a customer.

**Do:** Type a message, click **Add internal note**.

**Expect:**
- Renders in amber, clearly distinct from replies
- Labelled **"Internal note — not visible to the teacher"**
- The ticket stays **unread** — a private note must not make a ticket look
  handled while the teacher is still waiting

#### 5A.4 Reply clears unread

**Do:** Type a reply, click **Send reply**.

**Expect:** Renders dark, right-aligned. Unread dot clears.

#### 5A.5 Canned replies

**Do:** Click "Out of resources".

**Expect:** Composer fills with the seeded wording. Six snippets available.

#### 5A.6 Context rail

**Expect:** Right pane shows the teacher's live resource meter, AI-image chip
and measured cost — so you can answer "have they actually run out?" without
leaving the thread.

#### 5A.7 Assign and resolve

**Do:** **Assign to me**, then **Resolve**.

**Expect:** Status → Closed; ticket leaves the open filter; sidebar badge drops.

#### 5A.8 Drawer integration

**Do:** Go to `/admin/users`, open that teacher's drawer, find **Support
history**.

**Expect:** The ticket is listed — not a "Coming soon" placeholder.

---

## Part 6 — Content

### 6A · Website & app copy (`/admin/copy`)

#### 6A.1 The list

**Expect:** 14 blocks across Landing / Pricing / Teacher dashboard. All **Live**.

#### 6A.2 Draft doesn't go live — the key test

**Why it matters:** RLS is row-level and can't hide a single column, so an
unpublished draft leaking to the public site would be a real incident.

**Do:** Open `home.hero.cta` (currently "Get Started"). Change to
`ZZ Draft Text`. Click **Save draft** (not Publish).

**Expect:**
- Row shows a **Draft** tag and both values ("Live: Get Started")
- A banner reports "1 unpublished change"

**Verify the public view still shows the old text** — in Supabase SQL editor:

```sql
select key, value from public_copy where key = 'home.hero.cta';
```

**Expect:** `Get Started` — **not** `ZZ Draft Text`.

#### 6A.3 Publish and roll back

**Do:** Reopen the block → **Publish now**.

**Expect:** Version increments; Draft tag clears; `public_copy` now returns the
new text.

**Do:** Reopen → **Load history**.

**Expect:** The previous version is listed with who published it and when.
**Restore "Get Started" and publish** to leave things clean.

---

### 6B · Email templates (`/admin/emails`)

#### 6B.1 Known limitation

**Expect:** 12 templates and a prominent callout that **no email provider is
configured** so nothing sends. Engagement columns are deliberately absent
rather than showing invented open rates. Blocked on SendGrid access —
[#24](https://github.com/work-whale/jooma/issues/24).

#### 6B.2 Edit wording

**Do:** Edit "Welcome" → change the subject → Save.

**Expect:** Saves, audit entry. The modal repeats that nothing sends yet.

---

### 6C · Announcements (`/admin/announce`)

#### 6C.1 Known limitation

**Expect:** A callout that the teacher dashboard doesn't render banners yet, so
counts stay at zero — [#25](https://github.com/work-whale/jooma/issues/25).

#### 6C.2 Compose

**Do:** **New announcement** → "ZZ TEST — planned maintenance Sunday" →
Maintenance → Everyone → publish on.

**Expect:** Appears under **Live now**. **Take down** moves it to drafts.

---

## Part 7 — Admin

### 7A · Team & roles (`/admin/team`)

#### 7A.1 The team

**Expect:** Four admins, all **Super admin** (nobody has an explicit role yet,
and the default preserves existing access). One shows a **you** tag.

#### 7A.2 The permission matrix

**Expect:** 11 permissions × 5 roles. Support can grant resources but **not**
issue refunds; Content can edit copy but **not** see teacher accounts.

#### 7A.3 Change a role

**Do:** Change another admin (not yourself) to **Support**.

**Expect:** Saves; audit entry appears.

#### 7A.4 Role enforcement is real, not cosmetic

**Why it matters:** if this only hid buttons, anyone could call the API directly.

**Do:** Sign in as the admin you just made **Support**. Go to `/admin/copy`.

**Expect:** A banner saying your role can view but not change copy. Attempting
to save a draft is refused **by the server**, not just hidden.

**Restore them to Super admin afterwards.**

#### 7A.5 Last-super-admin guard

**Why it matters:** without it, one wrong dropdown leaves nobody able to manage
roles and no way back through the UI.

**Do:** Demote every admin except one to a non-super role, then try to demote
the last one.

**Expect:** Refused — "cannot remove the last super admin".

**Restore everyone to Super admin.**

---

### 7B · Audit log (`/admin/audit`)

#### 7B.1 Everything you did is here

**Expect:** By now, entries for every action in this plan — grants, school
creation, seat changes, invoices, tool toggles, copy publishes, role changes.
Each has timestamp, actor email, action and object.

#### 7B.2 Filters

**Do:** Search "Granted"; filter by actor; filter by type (Account / Billing /
Content / Access).

**Expect:** Results narrow correctly.

#### 7B.3 It's append-only — verify in SQL

**Why it matters:** the page claims "not editable by anyone, including super
admins". That should be enforced by the schema, not just stated.

> **Read this before running it.** The Supabase SQL editor connects as the
> table **owner**, and Postgres lets a table's owner bypass its own RLS
> policies. Running a bare `update` there will report "1 row updated" and look
> like a failure when it isn't. `set local role authenticated` is what makes
> the test meaningful — that's the role the app actually uses.

**Do:** In the Supabase SQL editor, run each block separately:

```sql
-- UPDATE must affect 0 rows
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from profiles where is_admin limit 1))::text, true);
with attempt as (update admin_audit_log set action = 'tampered' returning 1)
select count(*) as rows_updated_expect_0 from attempt;
rollback;
```

```sql
-- DELETE must affect 0 rows
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from profiles where is_admin limit 1))::text, true);
with d as (delete from admin_audit_log returning 1)
select count(*) as rows_deleted_expect_0 from d;
rollback;
```

**Expect:** Both return **0**. There is no UPDATE or DELETE policy on this table
for any role, so an admin acting through the app cannot alter history.

Both statements are wrapped in `begin … rollback`, so nothing is written even
if the guarantee were broken.

---

### 7C · Activity (`/admin/activity`)

**Expect:** Last 100 generations with user email, tool, title, timestamp.

---

### 7D · Settings (`/admin/settings`)

#### 7D.1 Known limitation

**Expect:** A callout that most settings are recorded but **not yet read** by
the app — [#26](https://github.com/work-whale/jooma/issues/26).

#### 7D.2 Toggle persists

**Do:** Toggle "Maintenance mode" on, refresh, toggle off.

**Expect:** State persists; audit entries appear. **The app does not actually
enter maintenance mode** — that's the known gap, not a test failure.

#### 7D.3 Data protection card

**Expect:** Notes that retention and deletion policies aren't implemented —
prompts are kept indefinitely. See [#27](https://github.com/work-whale/jooma/issues/27),
which also covers a live bug: **account deletion currently fails** for any
teacher with a saved presentation.

---

## Part 8 — Cross-cutting

### 8.1 Loading states

**Do:** Throttle to "Slow 3G" in DevTools → Network. Navigate between pages.

**Expect:** Grey skeletons, not blank screens.

### 8.2 Responsive

**Do:** Narrow the window to ~900px.

**Expect:** Stat grids reflow 4→2 columns. Tables scroll horizontally rather
than breaking the page.

### 8.3 Keyboard

**Do:** Open any drawer or modal → press **Escape**. Tab through a form.

**Expect:** Escape closes. Focus rings visible.

### 8.4 Console

**Do:** Keep DevTools console open throughout.

**Expect:** No red errors. React key warnings are worth reporting.

---

## Appendix A — Cleanup

Run in the Supabase SQL editor once testing is done.

```sql
-- Order matters: children before parents.

delete from support_messages where thread_id in (
  select id from support_threads where subject like 'ZZ%');
delete from support_threads where subject like 'ZZ%';

delete from safeguarding_flags where reason like 'ZZ%';
delete from announcements where message like 'ZZ%';

delete from invoices where school_id in (select id from schools where name like 'ZZ%');
delete from school_seats where school_id in (select id from schools where name like 'ZZ%');
delete from school_onboarding_tasks where school_id in (select id from schools where name like 'ZZ%');
delete from school_admins where school_id in (select id from schools where name like 'ZZ%');
update profiles set school_id = null where school_id in (select id from schools where name like 'ZZ%');
delete from schools where name like 'ZZ%';
delete from trusts where name like 'ZZ%';

-- Allowance grants from testing (they expire at month end anyway).
delete from allowance_grants where reason like '%support issue%'
  and created_at > now() - interval '1 day';

-- Restore copy if you left a draft behind.
update copy_blocks set draft = null where draft like 'ZZ%';
```

**Deliberately not deleted:**

- **`admin_audit_log`** — append-only by design. Test entries stay, correctly.
- **Stripe promotion codes** — Stripe can't delete them, only deactivate.
  Deactivate any `ZZ*` codes in the test dashboard.

**Verify cleanup:**

```sql
select 'schools' t, count(*) n from schools where name like 'ZZ%'
union all select 'threads', count(*) from support_threads where subject like 'ZZ%'
union all select 'flags', count(*) from safeguarding_flags where reason like 'ZZ%'
union all select 'announcements', count(*) from announcements where message like 'ZZ%';
-- All should be 0.
```

---

## Appendix B — Reporting a failure

Include:

1. **Which test** (e.g. "5A.3")
2. **Expected vs actual**
3. **Console errors** (DevTools → Console)
4. **Network failure** if any — DevTools → Network, find the red `rpc/...` call,
   copy the response body. The error message from Postgres is usually the whole
   answer.
5. **Who you were signed in as** — several behaviours are role-dependent

---

## Appendix C — Known limitations (not bugs)

Don't raise these; they're tracked:

| Area | Limitation | Issue |
|---|---|---|
| Safeguarding | No filter writes flags | [#28](https://github.com/work-whale/jooma/issues/28) |
| Email | No provider; nothing sends | [#24](https://github.com/work-whale/jooma/issues/24) |
| Announcements | No teacher-facing banner | [#25](https://github.com/work-whale/jooma/issues/25) |
| Settings | Recorded but not enforced | [#26](https://github.com/work-whale/jooma/issues/26) |
| Dashboard | No acquisition/UTM data | [#28](https://github.com/work-whale/jooma/issues/28) |
| Retention | Nothing purged; **account deletion fails** | [#27](https://github.com/work-whale/jooma/issues/27) |
| Tools | `lesson-slideshow` unlisted | [#20](https://github.com/work-whale/jooma/issues/20) |
| Images | Shared read scope | [#22](https://github.com/work-whale/jooma/issues/22) |
