// Final signed PDF assembly using pdf-lib.
//
// Four source-shape branches:
//   1. Source PDF      → load + copy pages, append signature page(s).
//   2. Source image    → embed as a full-page bitmap, append signature page(s).
//                        (JPEG / PNG only; WebP not supported by pdf-lib.)
//   3. Source .pages   → can't render; generate a text-body page (if any) +
//                        a paragraph referencing the original file URL, then
//                        append signature page(s).
//   4. No file, text   → generate text body + signature page(s).

import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

type SignerInput = {
  name: string;
  email: string;
  role: string | null;
  signature: string;
  signedAt: Date;
  signedIp: string | null;
};

type Input = {
  title: string;
  bodyText: string | null;
  sourceFileUrl: string | null;
  sourceFileName: string | null;
  sourceFileMimeType: string | null;
  version: string;
  signers: SignerInput[];
};

const PAGE_WIDTH = 612; // US Letter
const PAGE_HEIGHT = 792;
const MARGIN = 54; // 0.75"

export async function generateSignedPdf(input: Input): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const mime = input.sourceFileMimeType?.toLowerCase() ?? "";
  const fileName = input.sourceFileName ?? "";
  const isPages =
    fileName.toLowerCase().endsWith(".pages") ||
    mime === "application/vnd.apple.pages";
  const isPdf = mime === "application/pdf";
  const isEmbeddableImage = mime === "image/jpeg" || mime === "image/png";

  // 1. Optional cover text body
  if (input.bodyText && input.bodyText.trim().length > 0) {
    drawTitle(doc, helvBold, input.title);
    drawBody(doc, helv, input.bodyText);
  } else {
    drawTitle(doc, helvBold, input.title);
  }

  // 2. Source file
  if (input.sourceFileUrl && (isPdf || isEmbeddableImage || isPages)) {
    if (isPdf) {
      await appendPdfFromUrl(doc, input.sourceFileUrl);
    } else if (isEmbeddableImage) {
      await appendImageFromUrl(doc, input.sourceFileUrl, mime);
    } else if (isPages) {
      drawPagesReferencePage(doc, helv, helvBold, input);
    }
  } else if (input.sourceFileUrl) {
    // Unknown MIME — fall back to a reference page
    drawPagesReferencePage(doc, helv, helvBold, input);
  }

  // 3. Signature page
  drawSignaturePage(doc, helv, helvBold, input);

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

function drawTitle(doc: PDFDocument, font: PDFFont, title: string): void {
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  page.drawText(title, {
    x: MARGIN,
    y: PAGE_HEIGHT - MARGIN - 12,
    size: 20,
    font,
    color: rgb(0, 0, 0),
  });
}

function drawBody(doc: PDFDocument, font: PDFFont, body: string): void {
  const fontSize = 11;
  const lineHeight = 15;
  const maxWidth = PAGE_WIDTH - MARGIN * 2;

  const pages = doc.getPages();
  let page = pages[pages.length - 1];
  let y = PAGE_HEIGHT - MARGIN - 50;
  const paragraphs = body.split(/\n\s*\n/);

  for (const para of paragraphs) {
    const lines = wrapLines(para.replace(/\n/g, " ").trim(), font, fontSize, maxWidth);
    for (const line of lines) {
      if (y < MARGIN + lineHeight) {
        page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        y = PAGE_HEIGHT - MARGIN;
      }
      page.drawText(line, {
        x: MARGIN,
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
      y -= lineHeight;
    }
    y -= lineHeight / 2;
  }
}

function wrapLines(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    const w = font.widthOfTextAtSize(candidate, size);
    if (w > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function appendPdfFromUrl(
  doc: PDFDocument,
  url: string,
): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Source PDF fetch failed: HTTP ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  const source = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const copied = await doc.copyPages(source, source.getPageIndices());
  for (const page of copied) {
    doc.addPage(page);
  }
}

async function appendImageFromUrl(
  doc: PDFDocument,
  url: string,
  mime: string,
): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Source image fetch failed: HTTP ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  const img =
    mime === "image/jpeg"
      ? await doc.embedJpg(buffer)
      : await doc.embedPng(buffer);
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const maxW = PAGE_WIDTH - MARGIN * 2;
  const maxH = PAGE_HEIGHT - MARGIN * 2;
  const scale = Math.min(maxW / img.width, maxH / img.height, 1);
  const w = img.width * scale;
  const h = img.height * scale;
  page.drawImage(img, {
    x: (PAGE_WIDTH - w) / 2,
    y: (PAGE_HEIGHT - h) / 2,
    width: w,
    height: h,
  });
}

function drawPagesReferencePage(
  doc: PDFDocument,
  font: PDFFont,
  bold: PDFFont,
  input: Input,
): void {
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN - 12;
  page.drawText("Referenced source document", {
    x: MARGIN,
    y,
    size: 16,
    font: bold,
  });
  y -= 30;
  const lines = [
    `Filename: ${input.sourceFileName ?? "(unnamed)"}`,
    `MIME type: ${input.sourceFileMimeType ?? "(unknown)"}`,
    `URL: ${input.sourceFileUrl ?? "(missing)"}`,
    "",
    "This source file format cannot be embedded in PDF directly. The",
    "signers have agreed to its contents; the original file is retained",
    "by the firm at the URL above.",
  ];
  for (const line of lines) {
    const wrapped = wrapLines(line, font, 11, PAGE_WIDTH - MARGIN * 2);
    for (const w of wrapped.length ? wrapped : [""]) {
      page.drawText(w, { x: MARGIN, y, size: 11, font });
      y -= 15;
    }
  }
}

function drawSignaturePage(
  doc: PDFDocument,
  font: PDFFont,
  bold: PDFFont,
  input: Input,
): void {
  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN - 12;
  page.drawText("Signatures", { x: MARGIN, y, size: 18, font: bold });
  y -= 30;
  page.drawText(
    `Document: ${input.title}  |  Version: ${input.version}`,
    { x: MARGIN, y, size: 10, font, color: rgb(0.3, 0.3, 0.3) },
  );
  y -= 30;

  for (const signer of input.signers) {
    if (y < MARGIN + 110) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN - 12;
    }
    const cursive = signer.signature || signer.name;
    page.drawText(cursive, {
      x: MARGIN,
      y,
      size: 24,
      font,
      color: rgb(0, 0, 0),
    });
    y -= 6;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.5,
      color: rgb(0, 0, 0),
    });
    y -= 16;
    const details = [
      `Name:  ${signer.name}`,
      `Email: ${signer.email}${signer.role ? `  (${signer.role})` : ""}`,
      `Signed: ${signer.signedAt.toISOString()}${signer.signedIp ? `  from ${signer.signedIp}` : ""}`,
    ];
    for (const line of details) {
      page.drawText(line, { x: MARGIN, y, size: 10, font });
      y -= 13;
    }
    y -= 18;
  }
}
