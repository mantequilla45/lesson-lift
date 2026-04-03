# Ultimate Guide: Instant Page Navigation in Next.js (App Router)

This guide documents every technique used in this project to achieve instant, seamless page navigation.
All code examples are taken directly from this codebase.

---

## Table of Contents

1. [How It All Works Together](#1-how-it-all-works-together)
2. [The `<Link>` Component & Auto-Prefetching](#2-the-link-component--auto-prefetching)
3. [Persistent Layouts (Partial Rendering)](#3-persistent-layouts-partial-rendering)
4. [The `loading.tsx` Convention](#4-the-loadingtsx-convention)
5. [Suspense Boundaries & Streaming](#5-suspense-boundaries--streaming)
6. [Skeleton UI Components](#6-skeleton-ui-components)
7. [URL-Based State with `useRouter`](#7-url-based-state-with-userouter)
8. [Debounced Search](#8-debounced-search)
9. [Pagination with URL State](#9-pagination-with-url-state)
10. [Active Link Highlighting with `usePathname`](#10-active-link-highlighting-with-usepathname)
11. [The Suspense `key` Trick](#11-the-suspense-key-trick)
12. [Mental Model: The Full Navigation Flow](#12-mental-model-the-full-navigation-flow)
13. [Common Mistakes to Avoid](#13-common-mistakes-to-avoid)

---

## 1. How It All Works Together

Before diving into individual techniques, here is the big picture. Every mechanism in this project
serves one goal: **make the UI respond instantly, even when data is slow.**

```
User clicks <Link>
        │
        ▼
Next.js intercepts (no full page reload)
        │
        ▼
Persistent layout stays mounted (SideNav never re-renders)
        │
        ▼
New page component renders immediately
        │
        ▼
Suspense boundaries show skeleton UIs instantly
        │
        ▼
Async server components fetch data in parallel (not waterfall)
        │
        ▼
Content streams in as each data fetch resolves
        │
        ▼
Full page visible — no layout shift, no blank flash
```

---

## 2. The `<Link>` Component & Auto-Prefetching

**File:** `app/ui/dashboard/nav-links.tsx`

The foundation of instant navigation. Replace every `<a>` tag with Next.js `<Link>`.

```tsx
import Link from "next/link";

const links = [
  { name: "Home",      href: "/dashboard" },
  { name: "Invoices",  href: "/dashboard/invoices" },
  { name: "Customers", href: "/dashboard/customers" },
];

export default function NavLinks() {
  return (
    <>
      {links.map((link) => (
        <Link key={link.name} href={link.href}>
          {link.name}
        </Link>
      ))}
    </>
  );
}
```

### Why this gives instant navigation

| Behavior | `<a>` tag | `<Link>` component |
|---|---|---|
| Full page reload | Yes | No |
| Client-side transition | No | Yes |
| Auto-prefetch on hover/viewport | No | Yes (production) |
| Preserves layout state | No | Yes |

### How prefetching works

- **Development:** No prefetching (to avoid noise during dev).
- **Production:** When a `<Link>` enters the viewport, Next.js **automatically prefetches** that
  page's JavaScript bundle and RSC payload in the background.
- By the time the user clicks, the destination page is already loaded in memory.

### Controlling prefetch behavior

```tsx
// Default — prefetch in production when link is in viewport
<Link href="/dashboard">Dashboard</Link>

// Always prefetch, even before viewport entry
<Link href="/dashboard" prefetch={true}>Dashboard</Link>

// Disable prefetching entirely
<Link href="/dashboard" prefetch={false}>Dashboard</Link>
```

---

## 3. Persistent Layouts (Partial Rendering)

**File:** `app/dashboard/layout.tsx`

```tsx
import SideNav from "../ui/dashboard/sidenav";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <SideNav />
      <main className="flex grow flex-col p-6">{children}</main>
    </div>
  );
}
```

### What this does

When navigating between `/dashboard`, `/dashboard/invoices`, and `/dashboard/customers`,
**only `{children}` re-renders**. `<SideNav>` stays mounted and never flickers.

This is called **partial rendering** — the shared layout shell is preserved across navigations.

### Why it feels instant

Without a persistent layout, every navigation would:
1. Unmount the entire page tree
2. Re-fetch and re-render the sidebar
3. Cause a flash of unstyled/empty content

With a layout file, the sidebar is rendered **once** and never touched again during navigation within
that segment.

### Rule

Any `layout.tsx` file wraps all child routes within that folder. Nest layouts to control exactly
which UI persists across which navigations.

```
app/
  layout.tsx              ← wraps everything (e.g. <html>, <body>)
  dashboard/
    layout.tsx            ← wraps all /dashboard/* routes (SideNav lives here)
    (overview)/
      page.tsx            ← /dashboard
    invoices/
      page.tsx            ← /dashboard/invoices
```

---

## 4. The `loading.tsx` Convention

**File:** `app/dashboard/(overview)/loading.tsx`

```tsx
import DashboardSkeleton from "../../ui/skeletons";

export default function Loading() {
  return <DashboardSkeleton />;
}
```

### What this does

This is a Next.js file convention. When you create a `loading.tsx` next to a `page.tsx`,
Next.js automatically wraps the page in a `<Suspense>` boundary using your `Loading` component
as the fallback.

You do not need to write `<Suspense>` in the page yourself — it is handled for you.

### The effect

1. User navigates to `/dashboard`
2. `loading.tsx` renders **immediately** (zero delay)
3. In the background, the page's async data fetches run
4. When data is ready, `loading.tsx` is swapped out for the real page

### Route groups keep `loading.tsx` scoped

The folder is named `(overview)` — the parentheses make it a **route group**. This means:
- The URL is still `/dashboard` (not `/dashboard/overview`)
- But `loading.tsx` only applies to the overview page, not to `/dashboard/invoices`

```
app/dashboard/
  (overview)/
    loading.tsx    ← only applies to the overview page
    page.tsx       ← /dashboard
  invoices/
    page.tsx       ← /dashboard/invoices (has its own Suspense, see Section 5)
```

---

## 5. Suspense Boundaries & Streaming

**File:** `app/dashboard/(overview)/page.tsx`

```tsx
import { Suspense } from "react";
import { CardsSkeleton, RevenueChartSkeleton, LatestInvoicesSkeleton } from "@/app/ui/skeletons";
import CardWrapper from "@/app/ui/dashboard/cards";
import RevenueChart from "@/app/ui/dashboard/revenue-chart";
import LatestInvoices from "@/app/ui/dashboard/latest-invoices";

export default async function Page() {
  return (
    <main>
      <h1>Dashboard</h1>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Suspense fallback={<CardsSkeleton />}>
          <CardWrapper />
        </Suspense>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-4 lg:grid-cols-8">
        <Suspense fallback={<RevenueChartSkeleton />}>
          <RevenueChart />
        </Suspense>

        <Suspense fallback={<LatestInvoicesSkeleton />}>
          <LatestInvoices />
        </Suspense>
      </div>
    </main>
  );
}
```

### What this does

Each `<Suspense>` boundary is independent. The three async components — `CardWrapper`,
`RevenueChart`, and `LatestInvoices` — all fetch their data **in parallel**, not in sequence.

### Without Suspense (the bad way)

```tsx
// Bad: data fetches are sequential — each one blocks the next
export default async function Page() {
  const cards = await fetchCards();       // wait...
  const revenue = await fetchRevenue();   // wait...
  const invoices = await fetchInvoices(); // wait...
  // Page only renders after all three finish
}
```

### With Suspense (the right way)

```tsx
// Good: data fetches happen in parallel
// The page renders immediately with skeletons
// Each section streams in as its data resolves

export default async function Page() {
  return (
    <main>
      <Suspense fallback={<CardsSkeleton />}>
        <CardWrapper />        {/* fetches cards independently */}
      </Suspense>

      <Suspense fallback={<RevenueChartSkeleton />}>
        <RevenueChart />       {/* fetches revenue independently */}
      </Suspense>

      <Suspense fallback={<LatestInvoicesSkeleton />}>
        <LatestInvoices />     {/* fetches invoices independently */}
      </Suspense>
    </main>
  );
}
```

### Streaming explained

With the App Router, Next.js uses **HTTP streaming** (chunked transfer encoding) to send HTML
progressively. When you wrap a component in `<Suspense>`:

1. Next.js sends the initial HTML with the skeleton fallback immediately
2. As each async component resolves on the server, Next.js streams the real HTML chunk down the wire
3. React replaces the skeleton with the real content client-side

The browser starts rendering and displaying content before the full response is complete.

### When to add a Suspense boundary

Add one around any component that:
- Does an `async/await` data fetch
- Could be slow or dependent on an external service
- Should not block other parts of the page from showing

---

## 6. Skeleton UI Components

**File:** `app/ui/skeletons.tsx`

Skeletons are placeholder UIs that match the shape of the real content. They prevent layout shift
and give users immediate visual feedback that something is loading.

### The shimmer animation

```tsx
const shimmer =
  'before:absolute before:inset-0 before:-translate-x-full ' +
  'before:animate-[shimmer_2s_infinite] ' +
  'before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent';
```

This uses a CSS pseudo-element (`::before`) with a sliding gradient that creates the "shimmer"
sweep animation. The animation is defined in Tailwind's arbitrary `animate-[shimmer_2s_infinite]`
syntax, which references a keyframe defined in `tailwind.config.ts`.

### Skeleton component example

```tsx
export function CardSkeleton() {
  return (
    <div className={`${shimmer} relative overflow-hidden rounded-xl bg-gray-100 p-2 shadow-sm`}>
      <div className="flex p-4">
        <div className="h-5 w-5 rounded-md bg-gray-200" />       {/* icon placeholder */}
        <div className="ml-2 h-6 w-16 rounded-md bg-gray-200" /> {/* title placeholder */}
      </div>
      <div className="flex items-center justify-center truncate rounded-xl bg-white px-4 py-8">
        <div className="h-7 w-20 rounded-md bg-gray-200" />       {/* value placeholder */}
      </div>
    </div>
  );
}
```

### Rules for good skeletons

1. **Match the real layout exactly** — same grid, same dimensions, same spacing. This prevents
   layout shift when real content replaces the skeleton.
2. **Use `relative` + `overflow-hidden`** on the wrapper so the shimmer pseudo-element is clipped.
3. **Compose from smaller pieces** — `CardSkeleton` → `CardsSkeleton` → `DashboardSkeleton`.
   This mirrors how real components are composed, making maintenance easier.
4. **Do not put interactive elements in skeletons** — they are purely visual.

### Skeleton hierarchy in this project

```
DashboardSkeleton          ← used by loading.tsx
  ├── CardSkeleton × 4     ← used by CardsSkeleton
  ├── RevenueChartSkeleton
  └── LatestInvoicesSkeleton
      └── InvoiceSkeleton × 5

InvoicesTableSkeleton      ← used by invoices/page.tsx Suspense
  ├── InvoicesMobileSkeleton × 6  (mobile view)
  └── TableRowSkeleton × 6        (desktop table)
```

---

## 7. URL-Based State with `useRouter`

**File:** `app/ui/search.tsx`

```tsx
"use client";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useDebouncedCallback } from "use-debounce";

export default function Search({ placeholder }: { placeholder: string }) {
  const searchParams = useSearchParams();
  const pathName = usePathname();
  const { replace } = useRouter();

  const handleSearch = useDebouncedCallback((term: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", "1");
    if (term) {
      params.set("query", term);
    } else {
      params.delete("query");
    }
    replace(`${pathName}?${params.toString()}`);
  }, 300);

  return (
    <input
      onChange={(e) => handleSearch(e.target.value)}
      defaultValue={searchParams.get("query")?.toString()}
    />
  );
}
```

### Why URL state instead of `useState`

| Concern | `useState` | URL state |
|---|---|---|
| Shareable URL | No | Yes |
| Bookmarkable | No | Yes |
| Back button works | No | Yes |
| Page refresh persists state | No | Yes |
| Works without JavaScript | No | Yes (SSR reads params) |

### `router.replace()` vs `router.push()`

- **`replace`**: Replaces the current history entry. The back button goes to the page *before*
  the search, not to each individual keystroke. Used here because each keystroke is not a
  meaningful navigation step.
- **`push`**: Adds a new history entry. Use this when navigating to a new "page" that the user
  should be able to go back to.

### Reading URL params on the server

Because the state lives in the URL, the server page can read it directly from `searchParams`:

```tsx
// app/dashboard/invoices/page.tsx
export default async function Page(props: {
  searchParams?: Promise<{ query?: string; page?: string }>;
}) {
  const searchParams = await props.searchParams;
  const query = searchParams?.query || "";
  const currentPage = parseInt(searchParams?.page || "1", 10);

  // Pass directly to components — no client state needed
  return <Table query={query} currentPage={currentPage} />;
}
```

---

## 8. Debounced Search

**File:** `app/ui/search.tsx`

```tsx
import { useDebouncedCallback } from "use-debounce";

const handleSearch = useDebouncedCallback((term: string) => {
  // Only runs 300ms after the user stops typing
  replace(`${pathName}?${params.toString()}`);
}, 300);
```

### Why debounce matters for navigation

Without debounce, every single keystroke triggers:
1. A `router.replace()` call
2. A URL update
3. A React re-render of the page
4. A new database query on the server

With a 300ms debounce, if the user types "acme corp" (9 characters), only **1** navigation happens
instead of **9**.

### How `useDebouncedCallback` works

```
User types: a → c → m → e
                           ↑ 300ms passes with no new input
                           → handleSearch("acme") fires ONCE
```

The `use-debounce` package wraps the callback so it only executes after the specified delay has
passed since the last invocation. Any call within the delay window resets the timer.

### Package installation

```bash
npm install use-debounce
```

---

## 9. Pagination with URL State

**File:** `app/ui/invoices/pagination.tsx`

```tsx
"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export default function Pagination({ totalPages }: { totalPages: number }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentPage = Number(searchParams.get("page") || 1);

  const createPageURL = (pageNumber: number | string) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", pageNumber.toString());
    return `${pathname}?${params.toString()}`;
  };

  return (
    <div className="inline-flex">
      <Link href={createPageURL(currentPage - 1)}>←</Link>
      {/* page number links */}
      <Link href={createPageURL(currentPage + 1)}>→</Link>
    </div>
  );
}
```

### Key pattern: preserve existing search params

`new URLSearchParams(searchParams)` copies all current params (including `query`) before setting
`page`. This means paginating while searching keeps the search term in the URL.

```
/invoices?query=acme&page=1  →  click page 2  →  /invoices?query=acme&page=2
                                                  ✓ query param preserved
```

Without this pattern:
```
/invoices?query=acme&page=1  →  click page 2  →  /invoices?page=2
                                                  ✗ query param lost
```

### Using `<Link>` for pagination (not `router.push`)

Pagination links use `<Link>` rather than programmatic navigation because:
- They benefit from auto-prefetching (next page is prefetched when visible)
- They are semantically correct anchor elements
- They work without JavaScript

---

## 10. Active Link Highlighting with `usePathname`

**File:** `app/ui/dashboard/nav-links.tsx`

```tsx
"use client";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {links.map((link) => (
        <Link
          key={link.name}
          href={link.href}
          className={clsx(
            "flex h-[48px] items-center rounded-md bg-gray-50 p-3 text-sm font-medium",
            {
              "bg-sky-100 text-blue-600": pathname === link.href, // active state
            }
          )}
        >
          {link.name}
        </Link>
      ))}
    </>
  );
}
```

### Why `usePathname` requires `"use client"`

`usePathname` is a React hook that reads the browser's current URL. Hooks can only run in client
components. However, this does not mean the whole navigation is client-rendered — only this small
interactive piece needs to be a client component.

The rest of `SideNav` can remain a server component, importing this `NavLinks` client component.

### `clsx` for conditional classes

`clsx` merges class strings and evaluates conditions:

```tsx
clsx(
  "always-applied-classes",
  {
    "applied-when-true": condition,  // applied only when pathname === link.href
  }
)
```

---

## 11. The Suspense `key` Trick

**File:** `app/dashboard/invoices/page.tsx`

```tsx
<Suspense key={query + currentPage} fallback={<InvoicesTableSkeleton />}>
  <Table query={query} currentPage={currentPage} />
</Suspense>
```

### The problem this solves

By default, React reuses a `<Suspense>` boundary if it stays in the same position in the tree.
If the user searches for "acme" and the table data loads, the Suspense boundary is now
*resolved*. When they then search for "globex", React might reuse the same boundary and
**not show the skeleton again** — the user sees stale data until new data arrives.

### The solution

Passing `key={query + currentPage}` tells React to treat this as a **completely new** Suspense
boundary whenever the query or page changes. React unmounts the old boundary, mounts a fresh one,
and the `InvoicesTableSkeleton` fallback is shown immediately while the new data loads.

```
User searches "acme" → key="acme1" → skeleton shown → table loads
User searches "globex" → key="globex1" → NEW boundary → skeleton shown again → table loads
```

Without the key, the second search would show stale "acme" results until "globex" loads.

---

## 12. Mental Model: The Full Navigation Flow

Here is a complete walkthrough of what happens when a user types in the search box:

```
1. User types "acme" in the search input
        │
        ▼
2. onChange fires → useDebouncedCallback starts 300ms timer
        │
        ▼  (300ms passes with no new input)
        │
        ▼
3. handleSearch("acme") runs
   → builds URLSearchParams { query: "acme", page: "1" }
   → calls router.replace("/dashboard/invoices?query=acme&page=1")
        │
        ▼
4. Next.js client-side navigation triggers
   → no full page reload
   → SideNav stays mounted (persistent layout)
        │
        ▼
5. invoices/page.tsx re-renders on the server
   → reads searchParams: { query: "acme", page: "1" }
   → renders <Suspense key="acme1" fallback={<InvoicesTableSkeleton />}>
        │
        ▼
6. InvoicesTableSkeleton streams to the browser IMMEDIATELY
   → user sees skeleton with shimmer animation instantly
        │
        ▼
7. <Table query="acme" currentPage={1}> fetches from DB on server
        │
        ▼
8. DB query completes → Table component renders
   → streamed to browser as an HTML chunk
   → React swaps skeleton for real table content
        │
        ▼
9. User sees filtered results — no full page reload, no blank screen
```

---

## 13. Common Mistakes to Avoid

### Mistake 1: Fetching data in Client Components

```tsx
// Bad: forces data fetch to happen in browser, delays render
"use client";
export default function Table() {
  const [data, setData] = useState([]);
  useEffect(() => {
    fetch("/api/invoices").then(r => r.json()).then(setData);
  }, []);
  return <table>{data.map(...)}</table>;
}

// Good: async Server Component — data fetches on server, streams to client
export default async function Table() {
  const data = await fetchInvoices();
  return <table>{data.map(...)}</table>;
}
```

### Mistake 2: No Suspense boundary around slow components

```tsx
// Bad: entire page waits for the slowest component
export default async function Page() {
  return (
    <main>
      <SlowCards />    {/* takes 2s */}
      <FastChart />    {/* takes 200ms — forced to wait for SlowCards */}
    </main>
  );
}

// Good: each component loads independently
export default async function Page() {
  return (
    <main>
      <Suspense fallback={<CardsSkeleton />}>
        <SlowCards />
      </Suspense>
      <Suspense fallback={<ChartSkeleton />}>
        <FastChart />  {/* renders in 200ms, not blocked */}
      </Suspense>
    </main>
  );
}
```

### Mistake 3: Using `<a>` instead of `<Link>`

```tsx
// Bad: full page reload on every click
<a href="/dashboard/invoices">Invoices</a>

// Good: client-side navigation, no reload
<Link href="/dashboard/invoices">Invoices</Link>
```

### Mistake 4: Forgetting the Suspense `key` on query-driven content

```tsx
// Bad: skeleton only shows on first load; subsequent searches show stale data
<Suspense fallback={<TableSkeleton />}>
  <Table query={query} />
</Suspense>

// Good: skeleton re-shows every time query changes
<Suspense key={query + currentPage} fallback={<TableSkeleton />}>
  <Table query={query} currentPage={currentPage} />
</Suspense>
```

### Mistake 5: Storing navigation state in `useState` instead of URL

```tsx
// Bad: state lost on refresh, not shareable, back button broken
const [query, setQuery] = useState("");

// Good: state in URL, shareable, bookmarkable, SSR-compatible
const { replace } = useRouter();
replace(`/invoices?query=${term}`);
```

### Mistake 6: Not debouncing search inputs

```tsx
// Bad: fires a navigation + server request on every keystroke
<input onChange={(e) => replace(`/invoices?query=${e.target.value}`)} />

// Good: waits for user to stop typing
const handleSearch = useDebouncedCallback((term) => {
  replace(`/invoices?query=${term}`);
}, 300);
<input onChange={(e) => handleSearch(e.target.value)} />
```

---

## Summary: The Six Pillars of Instant Navigation

| Pillar | File(s) | What it does |
|---|---|---|
| `<Link>` + auto-prefetch | `nav-links.tsx`, `pagination.tsx` | Client-side transitions, pre-loads pages |
| Persistent layout | `dashboard/layout.tsx` | Sidebar never re-renders |
| `loading.tsx` | `(overview)/loading.tsx` | Instant skeleton on route entry |
| Suspense + streaming | `page.tsx` files | Independent parallel data loading |
| Skeleton UI | `skeletons.tsx` | Instant visual feedback, no layout shift |
| URL state | `search.tsx`, `pagination.tsx` | Shareable, bookmarkable, SSR-compatible |
