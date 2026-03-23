import type { PutObjectCommandInput } from "@aws-sdk/client-s3";
import {
	CreateBucketCommand,
	HeadBucketCommand,
	PutBucketPolicyCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";

/**
 * Creates a MinIO-compatible S3 client from environment variables.
 * Requires S3_ENDPOINT, S3_ACCESS_KEY, and S3_SECRET_KEY to be defined.
 * Falls back to http://localhost:9000 when S3_ENDPOINT is unset (local dev).
 */
export function createS3Client(): S3Client {
	const endpoint = process.env.S3_ENDPOINT ?? "http://localhost:9000";
	const accessKeyId = process.env.S3_ACCESS_KEY;
	const secretAccessKey = process.env.S3_SECRET_KEY;

	if (!accessKeyId || !secretAccessKey) {
		throw new Error("S3_ACCESS_KEY and S3_SECRET_KEY must be set in .env before running seeds");
	}

	return new S3Client({
		endpoint,
		region: "us-east-1",
		credentials: { accessKeyId, secretAccessKey },
		// MinIO requires path-style access (host/bucket vs bucket.host)
		forcePathStyle: true,
	});
}

/**
 * Ensures a bucket exists and is publicly readable.
 * Creates it with a public-read policy if it does not exist yet.
 * Safe to call repeatedly — no-ops when the bucket already exists.
 */
export async function ensurePublicBucket(s3: S3Client, bucket: string): Promise<void> {
	try {
		await s3.send(new HeadBucketCommand({ Bucket: bucket }));
	} catch {
		await s3.send(new CreateBucketCommand({ Bucket: bucket }));
		await s3.send(
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
		console.log(`  Created public bucket: ${bucket}`);
	}
}

export async function uploadFile(s3: S3Client, input: PutObjectCommandInput): Promise<void> {
	await s3.send(new PutObjectCommand(input));
}
