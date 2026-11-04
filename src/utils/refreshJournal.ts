import { messageOf } from '@/services/transport/errors';
import { ManagedDatabase } from './managedDatabase';
import * as Storage from './storage';

/**
 * Diagnostics: a record of widget refreshes and provider requests, kept on the
 * device because logcat only holds about an hour. Off by default; while off,
 * widget refreshes never touch its database.
 *
 * Driven over adb through the `tavlan://debug` route (see `src/app/debug.tsx`),
 * and read with `scripts/pull-journal.sh`:
 *
 *   adb shell am start -a android.intent.action.VIEW -d 'tavlan://debug?journal=on'
 *
 * Actions: `on`, `off`, `status`, `print`, `clear`. Printed rows are logcat
 * lines starting with `[journal]`, tab separated: id, UTC time, kind, ms, detail.
 */

const KEEP_DAYS = 21;
/** Keeps a printout to a size logcat can carry in one go. */
const KEEP_ROWS = 10_000;
/** Printing pauses between batches, so logd does not drop lines from the burst. */
const PRINT_BATCH = 200;

const journalDb = new ManagedDatabase('TavlanJournal', async db => {
    await db.execAsync(`
        CREATE TABLE IF NOT EXISTS event (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            at TEXT NOT NULL,
            kind TEXT NOT NULL,
            detail TEXT NOT NULL,
            ms INTEGER
        );
    `);
    await db.runAsync(
        'DELETE FROM event WHERE at < $cutoff OR id <= (SELECT MAX(id) FROM event) - $keep',
        {
            $cutoff: new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000).toISOString(),
            $keep: KEEP_ROWS,
        }
    );
});

/**
 * Read once per process, since every widget task would otherwise pay for it.
 * Widget tasks and the app share one JS runtime, so `setEnabled` reaches both.
 */
let enabled: Promise<boolean> | null = null;

function isEnabled(): Promise<boolean> {
    return enabled ??= Storage.getJournalEnabled().catch(e => {
        // Not cached, so the next task asks again.
        enabled = null;
        console.warn('[journal] could not read the switch:', messageOf(e));
        return false;
    });
}

export async function setEnabled(on: boolean): Promise<void> {
    await Storage.setJournalEnabled(on);
    enabled = Promise.resolve(on);
}

/** Never throws: diagnostics must not be able to break a refresh. */
export async function record(kind: string, detail: string, ms?: number): Promise<void> {
    const at = new Date().toISOString();
    try {
        if (!(await isEnabled())) return;
        await journalDb.run(db => db.runAsync(
            'INSERT INTO event (at, kind, detail, ms) VALUES ($at, $kind, $detail, $ms)',
            { $at: at, $kind: kind, $detail: detail, $ms: ms ?? null }
        ));
    } catch (e) {
        console.warn('[journal] could not record:', messageOf(e));
    }
}

export type JournalStatus = { enabled: boolean; rows: number };

export async function status(): Promise<JournalStatus> {
    const on = await isEnabled();
    const row = await journalDb.run(db =>
        db.getFirstAsync<{ rows: number }>('SELECT COUNT(*) AS rows FROM event')
    );
    return { enabled: on, rows: row?.rows ?? 0 };
}

export async function clear(): Promise<void> {
    await journalDb.run(db => db.runAsync('DELETE FROM event'));
}

/** Prints every row, bracketed by `begin <count>` and `end <count>` lines. */
export async function print(): Promise<number> {
    const rows = await journalDb.run(db => db.getAllAsync<{
        id: number, at: string, kind: string, detail: string, ms: number | null
    }>('SELECT id, at, kind, detail, ms FROM event ORDER BY id'));

    console.log(`[journal] begin ${rows.length}`);
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        console.log(`[journal] ${r.id}\t${r.at}\t${r.kind}\t${r.ms ?? ''}\t${r.detail}`);
        if (i % PRINT_BATCH === PRINT_BATCH - 1) await new Promise(res => setTimeout(res, 50));
    }
    console.log(`[journal] end ${rows.length}`);
    return rows.length;
}
