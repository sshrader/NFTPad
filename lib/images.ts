const MAX_BYTES = Number(process.env.MAX_IMAGE_BYTES ?? 2 * 1024 * 1024);

export type ValidImage = { contentType: string; data: Buffer };

/** Detect image type from magic bytes (never trust the client-sent MIME type). */
function sniff(buf: Buffer): string | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "image/png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 6 && (buf.subarray(0, 6).toString("ascii") === "GIF87a" || buf.subarray(0, 6).toString("ascii") === "GIF89a"))
    return "image/gif";
  if (buf.length >= 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP")
    return "image/webp";
  return null;
}

export async function readImage(file: File | null, label: string): Promise<ValidImage> {
  if (!file || typeof file === "string" || file.size === 0) throw new Error(`${label} is required`);
  if (file.size > MAX_BYTES) throw new Error(`${label} is too large (max ${Math.floor(MAX_BYTES / 1024)} KB)`);
  const data = Buffer.from(await file.arrayBuffer());
  const contentType = sniff(data);
  if (!contentType) throw new Error(`${label} must be a PNG, JPEG, GIF or WebP image`);
  return { contentType, data };
}
