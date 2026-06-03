import OSS from "ali-oss";
import path from "path";
import { mkdir, writeFile } from "node:fs/promises";
import { UPLOADS_DIR } from "../config/paths";

const client = new OSS({
  accessKeyId: process.env.OSS_ACCESS_KEY_ID || "",
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || "",
  bucket: process.env.OSS_BUCKET || "",
  region: process.env.OSS_REGION || "",
  endpoint: process.env.OSS_ENDPOINT || undefined,
});

const UPLOAD_PREFIX = process.env.OSS_UPLOAD_PREFIX || "uploads";
const GENERATED_PREFIX = process.env.OSS_GENERATED_PREFIX || "generated";

/**
 * Get the public URL for an OSS object key.
 */
function getPublicUrl(key: string): string {
  const bucket = process.env.OSS_BUCKET || "";
  const region = process.env.OSS_REGION || "";
  return `https://${bucket}.${region}.aliyuncs.com/${key}`;
}

/**
 * Upload a buffer to OSS under the "uploads" prefix (user-uploaded files).
 * Also saves a local copy.
 * Returns the OSS public URL.
 */
export async function uploadToOSS(
  buffer: Buffer,
  fileName: string,
  contentType?: string
): Promise<string> {
  const key = `${UPLOAD_PREFIX}/${fileName}`;

  await client.put(key, buffer, {
    headers: contentType ? { "Content-Type": contentType } : undefined,
  });

  // Also save locally
  const localDir = path.join(UPLOADS_DIR, path.dirname(fileName));
  await mkdir(localDir, { recursive: true });
  const localPath = path.join(UPLOADS_DIR, fileName);
  await writeFile(localPath, buffer);

  return getPublicUrl(key);
}

/**
 * Upload a buffer to OSS under the "generated" prefix (model outputs).
 * Also saves a local copy.
 * Returns the OSS public URL.
 */
export async function uploadGeneratedToOSS(
  buffer: Buffer,
  fileName: string,
  contentType?: string
): Promise<string> {
  const key = `${GENERATED_PREFIX}/${fileName}`;

  await client.put(key, buffer, {
    headers: contentType ? { "Content-Type": contentType } : undefined,
  });

  // Also save locally
  const localDir = path.join(UPLOADS_DIR, path.dirname(fileName));
  await mkdir(localDir, { recursive: true });
  const localPath = path.join(UPLOADS_DIR, fileName);
  await writeFile(localPath, buffer);

  return getPublicUrl(key);
}

/**
 * Check if a URL is an OSS URL (so we can use it directly instead of converting to base64).
 */
export function isOSSUrl(url: string): boolean {
  const bucket = process.env.OSS_BUCKET || "";
  return url.includes(`${bucket}.aliyuncs.com`);
}
