import { db } from "@/db";
import { notificationTable, type notificationTypeEnum } from "@/db/schema";

type NotificationType = (typeof notificationTypeEnum.enumValues)[number];

interface CreateNotificationInput {
	userId: string;
	type: NotificationType;
	title: string;
	body?: string;
	referenceType?: string;
	referenceId?: string;
}

/**
 * Insert a single notification row. Call from within Server Actions after
 * a mutation that should notify a user. Pass a transaction `tx` when called
 * inside a `db.transaction()` block.
 */
export async function createNotification(
	input: CreateNotificationInput,
	tx?: typeof db
): Promise<void> {
	const client = tx ?? db;
	await client.insert(notificationTable).values({
		userId: input.userId,
		type: input.type,
		title: input.title,
		body: input.body,
		referenceType: input.referenceType,
		referenceId: input.referenceId,
	});
}
