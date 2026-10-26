import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let s3ClientInstance = null;

function getS3Client() {
  if (s3ClientInstance) return s3ClientInstance;

  // Prioritize prompt-specified environment variables, with CLOUDFLARE_R2 ones as fallback
  const endpoint = process.env.R2_ENDPOINT || process.env.CLOUDFLARE_R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Cloudflare R2 is not fully configured. Please define R2_ENDPOINT, " +
      "R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY in your environment."
    );
  }

  s3ClientInstance = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return s3ClientInstance;
}

/**
 * Uploads a file buffer to Cloudflare R2 bucket.
 * 
 * @param {ArrayBuffer | Buffer} buffer - File contents
 * @param {string} key - Object key (path/filename in bucket)
 * @param {string} contentType - Mime-type of the file
 * @returns {Promise<string>} Public URL of the uploaded file
 */
export async function uploadToR2(buffer, key, contentType) {
  const bucketName = process.env.R2_BUCKET || process.env.CLOUDFLARE_R2_BUCKET_NAME;
  const publicUrlBase = process.env.R2_PUBLIC_URL || process.env.CLOUDFLARE_R2_PUBLIC_URL;

  if (!bucketName) {
    throw new Error("R2_BUCKET is not defined in your environment.");
  }

  const client = getS3Client();

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: Buffer.from(buffer),
    ContentType: contentType,
  });

  await client.send(command);

  // Return the public URL of the uploaded file
  // Default to endpoint + bucket if public URL base is not provided
  const base = publicUrlBase || `${process.env.R2_ENDPOINT || process.env.CLOUDFLARE_R2_ENDPOINT}/${bucketName}`;
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${normalizedBase}/${key}`;
}

/**
 * Time-limited signed GET URL for an R2 object. Works whether the bucket is
 * public or private — once the bucket is flipped to private, these are the
 * only URLs that keep working.
 *
 * @param {string} key - Object key
 * @param {number} expiresIn - Validity in seconds (default 10 minutes)
 * @returns {Promise<string>} Signed URL
 */
export async function getSignedR2Url(key, expiresIn = 600) {
  const bucketName = process.env.R2_BUCKET || process.env.CLOUDFLARE_R2_BUCKET_NAME;
  if (!bucketName) throw new Error("R2_BUCKET is not defined in your environment.");
  const client = getS3Client();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucketName, Key: key }), { expiresIn });
}

/**
 * Deletes an object from Cloudflare R2 bucket.
 * 
 * @param {string} key - Object key (path/filename in bucket)
 * @returns {Promise<boolean>} Success status
 */
export async function deleteFromR2(key) {
  const bucketName = process.env.R2_BUCKET || process.env.CLOUDFLARE_R2_BUCKET_NAME;

  if (!bucketName) {
    throw new Error("R2_BUCKET is not defined in your environment.");
  }

  const client = getS3Client();

  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  await client.send(command);
  return true;
}
