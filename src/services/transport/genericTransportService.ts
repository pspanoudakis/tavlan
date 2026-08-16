export type TransportTypeCode = string;
type StopCode = string;
type LineCode = string;
type DirectionOrientation = 0 | 1;

/** A colour a board can paint a line badge with. */
export type LineColor = `#${string}`;

export type TransportTypeOption = {
    typeCode: TransportTypeCode
    displayName: string
};

export type StopOption = {
    stopCode: StopCode
    displayName: string
    transportOptions?: TransportTypeCode[]
};

export type DepartureEntry<AdditionalDepartureInfo = unknown> = {
    /**
     * Uniquely identifies this departure among those returned for a stop.
     * A stop served by a single line yields several departures sharing one
     * `lineCode`, so only this is safe to use as a render key.
     */
    id: string
    lineCode: LineCode
    destination: string
    direction: DirectionOrientation
    departsInMillis: number
    /**
     * Every operator brands its lines, so boards can rely on this being present
     * without knowing which provider produced the departure.
     */
    lineColor: LineColor
    /** Anything only this provider's own screens know how to interpret. */
    additionalInfo: AdditionalDepartureInfo
}

export abstract class GenericTransportService<AdditionalDepartureInfo = unknown> {

    /**
     * Prepares whatever local state the service needs — typically a cached stop
     * catalogue — and must be awaited before anything else is called.
     * Providers with nothing to prepare inherit this no-op.
     */
    public async init(): Promise<void> {}

    public abstract getAvailableTransportOptions(): TransportTypeOption[]

    /** Resolves a stop's display name, or undefined if the code is unknown. */
    public abstract getStopNameByCode(code: StopCode): Promise<string | undefined>

    public abstract getAvailableStops(
        transportTypes: TransportTypeCode[]
    ): Promise<StopOption[]>

    public abstract getLiveDeparturesFromStop(
        stopCode: StopCode,
        transportTypes: TransportTypeCode[]
    ): Promise<DepartureEntry<AdditionalDepartureInfo>[]>
}
