import type { GenericTransportService } from './genericTransportService';
import type { TransportProvider } from './provider';
import { SLProvider } from './SL/provider';

/** Every operator the app can show. Add a provider here to make it selectable. */
export const TRANSPORT_PROVIDERS: TransportProvider[] = [SLProvider];

export const DEFAULT_PROVIDER_ID = SLProvider.id;

const byId = new Map(TRANSPORT_PROVIDERS.map(p => [p.id, p]));

/**
 * Looks a provider up by its persisted id, falling back to the default when the
 * id is missing or names a provider that no longer ships.
 */
export function getProvider(id: string | null | undefined): TransportProvider {
    if (id) {
        const known = byId.get(id);
        if (known) return known;
        console.warn(`Unknown transport provider "${id}", falling back to ${DEFAULT_PROVIDER_ID}.`);
    }
    return byId.get(DEFAULT_PROVIDER_ID)!;
}

// Services hold a cached database handle, so one instance per provider is reused
// rather than rebuilt on every widget update.
const services = new Map<string, GenericTransportService<unknown>>();

export function getService(provider: TransportProvider): GenericTransportService<unknown> {
    const existing = services.get(provider.id);
    if (existing) return existing;

    const created = provider.createService();
    services.set(provider.id, created);
    return created;
}
