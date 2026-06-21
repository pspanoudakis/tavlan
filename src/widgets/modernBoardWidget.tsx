'use no memo';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { BoardHeader } from './boardHeader';
import { BoardProps } from './common';

export function ModernBoard({
    stationName,
    transportType,
    departures
}: BoardProps) {
    const visibleDepartures = departures.slice(0, 4);

    return (
        <FlexWidget style={styles.flexContainer}>
            <BoardHeader
                stationName={stationName}
                transportType={transportType}
            />
            <FlexWidget
                style={{
                    width: 'match_parent',
                    paddingHorizontal: 16,
                    paddingVertical: 4
                }}
            >
                {visibleDepartures.map((d, index) => {
                    const minutesUntilDeparture = Math.ceil(d.departsInMillis / (1000 * 60));
                    return (
                        <FlexWidget
                            key={d.lineCode}
                            style={{
                                ...styles.row,
                                ...(index < visibleDepartures.length - 1
                                ? styles.rowWithDivider
                                : {}),
                        }}
                    >
                        <FlexWidget
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                flexGap: 8,
                            }}
                        >
                            <FlexWidget
                                style={{
                                    backgroundColor: d.additionalInfo.lineColor,
                                    borderRadius: 4,
                                    paddingHorizontal: 11,
                                    paddingBottom: 2,
                                    justifyContent: 'center',
                                    alignItems: 'center'
                                }}
                            >
                                <TextWidget
                                    text={d.lineCode}
                                    style={{
                                        ...styles.modernText,
                                        fontSize: 14
                                    }}
                                />
                            </FlexWidget>
                            <TextWidget
                                text={d.destination}
                                style={{
                                    ...styles.modernText,
                                    marginBottom: 1
                                }}
                            />
                        </FlexWidget>
                        <TextWidget
                            text={
                                minutesUntilDeparture ?
                                `${minutesUntilDeparture} min` : 'Nu'
                            }
                            style={styles.modernText}
                        />
                    </FlexWidget>
                )})}
            </FlexWidget>
        </FlexWidget>
    )
}

export function ModernBoardWidget(props: BoardProps) {
    return (
        // <ModernBoard
        //     stationName={sampleData.stationName}
        //     transportType={sampleData.transportType}
        //     departures={sampleData.departures}
        // />
        <ModernBoard {...props}/>
    );
}

const styles = {
    flexContainer: {
        height: 'match_parent',
        width: 'match_parent',
        justifyContent: 'flex-start',
        alignItems: 'center',
        backgroundColor: '#0e0e20',
    },
    modernText: {
        fontSize: 20,
        fontFamily: 'slgothicdisplay-bold.0',
        color: '#ffffff',
        textShadowColor: '#ffffff',
        textShadowRadius: 3,
        textShadowOffset: { width: 0, height: 0 },
    },
    row: {
        width: 'match_parent',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    rowWithDivider: {
        borderBottomWidth: 1,
        borderBottomColor: '#FFFFFF',
        paddingBottom: 6,
        marginBottom: 6,
    },
} as const;

// In development, automatically update the home screen widget on Fast Refresh
// if (__DEV__) {
//   requestWidgetUpdate({
//     widgetName: 'ModernBoard',
//     renderWidget: () => <ModernBoardWidget />,
//   });
// }
