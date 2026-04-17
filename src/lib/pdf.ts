import "./polyfills";
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
