export function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

export const CURRICULA = [
  { label: "2014 National Curriculum", value: "2014 National Curriculum" },
  { label: "Early Years Foundation Stage (EYFS)", value: "Early Years Foundation Stage (EYFS)" },
  { label: "Scottish Curriculum for Excellence", value: "Scottish Curriculum for Excellence" },
  { label: "Welsh Curriculum", value: "Welsh Curriculum" },
  { label: "Northern Ireland Curriculum", value: "Northern Ireland Curriculum" },
];

export const YEAR_GROUPS = [
  "Nursery", "Reception",
  "Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6",
  "Year 7", "Year 8", "Year 9", "Year 10", "Year 11",
];
