/**
 * Failures the transport layer can raise.
 *
 * Each error carries enough structure for a caller to phrase its own message, so
 * the service layer never has to decide on user-facing copy. See
 * `describeForBoard` in `@/widgets/common` for the widget's wording.
 *
 * Fields are declared and assigned explicitly rather than via constructor
 * parameter properties, which keeps these runnable under plain type stripping.
 */

/** The provider was reached, but rejected the request. */
export class TransportApiError extends Error {
    readonly status: number;
    readonly description: string;

    constructor(status: number, description: string) {
        super(`Provider responded ${status}: ${description}`);
        this.name = 'TransportApiError';
        this.status = status;
        this.description = description;
    }
}

/** The provider could not be reached, or its response could not be read. */
export class TransportUnreachableError extends Error {
    readonly reason: unknown;

    constructor(reason: unknown) {
        super(`Provider unreachable: ${messageOf(reason)}`);
        this.name = 'TransportUnreachableError';
        this.reason = reason;
    }
}

/** No stop has been selected yet, so there is nothing to fetch. */
export class StopNotConfiguredError extends Error {
    constructor() {
        super('No stop selected');
        this.name = 'StopNotConfiguredError';
    }
}

/** The local stop cache could not be built or read. */
export class StopCacheError extends Error {
    readonly operation: string;
    readonly reason: unknown;

    constructor(operation: string, reason: unknown) {
        super(`Stop cache ${operation} failed: ${messageOf(reason)}`);
        this.name = 'StopCacheError';
        this.operation = operation;
        this.reason = reason;
    }
}

export function messageOf(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
}

/**
 * Wording for each failure above. Declared here rather than with the rest of a
 * provider's copy so that adding an error type shows up as a missing property on
 * every provider, in the provider's own language.
 */
export type TransportErrorStrings = {
    notConfigured: string;
    unreachable: string;
    providerDown: string;
    requestFailed: string;
    unknown: string;
};

/** Turns a failure into a line short enough to fit on a board. */
export function describeError(e: unknown, strings: TransportErrorStrings): string {
    if (e instanceof StopNotConfiguredError) return strings.notConfigured;
    if (e instanceof TransportUnreachableError) return strings.unreachable;
    if (e instanceof TransportApiError) {
        return e.status >= 500 ? strings.providerDown : strings.requestFailed;
    }
    return strings.unknown;
}
