import { DepartureEntry } from "@/services/transport/genericTransportService";
import { AdditionalSLStopInfo } from "@/services/transport/SL/service";

export type TransportType = 'METRO' | 'TRAIN'

export interface BoardProps {
    transportType: TransportType
    stationName: string,
    departures: DepartureEntry<AdditionalSLStopInfo>[]
}
