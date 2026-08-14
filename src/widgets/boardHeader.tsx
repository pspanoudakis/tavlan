'use no memo'
import type { TransportTypeCode } from "@/services/transport/genericTransportService";
import type { BoardPresentation } from "@/services/transport/provider";
import { FlexWidget, ImageWidget, TextWidget } from "react-native-android-widget";
import { formatUpdatedAt } from "./common";

export interface BoardHeaderProps {
    transportType: TransportTypeCode,
    stationName: string,
    presentation: BoardPresentation,
    updatedAt?: Date,
}

export function BoardHeader({
    transportType,
    stationName,
    presentation,
    updatedAt
}: BoardHeaderProps) {
    return (
        <FlexWidget
            style={{
                width: 'match_parent',
                justifyContent: 'center',
                backgroundColor: '#10054f',
                paddingVertical: 3,
                paddingHorizontal: 6,
                alignItems: 'center',
                flexDirection: 'row',
                flexGap: 4,
                borderBottomWidth: 2,
                borderBottomColor: '#f2f216'
            }}
        >
            <ImageWidget
                // The operator owns its branding; the header just asks for it.
                image={presentation.iconFor(transportType)}
                imageHeight={14}
                imageWidth={14}
            />
            <TextWidget
                text={stationName.toUpperCase().split('').map(c => `${c} `).join('')}
                style={styles.headerText}
            />
            {/*
              * Android refuses to refresh a widget more than twice an hour, so
              * show when the data was read rather than let it look live.
              */}
            {updatedAt ? (
                <TextWidget
                    text={formatUpdatedAt(updatedAt, presentation)}
                    style={styles.timestampText}
                />
            ) : null}
        </FlexWidget>
    )
}

const styles = {
    headerText: {
        fontSize: 12,
        fontFamily: 'FiraSansCondensed-Regular',
        color: '#ffffff',
    },
    timestampText: {
        fontSize: 10,
        fontFamily: 'FiraSansCondensed-Regular',
        color: '#9d9dc7',
    },
} as const;
