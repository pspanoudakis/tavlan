'use no memo'
import { FlexWidget, ImageWidget, TextWidget } from "react-native-android-widget";
import { TransportType } from "./common";

export interface BoardHeaderProps {
    transportType: TransportType,
    stationName: string,
}

export function BoardHeader({
    transportType,
    stationName
}: BoardHeaderProps) {
    return (
        <FlexWidget
            style={{
                width: 'match_parent',
                justifyContent: 'center',
                backgroundColor: '#10054f',
                paddingVertical: 3,
                alignItems: 'center',
                flexDirection: 'row',
                flexGap: 4,
                borderBottomWidth: 2,
                borderBottomColor: '#f2f216'
            }}
        >
            <ImageWidget
                image={require('@/assets/images/t-bana-favicon.png')}
                imageHeight={14}
                imageWidth={14}
            />
            <TextWidget
                text={stationName.toUpperCase().split('').map(c => `${c} `).join('')}
                style={styles.headerText}
            />
        </FlexWidget>
    )
}

const styles = {
    headerText: {
        fontSize: 12,
        fontFamily: 'FiraSansCondensed-Regular',
        color: '#ffffff',
    },
} as const;
