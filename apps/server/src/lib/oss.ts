import OSS from "ali-oss";
import path from "path";
import { mkdir, writeFile } from "node:fs/promises";
import { UPLOADS_DIR } from "../config/paths";

let _client: OSS | null = null;

function getOSSClient(): OSS {
  if (!_client) {
    const accessKeyId = process.env.OSS_ACCESS_KEY_ID;
    const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET;
    const bucket = process.env.OSS_BUCKET;
    const region = process.env.OSS_REGION;
    if (!accessKeyId || !accessKeySecret || !bucket || !region) {
      throw new Error("OSS credentials not configured (OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_BUCKET, OSS_REGION required)");
    }
    _client = new OSS({
      accessKeyId,
      accessKeySecret,
      bucket,
      region,
      endpoint: process.env.OSS_ENDPOINT || undefined,
    });
  }
  return _client;
}

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
  // Validate buffer
  if (buffer.length === 0) {
    throw new Error("Cannot upload empty file");
  }
  const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${buffer.length} bytes (max ${MAX_FILE_SIZE})`);
  }

  const key = `${UPLOAD_PREFIX}/${fileName}`;

  await getOSSClient().put(key, buffer, {
    headers: contentType ? { "Content-Type": contentType } : undefined,
  });

  // Also save locally
  try {
    const localDir = path.join(UPLOADS_DIR, path.dirname(fileName));
    await mkdir(localDir, { recursive: true });
    const localPath = path.join(UPLOADS_DIR, fileName);
    await writeFile(localPath, buffer);
  } catch (localErr) {
    // Log but don't fail - OSS upload succeeded
    console.warn("[uploadToOSS] Failed to save local copy:", localErr);
  }

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
  // Validate buffer
  if (buffer.length === 0) {
    throw new Error("Cannot upload empty file");
  }
  const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${buffer.length} bytes (max ${MAX_FILE_SIZE})`);
  }

  const key = `${GENERATED_PREFIX}/${fileName}`;

  await getOSSClient().put(key, buffer, {
    headers: contentType ? { "Content-Type": contentType } : undefined,
  });

  // Also save locally
  try {
    const localDir = path.join(UPLOADS_DIR, path.dirname(fileName));
    await mkdir(localDir, { recursive: true });
    const localPath = path.join(UPLOADS_DIR, fileName);
    await writeFile(localPath, buffer);
  } catch (localErr) {
    // Log but don't fail - OSS upload succeeded
    console.warn("[uploadGeneratedToOSS] Failed to save local copy:", localErr);
  }

  return getPublicUrl(key);
}

/**
 * Upload a buffer to OSS under the "generated" prefix WITHOUT saving a local copy.
 * Use this when the file already exists locally and you only need the OSS URL.
 * Returns the OSS public URL.
 */
export async function uploadToOSSOnly(
  buffer: Buffer,
  fileName: string,
  contentType?: string
): Promise<string> {
  // Validate buffer
  if (buffer.length === 0) {
    throw new Error("Cannot upload empty file");
  }
  const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${buffer.length} bytes (max ${MAX_FILE_SIZE})`);
  }

  const key = `${GENERATED_PREFIX}/${fileName}`;

  await getOSSClient().put(key, buffer, {
    headers: contentType ? { "Content-Type": contentType } : undefined,
  });

  return getPublicUrl(key);
}

/**
 * Check if a URL is an OSS URL (so we can use it directly instead of converting to base64).
 */
export function isOSSUrl(url: string): boolean {
  const bucket = process.env.OSS_BUCKET || "";
  return url.includes(`${bucket}.aliyuncs.com`);
}
