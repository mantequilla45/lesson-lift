/**
 * Hero demo content.
 *
 * PLACEHOLDER. Every output below is written by hand to look like a Jooma
 * result, and none of it came out of the product. Ash is supplying real Jooma
 * outputs to replace them. Swap the values here and the hero picks them up; no
 * component needs editing.
 *
 * The demo is deliberately static rather than wired to a live endpoint. This
 * is the highest traffic page on the site, so a real generation here would
 * need hard IP rate limiting and aggressive caching, and would risk a slow or
 * failed first impression at the exact moment a teacher is deciding whether
 * the product is worth a signup.
 */

export type DemoTabId = "slides" | "comp" | "ws";

export const DEMO_TABS: { id: DemoTabId; label: string; icon: string; solid: string }[] = [
  { id: "slides", label: "Slides", icon: "presentation-chart", solid: "#5B2ED6" },
  { id: "comp", label: "Comprehension", icon: "book-open-text", solid: "#0F8A63" },
  { id: "ws", label: "Worksheets", icon: "file-text", solid: "#0F8A63" },
];

/** Prefills the topic field. Editable, and Enter reruns the build. */
export const DEMO_TOPIC = "The water cycle, Year 4 Science";

/** Replace the topic and rerun. */
export const DEMO_CHIPS = [
  "Equivalent fractions, Year 4",
  "Ancient Egypt, Year 5",
  "Persuasive writing, Year 6",
];

/**
 * The build sequence. Five steps, then the output.
 *
 * These name real stages of the work rather than decorating the wait: a
 * teacher reading them learns what the product actually does to their topic.
 */
export const BUILD_STEPS = [
  "Checking the national curriculum",
  "Structuring the content",
  "Writing the activities",
  "Differentiating three ways",
  "Laying it out",
];

/** Milliseconds per build step, and the pause before the output appears. */
export const STEP_MS = 420;
export const REVEAL_MS = 380;

// ── Slides ───────────────────────────────────────────────────────────────────

export const DEMO_SLIDE = {
  title: "Evaporation",
  body: "The sun heats water in rivers, lakes and the sea. The water turns into a gas called water vapour and rises into the air.",
  bullets: [
    "Heat gives water particles energy",
    "Water vapour is invisible",
    "Warmer air holds more vapour",
  ],
  activity: {
    label: "Quick check",
    text: "Where does the energy for evaporation come from?",
  },
  /** Which thumbnail in the strip is the one on screen. */
  activeThumb: 2,
  thumbCount: 5,
  actions: ["Present", "Export to PowerPoint", "Change theme", "Add a video"],
};

// ── Comprehension ────────────────────────────────────────────────────────────

export type ReadingAge = 7 | 9 | 11;

export const READING_AGES: { age: ReadingAge; label: string; note: string; source: string }[] = [
  { age: 7, label: "Age 7", note: "Short sentences, everyday words", source: "Age 7, simplified" },
  { age: 9, label: "Age 9", note: "Expected for Year 4", source: "Age 9, expected for Year 4" },
  { age: 11, label: "Age 11", note: "Greater depth, subject vocabulary", source: "Age 11, greater depth" },
];

export const DEMO_COMPREHENSION_TITLE = "Where does rain come from?";

/**
 * The same text at three reading ages, with the questions rewritten to match.
 *
 * This is the most convincing thing on the page. A mixed ability teacher
 * understands differentiation from watching one press change both the passage
 * and the questions, in a way no description achieves.
 */
export const DEMO_COMPREHENSION: Record<ReadingAge, { paragraphs: string[]; questions: string[] }> = {
  7: {
    paragraphs: [
      "The sun warms the sea. Tiny bits of water float up into the sky. This is called evaporation.",
      "High up, the air is cold. The water cools and makes clouds. When the drops get heavy, they fall as rain.",
      "The rain runs into rivers. The rivers carry it back to the sea, and it all starts again.",
    ],
    questions: [
      "What warms the sea?",
      "What is it called when water goes up into the sky?",
      "Why do the drops fall?",
      "Draw the journey water takes, from sea to rain to river.",
    ],
  },
  9: {
    paragraphs: [
      "Heat from the sun warms the surface of the sea. Water changes into an invisible gas called water vapour and rises. We call this evaporation.",
      "Higher up, the air is much colder. The vapour cools and turns back into tiny droplets, which gather together as clouds. Once the droplets grow heavy enough, they fall as rain.",
      "That rain collects in streams and rivers, which carry it back to the sea. The whole cycle then begins again.",
    ],
    questions: [
      "Explain what happens during evaporation.",
      "Why does water vapour turn back into droplets high in the sky?",
      "What has to happen before rain falls?",
      "Describe the water cycle in your own words, using all four stages.",
    ],
  },
  11: {
    paragraphs: [
      "Solar radiation warms the ocean surface, supplying enough energy for liquid water to change state and become water vapour. This process, evaporation, moves vast quantities of water into the atmosphere without any of it being visible.",
      "As the vapour rises, temperature falls. The vapour condenses around microscopic particles of dust and salt, forming the droplets we see as cloud. Precipitation occurs only once those droplets coalesce enough to overcome the updraught holding them aloft.",
      "Surface runoff and groundwater return the water to the ocean, closing a cycle that has been running, more or less unchanged, for billions of years.",
    ],
    questions: [
      "Explain why evaporation requires an input of energy.",
      "What role do dust particles play in cloud formation?",
      "Why does precipitation not occur as soon as clouds form?",
      "Evaluate the claim that the water cycle is a closed system.",
    ],
  },
};

// ── Worksheets ───────────────────────────────────────────────────────────────

/** The three attainment bands, in the order they are printed. */
export const DEMO_WORKSHEET: { band: string; tone: "a" | "b" | "c"; title: string; questions: string[] }[] = [
  {
    band: "Working towards",
    tone: "a",
    title: "Label the cycle",
    questions: [
      "Colour the sun yellow.",
      "Draw an arrow from the sea to the cloud.",
      "Match the word to the picture: rain, cloud, sea.",
      "Finish the sentence: The sun makes the water ____.",
    ],
  },
  {
    band: "Expected",
    tone: "b",
    title: "Explain the cycle",
    questions: [
      "Name the four stages of the water cycle.",
      "Explain what happens during condensation.",
      "True or false: clouds are made of steam.",
      "Write a caption for each stage of the diagram.",
    ],
  },
  {
    band: "Greater depth",
    tone: "c",
    title: "Apply and reason",
    questions: [
      "Why does it rain more over mountains?",
      "Predict what happens to the cycle in a drought.",
      "A puddle disappears on a cold day. Explain how.",
      "Design an experiment to show condensation.",
    ],
  },
];
