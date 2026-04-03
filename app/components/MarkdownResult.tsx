import { Fragment } from "react";

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split("\u00A9").join("(c)").split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*"))
      return <em key={i}>{part.slice(1, -1)}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export default function MarkdownResult({ text }: { text: string }) {
  // AI sometimes outputs © (U+00A9) instead of (c) when labelling sub-questions
  const sanitized = text.replace(/\u00A9/g, "(c)");
  const lines = sanitized.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="text-base font-semibold text-gray-900 mt-6 mb-2">
          {renderInline(line.slice(4))}
        </h3>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="text-lg font-bold text-gray-900 mt-8 mb-3 pb-2 border-b border-gray-200">
          {renderInline(line.slice(3))}
        </h2>
      );
    } else if (line.startsWith("# ")) {
      elements.push(
        <h1 key={i} className="text-2xl font-bold text-gray-900 mb-4">
          {renderInline(line.slice(2))}
        </h1>
      );
    } else if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={i} className="border-gray-200 my-6" />);
    } else if (line.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      const [headerLine, , ...bodyLines] = tableLines;
      const headers = headerLine.split("|").filter((c) => c.trim()).map((c) => c.trim());
      const rows = bodyLines.map((row) =>
        row.split("|").filter((c) => c.trim()).map((c) => c.trim())
      );
      elements.push(
        <div key={`table-${i}`} className="my-4 overflow-x-auto">
          <table className="w-full text-sm border-collapse border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {headers.map((h, j) => (
                  <th key={j} className="border border-gray-200 px-4 py-2 text-left font-semibold text-gray-700">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="border border-gray-200 px-4 py-2 text-gray-700" style={{ verticalAlign: "top" }}>{renderInline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    } else if (/^\d+\.\s/.test(line)) {
      const startNum = parseInt(line.match(/^(\d+)\./)?.[1] ?? "1", 10);
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} start={startNum} className="my-3 space-y-1 pl-5 list-decimal">
          {items.map((item, j) => (
            <li key={j} className="text-sm text-gray-700 leading-relaxed pl-1">{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    } else if (/^\s*[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="my-3 space-y-1 pl-5 list-disc">
          {items.map((item, j) => (
            <li key={j} className="text-sm text-gray-700 leading-relaxed pl-1">{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    } else if (line.trim() !== "") {
      elements.push(
        <p key={i} className="text-sm text-gray-700 leading-relaxed my-2">{renderInline(line)}</p>
      );
    }

    i++;
  }

  return <div style={{ fontVariantLigatures: "none" }}>{elements}</div>;
}
