/**
 * MinIO connection & upload test script.
 *
 * Usage:
 *   npx tsx scripts/test-minio.ts
 *
 * Requirements in .env.local:
 *   VITE_MINIO_ENDPOINT   e.g. http://localhost:9000
 *   VITE_MINIO_ACCESS_KEY
 *   VITE_MINIO_SECRET_KEY
 *   VITE_MINIO_BUCKET     (default: flashcard-images)
 *   VITE_MINIO_REGION     (default: us-east-1)
 */
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const endpoint    = process.env.VITE_MINIO_ENDPOINT;
const accessKeyId = process.env.VITE_MINIO_ACCESS_KEY;
const secretKey   = process.env.VITE_MINIO_SECRET_KEY;
const bucket      = process.env.VITE_MINIO_BUCKET || 'flashcard-images';
const region      = process.env.VITE_MINIO_REGION || 'us-east-1';

// ── Validation ────────────────────────────────────────────────────────────────
if (!endpoint || !accessKeyId || !secretKey) {
  console.error('\n❌  Missing MinIO environment variables in .env.local');
  console.error('    Required: VITE_MINIO_ENDPOINT, VITE_MINIO_ACCESS_KEY, VITE_MINIO_SECRET_KEY\n');
  process.exit(1);
}

console.log('\n🔧  MinIO config:');
console.log(`    Endpoint : ${endpoint}`);
console.log(`    Bucket   : ${bucket}`);
console.log(`    Region   : ${region}`);
console.log(`    AccessKey: ${accessKeyId}\n`);

// ── S3 client ─────────────────────────────────────────────────────────────────
const s3 = new S3Client({
  endpoint,
  region,
  credentials: { accessKeyId, secretAccessKey: secretKey },
  forcePathStyle: true,
});

async function run() {
  // 1. Check bucket exists / is reachable
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log(`✅  Bucket "${bucket}" is accessible.`);
  } catch (err: any) {
    if (err?.$metadata?.httpStatusCode === 404) {
      console.error(`❌  Bucket "${bucket}" does not exist. Create it in the MinIO console first.`);
    } else {
      console.error(`❌  Cannot reach MinIO: ${err.message ?? err}`);
      console.error('    Check VITE_MINIO_ENDPOINT and credentials.');
    }
    process.exit(1);
  }

  // 2. Upload a small test text file
  const testKey  = `test/quizi-test-${Date.now()}.txt`;
  const testBody = `Quizi MinIO test — ${new Date().toISOString()}`;

  console.log(`\n⬆️   Uploading test object: ${testKey} …`);
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: testKey,
        Body: Buffer.from(testBody, 'utf-8'),
        ContentType: 'text/plain',
      }),
    );
    const publicUrl = `${endpoint.replace(/\/$/, '')}/${bucket}/${testKey}`;
    console.log(`✅  Upload successful!`);
    console.log(`    Public URL: ${publicUrl}`);
  } catch (err: any) {
    console.error(`❌  Upload failed: ${err.message ?? err}`);
    process.exit(1);
  }

  // 3. Delete the test object (cleanup)
  console.log(`\n🗑️   Cleaning up test object …`);
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: testKey }));
    console.log(`✅  Cleanup done.\n`);
  } catch (err: any) {
    console.warn(`⚠️   Cleanup failed (non-fatal): ${err.message ?? err}\n`);
  }

  console.log('🎉  MinIO is working correctly!\n');
}

run();
