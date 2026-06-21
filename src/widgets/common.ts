import { DepartureEntry } from "@/services/transport/genericTransportService";
import { AdditionalSLStopInfo } from "@/services/transport/SL/service";
import { HexColor } from "react-native-android-widget";

const mainLineColors = {
    RED: '#e32222' as HexColor,
    GREEN: '#05662a' as HexColor,
    BLUE: '#4785e7' as HexColor,
    PINK: '#f166a7' as HexColor,
}

export function getLineColor(lineCode: string) {
    switch (lineCode) {
        case '10':
        case '11':
            return mainLineColors.BLUE;
        case '13':
        case '14':
            return mainLineColors.RED;
        case '17':
        case '18':
        case '19':
            return mainLineColors.GREEN;
        case '40':
        case '41':
        case '42':
        case '43':
        case '43X':
        case '48':
            return mainLineColors.PINK;
        default:
            break;
    }
}

export type TransportType = 'METRO' | 'TRAIN'

export interface BoardProps {
    transportType: TransportType
    stationName: string,
    departures: DepartureEntry<AdditionalSLStopInfo>[]
}
