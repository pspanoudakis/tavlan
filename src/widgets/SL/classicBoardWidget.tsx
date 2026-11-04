'use no memo';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { BoardHeader } from './boardHeader';
import { BoardFit, BoardProps, departuresThatFit, formatCountdown, REFRESH_CLICK_ACTION } from '../common';

/** Pinned on every row, so the fit below is exact rather than a font estimate. */
const ROW_HEIGHT = 34;

/**
 * Heights in dp, for working out how many rows a resize leaves room for.
 * They describe this board specifically — the modern board is laid out
 * differently and carries its own numbers.
 */
const FIT: BoardFit = {
    // The shared header: 12dp type, 3dp padding above and below, a 2dp rule.
    // Measured at 23dp on a Galaxy A56; the extra dp is margin, not a row.
    chromeHeight: 25,
    // Jersey 10 at 31dp sets a line about 33.7dp tall, so 34 changes nothing
    // visible while making the row height a known number.
    rowHeight: ROW_HEIGHT,
    gapHeight: 0,
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
                                height: ROW_HEIGHT,
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
