// Polyfill DOMMatrix for serverless environments (Vercel Functions)
if (typeof globalThis.DOMMatrix === "undefined") {
  (globalThis as any).DOMMatrix = class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    m11 = 1; m12 = 0; m13 = 0; m14 = 0;
    m21 = 0; m22 = 1; m23 = 0; m24 = 0;
    m31 = 0; m32 = 0; m33 = 1; m34 = 0;
    m41 = 0; m42 = 0; m43 = 0; m44 = 1;
    is2D = true; isIdentity = true;
    constructor(init?: any) {
      if (Array.isArray(init) && init.length === 6) {
        [this.a, this.b, this.c, this.d, this.e, this.f] = init;
        this.m11 = this.a; this.m12 = this.b;
        this.m21 = this.c; this.m22 = this.d;
        this.m41 = this.e; this.m42 = this.f;
      }
    }
    transformPoint() { return { x: 0, y: 0, z: 0, w: 1 }; }
    inverse() { return new DOMMatrix(); }
    multiply() { return new DOMMatrix(); }
    scale() { return new DOMMatrix(); }
    translate() { return new DOMMatrix(); }
  };
}

import { PDFParse } from "pdf-parse";

export interface PdfExtraction {
  /** Full text of the entire document */
  text: string;
  /** Text content per page (1-indexed in results, stored 0-indexed here) */
  pages: string[];
  /** Total page count */
  totalPages: number;
}

/**
 * Extract text from a PDF buffer, returning full text and per-page text.
 * Uses pdf-parse v2 with pdfjs-dist under the hood.
 */
export async function extractPdfText(
  buffer: Buffer | Uint8Array | ArrayBuffer
): Promise<PdfExtraction> {
  let data: Uint8Array;
  if (buffer instanceof ArrayBuffer) {
    data = new Uint8Array(buffer);
  } else if (buffer instanceof Uint8Array) {
    data = buffer;
  } else {
    data = new Uint8Array(buffer);
  }

  const pdf = new PDFParse({ data, verbosity: 0 });
  const result = await pdf.getText({ pageJoiner: "" });

  await pdf.destroy();

  return {
    text: result.text,
    pages: result.pages.map((p) => p.text),
    totalPages: result.total,
  };
}
