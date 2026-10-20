/**
 * Utility functions for converting between data URLs and Blobs.
 */

/**
 * Converts a data URL to a Blob.
 * @param dataUrl The data URL string (e.g., "data:image/png;base64,...").
 * @returns The Blob object.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64Data] = dataUrl.split(",");
  const mimeMatch = header.match(/data:([^;]+)/);
  if (!mimeMatch) {
    throw new Error("Invalid data URL: missing MIME type");
  }
  const mimeType = mimeMatch[1];
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}
