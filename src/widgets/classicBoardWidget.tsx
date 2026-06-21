'use no memo';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { BoardHeader } from './boardHeader';
import { BoardProps } from './common';

export function ClassicBoard({
    transportType,
    stationName,
    departures,
}: BoardProps) {
    return (
        <FlexWidget style={styles.flexContainer}>
            <BoardHeader
                stationName={stationName}
                transportType={transportType}
            />
            <FlexWidget
                style={{
                    width: 'match_parent',
                    paddingHorizontal: 12,
                }}
            >
                {departures.slice(0, 2).map(d => {
                    const minutesUntilDeparture = Math.ceil(d.departsInMillis / (1000 * 60));
                    return (
                        <FlexWidget
                            key={d.lineCode}
                            style={{
                                width: 'match_parent',
                                flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}
                    >
                        <FlexWidget
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                flexGap: 16,
                            }}
                        >
                            <TextWidget
                                text={d.lineCode}
                                style={styles.pixelizedText}
                            />
                            <TextWidget
                                text={d.destination}
                                style={styles.pixelizedText}
                            />
                        </FlexWidget>
                        <TextWidget
                            text={
                                minutesUntilDeparture ?
                                `${minutesUntilDeparture} min` : 'Nu'
                            }
                            style={styles.pixelizedText}
                        />
                    </FlexWidget>
                )})}
            </FlexWidget>
        </FlexWidget>
    )
}

export function ClassicBoardWidget(props: BoardProps) {
    return (
        <ClassicBoard {...props}/>
    );
}

const styles = {
    flexContainer: {
        height: 'match_parent',
        width: 'match_parent',
        justifyContent: 'flex-start',
        alignItems: 'center',
        backgroundColor: '#050505',
    },
    pixelizedText: {
        fontSize: 31,
        fontFamily: 'Jersey10-Regular',
        color: '#ffb861',
        textShadowColor: '#ffb861',
        textShadowRadius: 5,
        textShadowOffset: { width: 0, height: 0 },
    },
    headerText: {
        fontSize: 12,
        fontFamily: 'FiraSansCondensed-Regular',
        color: '#ffffff',
    },
} as const;

// In development, automatically update the home screen widget on Fast Refresh
// if (__DEV__) {
//   requestWidgetUpdate({
//     widgetName: 'ClassicBoard',
//     renderWidget: () => <ClassicBoardWidget />,
//   });
// }
