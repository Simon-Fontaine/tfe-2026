import {
	CreateBucketCommand,
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	PutBucketPolicyCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

// Tracks which buckets have had their public-read policy confirmed this process
// lifetime so we don't pay the round-trip on every upload.
const _publicPolicyConfirmed = new Set<string>();

/**
 * Ensures a bucket exists and has a public-read policy.
 * Runs at most once per bucket per server process (cached after first success).
 * Safe to call before every upload — subsequent calls are instant no-ops.
 */
export async function ensureBucketPublicPolicy(bucket: string): Promise<void> {
	if (_publicPolicyConfirmed.has(bucket)) return;
	const client = getS3Client();
	try {
		await client.send(new HeadObjectCommand({ Bucket: bucket, Key: ".keep" }));
	} catch {
		// Bucket may not exist — create it first.
		try {
			await client.send(new CreateBucketCommand({ Bucket: bucket }));
		} catch {
			// Already exists — that's fine.
		}
	}
	await client.send(
		new PutBucketPolicyCommand({
			Bucket: bucket,
			Policy: JSON.stringify({
				Version: "2012-10-17",
				Statement: [
					{
						Effect: "Allow",
						Principal: "*",
						Action: ["s3:GetObject"],
						Resource: [`arn:aws:s3:::${bucket}/*`],
					},
				],
			}),
		})
	);
	_publicPolicyConfirmed.add(bucket);
}

export function buildObjectUrl(bucket: string, key: string) {
	const publicUrl = process.env.S3_PUBLIC_URL ?? process.env.S3_ENDPOINT ?? "";
	return `${publicUrl}/${bucket}/${key}`;
}

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

	return buildObjectUrl(bucket, key);
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

export async function downloadFile(
	bucket: string,
	key: string
): Promise<{ buffer: Buffer; contentType: string | null }> {
	const client = getS3Client();
	const response = await client.send(
		new GetObjectCommand({
			Bucket: bucket,
			Key: key,
		})
	);

	if (!response.Body) {
		throw new Error("Storage provider returned an empty object body.");
	}

	if (
		typeof response.Body === "object" &&
		response.Body !== null &&
		"transformToByteArray" in response.Body &&
		typeof response.Body.transformToByteArray === "function"
	) {
		const bytes = await response.Body.transformToByteArray();
		return {
			buffer: Buffer.from(bytes),
			contentType: response.ContentType ?? null,
		};
	}

	const arrayBuffer = await new Response(response.Body as BodyInit).arrayBuffer();
	return {
		buffer: Buffer.from(arrayBuffer),
		contentType: response.ContentType ?? null,
	};
}

export async function createPutUploadUrl(params: {
	bucket: string;
	key: string;
	contentType: string;
	expiresInSeconds?: number;
}) {
	const client = getS3Client();
	const uploadUrl = await getSignedUrl(
		client,
		new PutObjectCommand({
			Bucket: params.bucket,
			Key: params.key,
			ContentType: params.contentType,
		}),
		{
			expiresIn: params.expiresInSeconds ?? 900,
		}
	);

	return {
		uploadUrl,
		objectUrl: buildObjectUrl(params.bucket, params.key),
	};
}

export async function headFile(
	bucket: string,
	key: string
): Promise<{ contentType: string | null; contentLength: number | null }> {
	const client = getS3Client();
	const response = await client.send(
		new HeadObjectCommand({
			Bucket: bucket,
			Key: key,
		})
	);

	return {
		contentType: response.ContentType ?? null,
		contentLength: typeof response.ContentLength === "number" ? response.ContentLength : null,
	};
}

export async function createGetSignedUrl(
	bucket: string,
	key: string,
	expiresInSeconds = 1800
): Promise<string> {
	const client = getS3Client();
	return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
		expiresIn: expiresInSeconds,
	});
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
