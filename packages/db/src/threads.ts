import { eq } from "drizzle-orm";
import { getDb } from "./index.ts";
import { threads } from "./schema.ts";

export interface ThreadRow<TData extends object = object> {
	id: string;
	createdAt: string;
	updatedAt: string;
	title: string;
	repoRoot: string;
	dataJson: TData;
}

export function putThread<TData extends object>(thread: ThreadRow<TData>, dbPath?: string): void {
	const db = getDb(dbPath);
	db.insert(threads)
		.values(thread)
		.onConflictDoUpdate({
			target: threads.id,
			set: {
				createdAt: thread.createdAt,
				updatedAt: thread.updatedAt,
				title: thread.title,
				repoRoot: thread.repoRoot,
				dataJson: thread.dataJson,
			},
		})
		.run();
}

export function getThread<TData extends object>(id: string, dbPath?: string): TData | undefined {
	const db = getDb(dbPath);
	const row = db.select().from(threads).where(eq(threads.id, id)).get();
	return row?.dataJson as TData | undefined;
}

export function listThreads<TData extends object>(dbPath?: string): TData[] {
	const db = getDb(dbPath);
	return db
		.select()
		.from(threads)
		.orderBy(threads.createdAt)
		.all()
		.map((row) => row.dataJson as TData);
}

export function deleteThread(id: string, dbPath?: string): void {
	const db = getDb(dbPath);
	db.delete(threads).where(eq(threads.id, id)).run();
}
