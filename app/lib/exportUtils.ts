import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  NumberFormat,
  BorderStyle,
} from "docx";

// --- Inline parser: turns **bold** / *italic* into TextRuns ---
function parseInlineRuns(text: string): TextRun[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts
    .filter((p) => p !== "")
    .map((part) => {
      if (part.startsWith("**") && part.endsWith("**"))
        return new TextRun({ text: part.slice(2, -2), bold: true });
      if (part.startsWith("*") && part.endsWith("*"))
        return new TextRun({ text: part.slice(1, -1), italics: true });
      return new TextRun({ text: part });
    });
}

// --- DOCX export ---
export async function exportToDocx(text: string, filename: string) {
  const lines = text.split("\n");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const children: any[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("### ")) {
      children.push(new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3 }));
    } else if (line.startsWith("## ")) {
      children.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 }));
    } else if (line.startsWith("# ")) {
      children.push(new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1 }));
    } else if (/^---+$/.test(line.trim())) {
      children.push(
        new Paragraph({
          text: "",
          border: {
            bottom: { color: "AAAAAA", space: 1, size: 6, style: BorderStyle.SINGLE },
          },
        })
      );
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
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              tableHeader: true,
              children: headers.map(
                (h) =>
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
                  })
              ),
            }),
            ...rows.map(
              (row) =>
                new TableRow({
                  children: row.map(
                    (cell) =>
                      new TableCell({ children: [new Paragraph({ children: parseInlineRuns(cell) })] })
                  ),
                })
            ),
          ],
        })
      );
      continue;
    } else if (/^\d+\.\s/.test(line)) {
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        const t = lines[i].replace(/^\d+\.\s+/, "");
        children.push(
          new Paragraph({
            children: parseInlineRuns(t),
            numbering: { reference: "ordered-list", level: 0 },
          })
        );
        i++;
      }
      continue;
    } else if (/^\s*[-*]\s/.test(line)) {
      while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) {
        const t = lines[i].replace(/^\s*[-*]\s+/, "");
        children.push(new Paragraph({ children: parseInlineRuns(t), bullet: { level: 0 } }));
        i++;
      }
      continue;
    } else if (line.trim()) {
      children.push(new Paragraph({ children: parseInlineRuns(line) }));
    } else {
      children.push(new Paragraph({ text: "" }));
    }

    i++;
  }

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "ordered-list",
          levels: [
            {
              level: 0,
              format: NumberFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 260 } } },
            },
          ],
        },
      ],
    },
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, `${filename}.docx`);
}

// --- Real PDF export ---
/**
 * Download an actual .pdf file.
 *
 * Distinct from the "Print" action, which hands buildPdfHtml() to a hidden
 * iframe and opens the browser's print dialog — leaving the teacher to choose
 * "Save as PDF" themselves, and producing nothing at all if they cancel. Both
 * are kept: printing to paper is a real use, and this is not a replacement for
 * it.
 *
 * Renders the SAME html buildPdfHtml() produces, so the Jooma header, A4 print
 * stylesheet, table styling and page-break rules are shared with Print rather
 * than reimplemented — one template, two destinations.
 *
 * jspdf and html2canvas are dynamically imported, as they already are in the
 * slideshow exporters, to keep ~500KB out of the ResultPanel chunk that every
 * markdown tool loads. (`docx` above is a static import and already ships in
 * it; moving that is a separate change.)
 */
export async function exportToPdf(
  markdown: string,
  filename: string,
  docTitle?: string,
): Promise<void> {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas"),
  ]);

  // A4 width at 96dpi. The stylesheet is written for A4, so matching the
  // capture width is what keeps line breaks identical to Print. The page HEIGHT
  // comes from jsPDF below rather than being hardcoded here, so the two cannot
  // disagree about where a page ends.
  const PAGE_W = 794;

  const doc = buildPdfHtml(markdown, filename, docTitle);

  // Rendered offscreen rather than in an iframe: html2canvas needs the nodes in
  // this document to read their computed styles. Positioned far off-canvas
  // instead of display:none, which would give every element zero height.
  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${PAGE_W}px;background:#fff;`;
  host.innerHTML = doc.replace(/^[\s\S]*?<body>/, "").replace(/<\/body>[\s\S]*$/, "");

  // The stylesheet lives in that document's <head>, so it is lifted out and
  // injected into the host — otherwise the capture is unstyled text.
  const styleMatch = doc.match(/<style>([\s\S]*?)<\/style>/);
  if (styleMatch) {
    const style = document.createElement("style");
    style.textContent = styleMatch[1];
    host.prepend(style);
  }

  document.body.appendChild(host);

  try {
    const canvas = await html2canvas(host, {
      scale: 2, // legible text rather than a blurry upscale
      useCORS: true,
      backgroundColor: "#ffffff",
      windowWidth: PAGE_W,
    });

    const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: "a4" });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    // Height the full capture occupies once scaled to the page width.
    const scaledH = (canvas.height * pdfW) / canvas.width;

    // Slice the tall capture across pages by offsetting the same image upward
    // on each one, which is how the slideshow exporter handles overflow too.
    let remaining = scaledH;
    let offset = 0;
    const image = canvas.toDataURL("image/png");
    while (remaining > 0) {
      if (offset > 0) pdf.addPage();
      pdf.addImage(image, "PNG", 0, -offset, pdfW, scaledH);
      remaining -= pdfH;
      offset += pdfH;
    }

    pdf.save(`${filename}.pdf`);
  } finally {
    // Always removed: leaving a 10,000px-offset node behind on a failed export
    // would accumulate one per attempt.
    document.body.removeChild(host);
  }
}

// --- Build the full PDF HTML string ---
export function buildPdfHtml(markdown: string, filename: string, docTitle?: string): string {
  const html = markdownToHtml(markdown);
  const title = docTitle ?? friendlyTitle(filename);
  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return buildPdfDocument(html, title, date);
}

function buildPdfDocument(html: string, title: string, date: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    @page { margin: 18mm 20mm; size: A4; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      font-size: 11px;
      line-height: 1.6;
      color: #111827;
      background: #fff;
    }
    .page {
      width: 100%;
      display: flex;
      flex-direction: column;
    }
    /* Header */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 14px;
      border-bottom: 2px solid #111827;
      margin-bottom: 28px;
    }
    .brand { display: flex; align-items: center; gap: 8px; }
    .brand-dot {
      width: 20px; height: 20px;
      background: #111827;
      border-radius: 5px;
    }
    .brand-name { font-size: 13px; font-weight: 700; color: #111827; letter-spacing: -0.3px; }
    .doc-type { font-size: 10px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.8px; }
    /* Content */
    .content { flex: 1; }
    h1 { font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 18px; line-height: 1.3; }
    h2 { font-size: 11px; font-weight: 700; color: #111827; margin: 24px 0 7px; padding-bottom: 4px; border-bottom: 1px solid #d1d5db; text-transform: uppercase; letter-spacing: 0.5px; }
    h3 { font-size: 11px; font-weight: 600; color: #374151; margin: 16px 0 4px; }
    p { margin: 3px 0 7px; color: #374151; page-break-inside: avoid; orphans: 3; widows: 3; }
    ul, ol { padding-left: 18px; margin: 5px 0 8px; }
    li { margin: 2px 0; color: #374151; page-break-inside: avoid; }
    hr { border: none; border-top: 1px solid #e5e7eb; margin: 18px 0; }
    h2, h3 { page-break-after: avoid; }
    ul, ol { page-break-inside: avoid; }
    strong { font-weight: 600; color: #111827; }
    em { font-style: italic; }
    a { color: inherit; text-decoration: none; }
    /* Tables */
    table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 10px; table-layout: fixed; word-wrap: break-word; overflow-wrap: break-word; page-break-inside: auto; border: 1px solid #d1d5db; }
    thead tr { background: #1f2937; color: #fff; }
    thead th { padding: 6px 8px; text-align: left; vertical-align: bottom; font-weight: 600; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.4px; word-wrap: break-word; overflow-wrap: break-word; border: 1px solid #374151; }
    tbody tr:nth-child(even) { background: #f9fafb; }
    tbody tr:nth-child(odd) { background: #fff; }
    td { padding: 5px 8px; vertical-align: top; border: 1px solid #d1d5db; color: #374151; word-wrap: break-word; overflow-wrap: break-word; }
    /* Footer */
    .footer {
      margin-top: 36px;
      padding-top: 10px;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #9ca3af;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      thead tr { background: #1f2937 !important; -webkit-print-color-adjust: exact; }
      thead th { background: #1f2937 !important; color: #fff !important; -webkit-print-color-adjust: exact; }
      h2, h3 { page-break-after: avoid; }
      li, p { page-break-inside: avoid; }
      ul, ol { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="brand">
        <div class="brand-dot"></div>
        <span class="brand-name">Jooma</span>
      </div>
      <span class="doc-type">${title}</span>
    </div>
    <div class="content">${html}</div>
    <div class="footer">
      <span>Generated by Jooma</span>
      <span>${date}</span>
    </div>
  </div>
</body>
</html>`;
}

function friendlyTitle(filename: string): string {
  if (filename.startsWith("comprehension")) return "Comprehension Activity";
  if (filename.startsWith("lesson-plan")) return "Lesson Plan";
  if (filename.startsWith("worksheet")) return "Worksheet";
  if (filename.startsWith("topic-overview")) return "Topic Overview";
  if (filename.startsWith("medium-term-plan")) return "Medium Term Plan";
  if (filename.startsWith("eyfs-plan")) return "EYFS Plan";
  if (filename.startsWith("model-text")) return "Model Text";
  if (filename.startsWith("sensory-activities")) return "Sensory Activities";
  if (filename.startsWith("ect-report")) return "ECT Report";
  if (filename.startsWith("eyfs-action-plan")) return "EYFS Action Plan";
  if (filename.startsWith("inspection-prep")) return "Inspection Preparation Guide";
  if (filename.startsWith("learning-walk-report")) return "Learning Walk Report";
  if (filename.startsWith("lesson-observation")) return "Lesson Observation Report";
  if (filename.startsWith("meeting-plan")) return "Meeting Plan";
  if (filename.startsWith("performance-management")) return "Performance Management Targets";
  if (filename.startsWith("letter-")) return "Letter";
  if (filename.startsWith("pupil-premium")) return "Pupil Premium Strategy Plan";
  if (filename.startsWith("assembly-plan")) return "Assembly Plan";
  if (filename.startsWith("newsletter")) return "Newsletter";
  if (filename.startsWith("school-improvement-plan")) return "School Improvement Plan";
  return filename.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function markdownToHtml(text: string): string {
  const sanitized = text.replace(/\u00A9/g, "(c)");
  const lines = sanitized.split("\n");
  const out: string[] = [];
  let i = 0;

  const escHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const inline = (s: string) =>
    escHtml(s)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/\\(.)/g, "$1");

  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("### ")) {
      out.push(`<h3>${inline(line.slice(4))}</h3>`);
    } else if (line.startsWith("## ")) {
      out.push(`<h2>${inline(line.slice(3))}</h2>`);
    } else if (line.startsWith("# ")) {
      out.push(`<h1>${inline(line.slice(2))}</h1>`);
    } else if (/^---+$/.test(line.trim())) {
      out.push("<hr />");
    } else if (line.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      const [headerLine, , ...bodyLines] = tableLines;
      const headers = headerLine.split("|").filter((c) => c.trim()).map((c) => c.trim());
      const rows = bodyLines.map((r) => r.split("|").filter((c) => c.trim()).map((c) => c.trim()));
      out.push("<table>");
      out.push("<thead><tr>" + headers.map((h) => `<th>${inline(h)}</th>`).join("") + "</tr></thead>");
      out.push("<tbody>");
      rows.forEach((row) => {
        out.push("<tr>" + row.map((cell) => `<td>${inline(cell)}</td>`).join("") + "</tr>");
      });
      out.push("</tbody></table>");
      continue;
    } else if (/^\d+\.\s/.test(line)) {
      out.push("<ol>");
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        out.push(`<li>${inline(lines[i].replace(/^\d+\.\s+/, ""))}</li>`);
        i++;
      }
      out.push("</ol>");
      continue;
    } else if (/^\s*[-*]\s/.test(line)) {
      out.push("<ul>");
      while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) {
        out.push(`<li>${inline(lines[i].replace(/^\s*[-*]\s+/, ""))}</li>`);
        i++;
      }
      out.push("</ul>");
      continue;
    } else if (line.trim()) {
      out.push(`<p>${inline(line)}</p>`);
    }
    i++;
  }

  return out.join("\n");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
