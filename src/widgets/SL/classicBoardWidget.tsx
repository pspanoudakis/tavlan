'use no memo';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { BoardHeader } from './boardHeader';
import { BoardFit, BoardProps, departuresThatFit, formatCountdown, REFRESH_CLICK_ACTION } from '../common';

/**
 * Heights in dp, for working out how many rows a resize leaves room for.
 * They describe this board specifically — the modern board is laid out
 * differently and carries its own numbers.
 */
const FIT: BoardFit = {
    // Header row: 31dp of Jersey 10 plus its 2dp bottom rule.
    chromeHeight: 24,
    // One line of 31dp text at the default line spacing. Rounded up: showing 5
    // rows in 216dp on the device puts the true height at or under 38dp.
    rowHeight: 37,
    min: 2,
    // Not a design limit but a sanity bound. This launcher ignores
    // `maxResizeHeight`, so the board has to fill whatever height it is handed.
    max: 10,
};

export function ClassicBoard({
    transportType,
    stationName,
    departures,
    presentation,
    message,
    updatedAt,
    heightDp,
}: BoardProps) {
    const visibleDepartures = departures.slice(0, departuresThatFit(heightDp, FIT));

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
                    paddingHorizontal: 12,
                }}
            >
                {message || !visibleDepartures.length ? (
                    <TextWidget
                        text={message ?? presentation.strings.noDepartures}
                        style={styles.pixelizedText}
                    />
                ) : visibleDepartures.map(d => {
                    return (
                        <FlexWidget
                            key={d.id}
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
                                text={formatCountdown(d.departsInMillis, presentation)}
                                style={styles.pixelizedText}
                            />
                        </FlexWidget>
                    )
                })}
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
} as const;
