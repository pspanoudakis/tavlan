import { HexColor } from "react-native-android-widget";

const mainLineColors = {
    RED: '#e32222' as HexColor,
    GREEN: '#05662a' as HexColor,
    BLUE: '#4785e7' as HexColor
}

const lineColors = {
    10: mainLineColors.BLUE,
    11: mainLineColors.BLUE,
    13: mainLineColors.RED,
    14: mainLineColors.RED,
    17: mainLineColors.GREEN,
    18: mainLineColors.GREEN,
    19: mainLineColors.GREEN,
} as const;

export const sampleData = {
    transportType: 'T-BANA' as const,
    stationName: 'Tallkrogen',
    departures: [
        {
            lineNumber: 18,
            lineColor: lineColors[18],
            destination: "Farsta Strand",
            departsIn: 2
        },
        {
            lineNumber: 17,
            lineColor: lineColors[18],
            destination: "Alvik",
            departsIn: 4
        },
        {
            lineNumber: 14,
            lineColor: lineColors[14],
            destination: "Mörby Centrum",
            departsIn: 6
        },
        {
            lineNumber: 11,
            lineColor: lineColors[10],
            destination: "Akalla",
            departsIn: 8
        },
        {
            lineNumber: 10,
            lineColor: lineColors[11],
            destination: "Kungsträdgården",
            departsIn: 10
        },
    ]
}

export type TransportType = 'T-BANA' | 'SJ-PTAG'

export interface BoardProps {
    transportType: TransportType
    stationName: string,
    departures: Array<{
        lineNumber: number
        lineColor: HexColor
        destination: string,
        departsIn: number
    }>
}
