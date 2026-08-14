'use no memo';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { BoardHeader } from './boardHeader';
import { BoardProps, formatCountdown, REFRESH_CLICK_ACTION } from '../common';

export function ModernBoard({
    stationName,
    transportType,
    departures,
    presentation,
    message,
    updatedAt,
}: BoardProps) {
    const visibleDepartures = departures.slice(0, 4);

    return (
        <FlexWidget
            style={styles.flexContainer}
            clickAction={REFRESH_CLICK_ACTION}
            accessibilityLabel={presentation.strings.refreshHint(stationName)}
        >
            <BoardHeader
                stationName={stationName}
                transportType={transportType}
                presentation={presentation}
                updatedAt={updatedAt}
            />
            <FlexWidget
                style={{
                    width: 'match_parent',
                    paddingHorizontal: 16,
                    paddingVertical: 4
                }}
            >
                {message || !visibleDepartures.length ? (
                    <TextWidget
                        text={message ?? presentation.strings.noDepartures}
                        style={styles.modernText}
                    />
                ) : visibleDepartures.map((d, index) => {
                    return (
                        <FlexWidget
                            key={d.id}
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
                                        backgroundColor: d.lineColor,
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
                                text={formatCountdown(d.departsInMillis, presentation)}
                                style={styles.modernText}
                            />
                        </FlexWidget>
                    )
                })}
            </FlexWidget>
        </FlexWidget>
    )
}

export function ModernBoardWidget(props: BoardProps) {
    return (
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
