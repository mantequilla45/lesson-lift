# ComprehendAI

A reading comprehension activity generator for teachers. Provide a topic or your own passage, configure reading focuses and complexity, and get a structured activity with questions — and an optional answer key — in seconds.

## Features

- Generate a passage from a topic, or bring your own text
- Select reading focuses (inference, retrieval, vocabulary, etc.)
- Choose complexity level: Simple, Standard, or Challenging
- Configure questions per focus and toggle an answer key
- Edit the generated activity with a rich text editor (bold, italic, headings, lists, alignment)
- Copy the result to clipboard

## Tech Stack

- **Next.js 16** (App Router)
- **Tailwind CSS v4**
- **Anthropic Claude API** (`claude-sonnet-4-6`)
- **TipTap** (rich text editor)
- **Plus Jakarta Sans + Manrope** (typography)

## Getting Started

1. Install dependencies:

```bash
pnpm install
```

2. Create a `.env.local` file in the project root:

```
ANTHROPIC_API_KEY=your_api_key_here
```

3. Run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
