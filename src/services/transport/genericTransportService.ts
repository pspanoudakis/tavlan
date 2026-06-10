export type TransportTypeCode = string;
type StopCode = string;
type LineCode = string;
type DirectionOrientation = 0 | 1;

export type TransportTypeOption = {
    typeCode: TransportTypeCode
    displayName: string
};

export type StopOption = {
    stopCode: StopCode
    displayName: string
    transportOptions?: TransportTypeCode[]
};

export type DepartureEntry<AdditionalDepartureInfo> = {
    lineCode: LineCode
    destination: string
    direction: DirectionOrientation
    departsInMillis: number
    additionalInfo: AdditionalDepartureInfo
}

export abstract class GenericTransportService<AdditionalDepartureInfo> {

    _isInitializing: boolean = true;
    
    public get isInitializing() : boolean {
        return this._isInitializing;
    }    

    public abstract getAvailableTransportOptions(): TransportTypeOption[]

    public abstract getAvailableStops(
        transportTypes: TransportTypeCode[]
    ): Promise<StopOption[]>

    public abstract getLiveDeparturesFromStop(
        stopCode: StopCode,
        transportTypes: TransportTypeCode[]
    ): Promise<DepartureEntry<AdditionalDepartureInfo>[]>
}
