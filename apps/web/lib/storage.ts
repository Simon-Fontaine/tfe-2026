import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

// ─── Singleton S3 client ──────────────────────────────────────────────────────

let _s3Client: S3Client | null = null;

function getS3Client(): S3Client {
	if (!_s3Client) {
		_s3Client = new S3Client({
			endpoint: process.env.S3_ENDPOINT,
			region: "auto",
			credentials: {
				accessKeyId: process.env.S3_ACCESS_KEY ?? "",
				secretAccessKey: process.env.S3_SECRET_KEY ?? "",
			},
			forcePathStyle: true, // required for MinIO
		});
	}
	return _s3Client;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Uploads a file buffer to S3/MinIO.
 * Returns the public URL of the uploaded object.
 */
export async function uploadFile(
	bucket: string,
	key: string,
	buffer: Buffer,
	contentType: string
): Promise<string> {
	const client = getS3Client();

	await client.send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: key,
			Body: buffer,
			ContentType: contentType,
		})
	);

	const publicUrl = process.env.S3_PUBLIC_URL ?? process.env.S3_ENDPOINT ?? "";
	return `${publicUrl}/${bucket}/${key}`;
}

/**
 * Deletes a file from S3/MinIO by key.
 */
export async function deleteFile(bucket: string, key: string): Promise<void> {
	const client = getS3Client();

	await client.send(
		new DeleteObjectCommand({
			Bucket: bucket,
			Key: key,
		})
	);
}

/**
 * Extracts the object key from a public storage URL.
 * Returns null if the URL does not match the expected pattern.
 */
export function keyFromUrl(url: string, bucket: string): string | null {
	const publicUrl = process.env.S3_PUBLIC_URL ?? process.env.S3_ENDPOINT ?? "";
	const prefix = `${publicUrl}/${bucket}/`;
	if (url.startsWith(prefix)) {
		return url.slice(prefix.length);
	}
	return null;
}
