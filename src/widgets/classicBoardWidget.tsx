'use no memo';
import { FlexWidget, requestWidgetUpdate, TextWidget } from 'react-native-android-widget';
import { BoardHeader } from './boardHeader';
import { BoardProps, sampleData } from './common';

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
                {departures.slice(0, 2).map(d => (
                    <FlexWidget
                        key={d.lineNumber}
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
                                text={d.lineNumber.toString()}
                                style={styles.pixelizedText}
                            />
                            <TextWidget
                                text={d.destination}
                                style={styles.pixelizedText}
                            />
                        </FlexWidget>
                        <TextWidget
                            text={`${d.departsIn} min`}
                            style={styles.pixelizedText}
                        />
                    </FlexWidget>
                ))}
            </FlexWidget>
        </FlexWidget>
    )
}

export function ClassicBoardWidget() {
    return (
        <ClassicBoard
            stationName={sampleData.stationName}
            transportType={sampleData.transportType}
            departures={sampleData.departures}
        />
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
if (__DEV__) {
  requestWidgetUpdate({
    widgetName: 'ClassicBoard',
    renderWidget: () => <ClassicBoardWidget />,
  });
}
