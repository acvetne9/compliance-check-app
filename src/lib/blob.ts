import { put, del, list } from "@vercel/blob";

/**
 * Upload a PDF file to Vercel Blob storage.
 * Returns the blob URL for later retrieval.
 */
export async function uploadPdf(
  fileName: string,
  data: Buffer | Uint8Array | ArrayBuffer,
  folder: "policies" | "compliance"
): Promise<string> {
  const buf = Buffer.from(
    data instanceof ArrayBuffer ? data : (data as Uint8Array).buffer
  );
  const blob = await put(`${folder}/${fileName}`, buf, {
    access: "public",
    contentType: "application/pdf",
  });
  return blob.url;
}

/**
 * Delete a PDF from Vercel Blob storage.
 */
export async function deletePdf(blobUrl: string): Promise<void> {
  await del(blobUrl);
}

/**
 * List all blobs in a folder.
 */
export async function listPdfs(folder: "policies" | "compliance") {
  const { blobs } = await list({ prefix: `${folder}/` });
  return blobs;
}
