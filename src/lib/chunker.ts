export interface TextChunk {
  /** Index of this chunk within the document */
  index: number;
  /** The text content of this chunk */
  content: string;
  /** First page this chunk covers (0-indexed) */
  pageStart: number;
  /** Last page this chunk covers (0-indexed) */
  pageEnd: number;
  /** Section header extracted from the text, if any */
  sectionHeader: string | null;
  /** Approximate token count */
  tokenCount: number;
}

interface ChunkOptions {
  /** Target max tokens per chunk (default 600) */
  maxTokens?: number;
  /** Overlap tokens between adjacent chunks (default 50) */
  overlapTokens?: number;
  /** Minimum tokens for a standalone chunk (default 100) */
  minTokens?: number;
}

// Rough token estimate: ~4 chars per token for English text
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Page header/footer patterns to skip when detecting section headers
const PAGE_HEADER_RE = /^(?:page\s+\d+\s+of\s+\d+|\d+\s*$)/i;

// Section header patterns found in healthcare policy/compliance docs
const SECTION_HEADER_RE =
  /^(?:I{1,3}V?\.?\s|V{1,3}\.?\s|VI{1,3}\.?\s|IX\.?\s|X{1,3}\.?\s|\d+\.\s|[A-Z]\.?\s+(?:PURPOSE|POLICY|PROCEDURE|SCOPE|DEFINITIONS|RESPONSIBILITIES|REFERENCES|BACKGROUND|OVERVIEW|INTRODUCTION)|APPENDIX|ATTACHMENT|EXHIBIT|SECTION\s+\d)/i;

/**
 * Find the first meaningful section header in a block of text,
 * skipping page numbers and headers like "Page X of Y".
 */
function detectSectionHeader(text: string): string | null {
  const lines = text.split("\n");
  for (const line of lines.slice(0, 5)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length > 120) continue;
    if (PAGE_HEADER_RE.test(trimmed)) continue;
    if (SECTION_HEADER_RE.test(trimmed)) return trimmed;
  }
  return null;
}

/**
 * Split per-page text arrays into overlapping, section-aware chunks.
 *
 * Strategy:
 * 1. Concatenate pages into paragraph-delimited text
 * 2. Split on paragraph boundaries to fit within maxTokens
 * 3. Merge chunks below minTokens with the next chunk
 * 4. Add overlap from previous chunk for context continuity
 * 5. Track page boundaries through the process
 */
export function chunkPages(
  pages: string[],
  options: ChunkOptions = {}
): TextChunk[] {
  const { maxTokens = 600, overlapTokens = 50, minTokens = 100 } = options;

  // Build page-tracked paragraphs
  interface TrackedParagraph {
    text: string;
    pageIndex: number;
  }

  const paragraphs: TrackedParagraph[] = [];
  for (let i = 0; i < pages.length; i++) {
    const pageText = pages[i]?.trim() ?? "";
    if (!pageText) continue;
    // Split page into paragraphs (double newline separated)
    const pageParagraphs = pageText.split(/\n\s*\n/).filter((p) => p.trim());
    for (const para of pageParagraphs) {
      paragraphs.push({ text: para.trim(), pageIndex: i });
    }
  }

  if (paragraphs.length === 0) return [];

  // Build raw chunks by accumulating paragraphs up to maxTokens
  const rawChunks: Array<{
    content: string;
    pageStart: number;
    pageEnd: number;
  }> = [];

  let buffer = "";
  let bufferPageStart = paragraphs[0].pageIndex;
  let bufferPageEnd = paragraphs[0].pageIndex;

  for (const para of paragraphs) {
    const combined = buffer ? buffer + "\n\n" + para.text : para.text;
    const combinedTokens = estimateTokens(combined);

    if (combinedTokens > maxTokens && buffer.trim()) {
      // Flush current buffer
      rawChunks.push({
        content: buffer.trim(),
        pageStart: bufferPageStart,
        pageEnd: bufferPageEnd,
      });
      buffer = para.text;
      bufferPageStart = para.pageIndex;
      bufferPageEnd = para.pageIndex;
    } else {
      buffer = combined;
      bufferPageEnd = para.pageIndex;
    }
  }
  // Flush remaining
  if (buffer.trim()) {
    rawChunks.push({
      content: buffer.trim(),
      pageStart: bufferPageStart,
      pageEnd: bufferPageEnd,
    });
  }

  // Merge small chunks with the next one
  const mergedChunks: typeof rawChunks = [];
  for (let i = 0; i < rawChunks.length; i++) {
    const chunk = rawChunks[i];
    if (
      estimateTokens(chunk.content) < minTokens &&
      i + 1 < rawChunks.length
    ) {
      // Merge with next chunk
      const next = rawChunks[i + 1];
      rawChunks[i + 1] = {
        content: chunk.content + "\n\n" + next.content,
        pageStart: chunk.pageStart,
        pageEnd: next.pageEnd,
      };
    } else {
      mergedChunks.push(chunk);
    }
  }

  // Add overlap and build final chunks
  const chunks: TextChunk[] = [];
  for (let i = 0; i < mergedChunks.length; i++) {
    const raw = mergedChunks[i];
    let content = raw.content;

    // Add overlap from previous chunk (except first)
    if (i > 0 && overlapTokens > 0) {
      const prevText = mergedChunks[i - 1].content;
      const overlap = extractOverlap(prevText, overlapTokens);
      if (overlap) {
        content = overlap + "\n\n" + content;
      }
    }

    chunks.push({
      index: i,
      content,
      pageStart: raw.pageStart,
      pageEnd: raw.pageEnd,
      sectionHeader: detectSectionHeader(raw.content),
      tokenCount: estimateTokens(content),
    });
  }

  return chunks;
}

/**
 * Extract the last N tokens worth of text for overlap.
 */
function extractOverlap(text: string, overlapTokens: number): string {
  const targetChars = overlapTokens * 4;
  if (text.length <= targetChars) return text;

  const tail = text.slice(-targetChars);
  // Try to start at a sentence boundary
  const sentenceStart = tail.search(/[.!?]\s+[A-Z]/);
  if (sentenceStart !== -1) {
    return tail.slice(sentenceStart + 2);
  }
  // Fall back to word boundary
  const wordStart = tail.indexOf(" ");
  return wordStart !== -1 ? tail.slice(wordStart + 1) : tail;
}
