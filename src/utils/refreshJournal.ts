import { messageOf } from '@/services/transport/errors';
import { ManagedDatabase } from './managedDatabase';

/**
 * TEMPORARY diagnostics: a record of widget refreshes and SL requests, kept
 * for a few weeks because logcat only holds about an hour. It exists to answer
 * two questions: how often SL answers 429, and whether a request ever hangs.
 * The app prints it to logcat on launch, as lines starting with `[journal]`.
 */

const KEEP_DAYS = 21;

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
        `DELETE FROM event WHERE at < $cutoff`,
        { $cutoff: new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000).toISOString() }
    );
});

/** Never throws: diagnostics must not be able to break a refresh. */
export async function record(kind: string, detail: string, ms?: number): Promise<void> {
    const at = new Date().toISOString();
    try {
        await journalDb.run(db => db.runAsync(
            'INSERT INTO event (at, kind, detail, ms) VALUES ($at, $kind, $detail, $ms)',
            { $at: at, $kind: kind, $detail: detail, $ms: ms ?? null }
        ));
    } catch (e) {
        console.warn('[journal] could not record:', messageOf(e));
    }
}

export async function printJournal(): Promise<void> {
    try {
        const rows = await journalDb.run(db => db.getAllAsync<{
            id: number, at: string, kind: string, detail: string, ms: number | null
        }>('SELECT id, at, kind, detail, ms FROM event ORDER BY id'));
        console.log(`[journal] begin ${rows.length}`);
        for (const r of rows) {
            console.log(`[journal] ${r.id}\t${r.at}\t${r.kind}\t${r.ms ?? ''}\t${r.detail}`);
        }
        console.log('[journal] end');
    } catch (e) {
        console.warn('[journal] could not print:', messageOf(e));
    }
}
