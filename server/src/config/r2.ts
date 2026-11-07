import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { ENV } from './env';

let r2Client: S3Client | null = null;

if (ENV.hasR2) {
  r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${ENV.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: ENV.R2_ACCESS_KEY_ID,
      secretAccessKey: ENV.R2_SECRET_ACCESS_KEY,
    },
  });
}

export { r2Client };

/**
 * Uploads a buffer directly to Cloudflare R2 bucket
 */
export async function uploadToR2(
  buffer: Buffer,
  key: string,
  contentType: string,
  metadata?: Record<string, string>
): Promise<{ key: string; url: string }> {
  if (!r2Client) {
    throw new Error('Cloudflare R2 is not configured.');
  }

  const command = new PutObjectCommand({
    Bucket: ENV.R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    Metadata: metadata,
  });

  await r2Client.send(command);

  // Return public or CDN URL if configured, otherwise S3 endpoint path
  const baseUrl = ENV.R2_PUBLIC_URL 
    ? (ENV.R2_PUBLIC_URL.endsWith('/') ? ENV.R2_PUBLIC_URL.slice(0, -1) : ENV.R2_PUBLIC_URL)
    : `https://${ENV.R2_BUCKET_NAME}.${ENV.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

  const url = `${baseUrl}/${key}`;
  return { key, url };
}

