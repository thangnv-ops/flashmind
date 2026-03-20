import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

const endpoint = import.meta.env.VITE_MINIO_ENDPOINT as string;
const accessKeyId = import.meta.env.VITE_MINIO_ACCESS_KEY as string;
const secretAccessKey = import.meta.env.VITE_MINIO_SECRET_KEY as string;
const bucket = (import.meta.env.VITE_MINIO_BUCKET as string) || 'flashcard-images';
const region = (import.meta.env.VITE_MINIO_REGION as string) || 'us-east-1';

export const isMinioConfigured = !!(endpoint && accessKeyId && secretAccessKey);

const s3 = isMinioConfigured
  ? new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true, // required for MinIO
    })
  : null;

/**
 * Upload a file to MinIO and return its public URL.
 * Throws on failure.
 */
export async function uploadToMinio(
  key: string,
  file: File,
): Promise<string> {
  if (!s3) throw new Error('MinIO is not configured.');

  const arrayBuffer = await file.arrayBuffer();

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: new Uint8Array(arrayBuffer),
      ContentType: file.type,
      ACL: 'public-read',
    }),
  );

  // Build the public URL: <endpoint>/<bucket>/<key>
  const base = endpoint.replace(/\/$/, '');
  return `${base}/${bucket}/${key}`;
}

/**
 * Delete a file from MinIO by its storage key.
 * Best-effort — does not throw.
 */
export async function deleteFromMinio(key: string): Promise<void> {
  if (!s3) return;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } catch {
    // best-effort
  }
}
