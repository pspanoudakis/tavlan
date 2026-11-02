import * as SQLite from 'expo-sqlite';

import { messageOf } from '@/services/transport/errors';

type Task<T> = (db: SQLite.SQLiteDatabase) => Promise<T>;

/** How long a statement waits on another connection's lock before failing. */
const BUSY_TIMEOUT_MS = 5000;

/**
 * One long-lived SQLite connection that survives the ways an expo-sqlite handle
 * can die. Always go through this rather than calling `openDatabaseAsync`.
 *
 * On Android in expo-sqlite 56, opening a path that is already open returns the
 * same native object under a second JS wrapper, and garbage collecting either
 * wrapper destroys that object for both — it ignores the ref count, and leaves
 * the corpse in the module's cache marked as open. From then on the surviving
 * wrapper rejects every call with a `NullPointerException`, and reopening just
 * returns the corpse again, until the process dies. Because it takes a GC to
 * spring, this looks like the app breaking "after a while".
 *
 * So, in order:
 * - `useNewConnection` skips that cache. Each wrapper owns its own native
 *   connection, so one being collected cannot hurt another, and a reopen really
 *   is a new connection. (This is also why `expo-sqlite/kv-store` is not used:
 *   its connection cannot be replaced, and a second `SQLiteStorage` on the same
 *   file would recreate this exact bug.)
 * - The handle is held here for the life of the process, so it is never collected.
 * - Tasks run strictly one at a time. Besides making a duplicate open impossible,
 *   this keeps queries out of other tasks' transactions: everything shares one
 *   connection, so an unrelated read would otherwise see uncommitted rows, and a
 *   second `BEGIN` would fail and then `ROLLBACK` the first task's transaction.
 * - A task that fails is retried once on a fresh connection, so `run` tasks have
 *   to be safe to repeat.
 */
export class ManagedDatabase {
    private readonly name: string;
    private readonly onOpen: Task<void> | undefined;
    private db: SQLite.SQLiteDatabase | null = null;
    private queue: Promise<unknown> = Promise.resolve();

    /** @param onOpen Runs on every new connection, e.g. to create a table. */
    constructor(name: string, onOpen?: Task<void>) {
        this.name = name;
        this.onOpen = onOpen;
    }

    /**
     * Runs `task` with sole use of the connection. It must not call back into
     * this instance, since that would wait on itself forever.
     */
    run<T>(task: Task<T>): Promise<T> {
        return this.enqueue(async () => {
            try {
                return await task(await this.connect());
            } catch (e) {
                console.warn(`[sqlite] ${this.name} failed, reopening it: ${messageOf(e)}`);
                await this.disconnect();
                return await task(await this.connect());
            }
        });
    }

    /** Deletes the database file. Only for data that can be rebuilt. */
    destroy(): Promise<void> {
        return this.enqueue(async () => {
            await this.disconnect();
            await SQLite.deleteDatabaseAsync(this.name);
        });
    }

    private enqueue<T>(work: () => Promise<T>): Promise<T> {
        const result = this.queue.then(work);
        // A failure belongs to its caller; it must not stall the tasks behind it.
        this.queue = result.catch(() => undefined);
        return result;
    }

    private async connect(): Promise<SQLite.SQLiteDatabase> {
        if (this.db) return this.db;

        const db = await SQLite.openDatabaseAsync(this.name, { useNewConnection: true });
        await db.execAsync(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
        await this.onOpen?.(db);
        this.db = db;
        return db;
    }

    private async disconnect() {
        const db = this.db;
        this.db = null;
        try {
            await db?.closeAsync();
        } catch (e) {
            // Expected for a dead handle, and it is being abandoned either way.
            console.warn(`[sqlite] ${this.name} did not close cleanly: ${messageOf(e)}`);
        }
    }
}
