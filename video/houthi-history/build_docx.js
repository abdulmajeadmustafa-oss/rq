// Builds an RTL Word document from video/houthi-history/script.md
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType,
  ShadingType, BorderStyle, AlignmentType, HeadingLevel, LevelFormat, Footer,
  Header, PageNumber, VerticalAlign, PageBreak, TableLayoutType,
} = require("docx");

const [, , SRC, OUT] = process.argv;
const md = fs.readFileSync(SRC, "utf8").split("\n");

const FONT = "Arial";
const C = {
  ink: "1E1B16", red: "C0392B", olive: "6B7F3A", blue: "1F5F8B",
  sand: "F4EEE4", sandDark: "E6DCCB", grey: "6B6358", line: "D5CAB8", voBg: "FBF7F0",
};
const PAGE_W = 11906, MARGIN = 1300, CONTENT_W = PAGE_W - 2 * MARGIN;
const LABEL_W = 2100, BODY_W = CONTENT_W - LABEL_W;

const hasArabic = (s) => /[؀-ۿ]/.test(s);

// Split text into runs of Arabic-direction text and embedded Latin chunks.
function scriptRuns(text, base) {
  const out = [];
  const re = /[A-Za-z][A-Za-z0-9 .,:'’&\-–×/]*[A-Za-z0-9.]|[A-Za-z]/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(run(text.slice(last, m.index), base, true));
    out.push(run(m[0], base, false));
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(run(text.slice(last), base, true));
  return out;
}

function run(text, o = {}, rtl = true) {
  const size = o.size || 24;
  return new TextRun({
    text,
    font: { ascii: FONT, hAnsi: FONT, cs: FONT, eastAsia: FONT },
    size, sizeComplexScript: size,
    bold: !!o.bold, boldComplexScript: !!o.bold,
    italics: !!o.italics, italicsComplexScript: !!o.italics,
    color: o.color || C.ink,
    rightToLeft: rtl && hasArabic(text) || (rtl && !/[A-Za-z]/.test(text)),
  });
}

// Inline markdown: **bold**, *italic*, `code`
function inline(text, base = {}) {
  const runs = [];
  const re = /\*\*(.+?)\*\*|`(.+?)`|\*(.+?)\*/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) runs.push(...scriptRuns(text.slice(last, m.index), base));
    if (m[1] !== undefined) runs.push(...scriptRuns(m[1], { ...base, bold: true }));
    else if (m[2] !== undefined) runs.push(run("\u200E" + m[2] + "\u200E", { ...base, color: C.blue }, false));
    else runs.push(...scriptRuns(m[3], { ...base, italics: true }));
    last = m.index + m[0].length;
  }
  if (last < text.length) runs.push(...scriptRuns(text.slice(last), base));
  return runs;
}

const P = (children, opts = {}) => new Paragraph({ bidirectional: true, children, ...opts });

const border = { style: BorderStyle.SINGLE, size: 4, color: C.line };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 100, bottom: 100, left: 140, right: 140 };

function cell(children, width, fill) {
  return new TableCell({
    children, borders, margins: cellMargins, verticalAlign: VerticalAlign.TOP,
    width: { size: width, type: WidthType.DXA },
    shading: fill ? { fill, type: ShadingType.CLEAR, color: "auto" } : undefined,
  });
}

function rtlTable(rows, widths) {
  return new Table({
    visuallyRightToLeft: true,
    layout: TableLayoutType.FIXED,
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    rows,
  });
}

function labelCell(text, color) {
  return cell([P([run(text, { bold: true, color, size: 22 })], { spacing: { after: 0 } })], LABEL_W, C.sand);
}

// --- Parse markdown into blocks -------------------------------------------
const children = [];
let i = 0;
let scene = null; // { title, rows: [] }
let numbered = 0;

function flushScene() {
  if (!scene) return;
  const rows = scene.rows.map((r) => {
    const fill = r.kind === "vo" ? C.voBg : undefined;
    const color = r.kind === "vo" ? C.red : r.kind === "screen" ? C.olive : C.blue;
    return new TableRow({ cantSplit: true, children: [labelCell(r.label, color), cell(r.body, BODY_W, fill)] });
  });
  children.push(rtlTable(rows, [LABEL_W, BODY_W]));
  children.push(P([], { spacing: { after: 120 } }));
  scene = null;
}

const LABELS = {
  "المشهد البصري": "visual",
  "النص على الشاشة": "screen",
  "التعليق الصوتي": "vo",
};

while (i < md.length) {
  const line = md[i];

  // Title
  if (line.startsWith("# ")) {
    const [main, sub] = line.slice(2).split("«");
    children.push(P([run(main.replace(/:\s*$/, ""), { size: 30, color: C.grey })], { alignment: AlignmentType.CENTER, spacing: { before: 600, after: 120 } }));
    children.push(P([run("«" + sub, { size: 44, bold: true, color: C.red })], { alignment: AlignmentType.CENTER, spacing: { after: 200 } }));
    i++; continue;
  }

  // Draft note
  if (line.startsWith("> ")) {
    const t = line.replace(/^>\s*/, "").replace(/\*\*/g, "");
    children.push(P([run(t, { size: 22, bold: true, color: C.olive })], {
      alignment: AlignmentType.CENTER, spacing: { after: 360 },
    }));
    i++; continue;
  }

  // Markdown table (info table at top)
  if (line.startsWith("|")) {
    const rows = [];
    while (i < md.length && md[i].startsWith("|")) {
      const cells = md[i].split("|").slice(1, -1).map((s) => s.trim());
      if (!/^-+$/.test(cells[0])) rows.push(cells);
      i++;
    }
    const w1 = 2300, w2 = CONTENT_W - w1;
    children.push(rtlTable(rows.map((r, k) => new TableRow({
      tableHeader: k === 0,
      children: [
        cell([P(inline(r[0], { bold: true, size: 22, color: k === 0 ? "FFFFFF" : C.ink }), { spacing: { after: 0 } })], w1, k === 0 ? C.ink : C.sand),
        cell([P(inline(r[1], { size: 22, bold: k === 0, color: k === 0 ? "FFFFFF" : C.ink }), { spacing: { after: 0 } })], w2, k === 0 ? C.ink : undefined),
      ],
    })), [w1, w2]));
    children.push(P([new PageBreak()]));
    continue;
  }

  // Chapter heading
  if (line.startsWith("## ")) {
    flushScene();
    const t = line.slice(3);
    const m = t.match(/^(.*?)\s*\((.+)\)\s*$/);
    const runs = [run(m ? m[1] : t, { size: 34, bold: true, color: C.red })];
    if (m) runs.push(run("   " + m[2], { size: 24, color: C.grey }, false));
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1, bidirectional: true, children: runs,
      spacing: { before: 360, after: 200 }, keepNext: true,
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: C.red, space: 6 } },
    }));
    numbered = 0;
    i++; continue;
  }

  // Scene heading
  const sm = line.match(/^\*\*(المشهد .+)\*\*$/);
  if (sm) {
    flushScene();
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_2, bidirectional: true, keepNext: true,
      children: [run(sm[1], { size: 28, bold: true, color: C.ink })],
      spacing: { before: 200, after: 120 },
    }));
    scene = { rows: [] };
    i++; continue;
  }

  // Scene field
  const fm = line.match(/^- \*\*(.+?):\*\*\s*(.*)$/);
  if (fm && scene) {
    const kind = LABELS[fm[1]] || "visual";
    const body = [];
    if (fm[2]) body.push(P(inline(fm[2], { size: 23 }), { spacing: { after: 0, line: 300 } }));
    i++;
    while (i < md.length && /^\s+>/.test(md[i])) {
      const t = md[i].replace(/^\s+>\s*/, "");
      body.push(P(inline(t, { size: 26, bold: true }), {
        alignment: AlignmentType.BOTH, spacing: { after: 100, line: 360 },
      }));
      i++;
    }
    scene.rows.push({ label: fm[1], kind, body });
    continue;
  }

  // Numbered list
  const nm = line.match(/^(\d+)\.\s+(.*)$/);
  if (nm) {
    children.push(new Paragraph({
      bidirectional: true, numbering: { reference: "nums", level: 0 },
      children: inline(nm[2], { size: 23 }), spacing: { after: 100, line: 300 },
    }));
    i++; continue;
  }

  // Bullet list
  const bm = line.match(/^- (.*)$/);
  if (bm) {
    children.push(new Paragraph({
      bidirectional: true, numbering: { reference: "bullets", level: 0 },
      children: inline(bm[1], { size: 23 }), spacing: { after: 80, line: 300 },
    }));
    i++; continue;
  }

  i++; // blank lines and --- separators
}
flushScene();

const doc = new Document({
  creator: "Claude Code",
  title: "من صعدة إلى البحر الأحمر — سكريبت",
  styles: {
    default: {
      document: {
        run: { font: FONT, size: 24, sizeComplexScript: 24, rightToLeft: true },
        paragraph: { bidirectional: true, spacing: { after: 120 } },
      },
    },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 34, bold: true, color: C.red }, paragraph: { outlineLevel: 0, bidirectional: true } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 28, bold: true, color: C.ink }, paragraph: { outlineLevel: 1, bidirectional: true } },
    ],
  },
  numbering: {
    config: [
      { reference: "nums", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.START,
        style: { paragraph: { indent: { right: 540, hanging: 360 } } } }] },
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.START,
        style: { paragraph: { indent: { right: 540, hanging: 360 } } } }] },
    ],
  },
  sections: [{
    properties: {
      page: { size: { width: PAGE_W, height: 16838 }, margin: { top: 1300, bottom: 1300, left: MARGIN, right: MARGIN } },
    },
    headers: {
      default: new Header({ children: [P([run("سكريبت فيديو موشن غرافيك — تاريخ جماعة الحوثي", { size: 18, color: C.grey })], { alignment: AlignmentType.CENTER })] }),
    },
    footers: {
      default: new Footer({ children: [P([
        run("صفحة ", { size: 18, color: C.grey }),
        new TextRun({ children: [PageNumber.CURRENT], size: 18, color: C.grey, font: FONT }),
        run(" من ", { size: 18, color: C.grey }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: C.grey, font: FONT }),
      ], { alignment: AlignmentType.CENTER })] }),
    },
    children,
  }],
});

Packer.toBuffer(doc).then((b) => { fs.writeFileSync(OUT, b); console.log("wrote", OUT); });
