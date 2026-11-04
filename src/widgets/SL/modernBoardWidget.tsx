'use no memo';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { BoardFit, BoardProps, departuresThatFit, formatCountdown, REFRESH_CLICK_ACTION } from '../common';
import { BoardHeader } from './boardHeader';

/** Pinned row heights, so the fits below are exact rather than font estimates. */
const ROW_HEIGHT = 30;
/** Space either side of the 1dp divider between two rows. */
const DIVIDER_GAP = 6;
const DIVIDER_LINE = 1;

/**
 * At its smallest the launcher offers a single cell, and SL Gothic's line box
 * leaves no room there for the normal row spacing — two rows plus the header
 * exceed the height before the dividers are even counted.
 *
 * Rather than tighten the board everywhere, spacing is reduced only below this
 * height. Every larger size keeps the normal spacing untouched.
 */
const COMPACT_BELOW_DP = 140;
const COMPACT_ROW_HEIGHT = 32;

/** The shared header: 12dp type, 3dp padding above and below, a 2dp rule. */
const HEADER_HEIGHT = 25;

/**
 * Heights in dp, for working out how many rows a resize leaves room for.
 * They describe this board specifically — the classic board sets type at a very
 * different size and carries its own numbers.
 */
const FIT: BoardFit = {
    // Header (measured at 23dp; the rest is margin) plus 4dp of list padding
    // above and below.
    chromeHeight: HEADER_HEIGHT + 2 * 4,
    // SL Gothic at 20dp sets a line about 29.5dp tall.
    rowHeight: ROW_HEIGHT,
    gapHeight: 2 * DIVIDER_GAP + DIVIDER_LINE,
    min: 2,
    // Not a design limit but a sanity bound. This launcher ignores
    // `maxResizeHeight`, so the board has to fill whatever height it is handed.
    max: 10,
};

const COMPACT_FIT: BoardFit = {
    ...FIT,
    chromeHeight: HEADER_HEIGHT + 2 * 2,
    rowHeight: COMPACT_ROW_HEIGHT,
    gapHeight: DIVIDER_LINE,
};

export function ModernBoard({
    stationName,
    transportType,
    departures,
    presentation,
    message,
    updatedAt,
    heightDp,
}: BoardProps) {
    const compact = !!heightDp && heightDp < COMPACT_BELOW_DP;
    const visibleDepartures = departures.slice(
        0, departuresThatFit(heightDp, compact ? COMPACT_FIT : FIT)
    );

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
                    paddingVertical: compact ? 2 : 4
                }}
            >
                {message || !visibleDepartures.length ? (
                    <TextWidget
                        text={message ?? presentation.strings.noDepartures}
                        style={styles.modernText}
                    />
                ) : visibleDepartures.map((d, index) => {
                    return (
                        <FlexWidget key={d.id} style={{ width: 'match_parent' }}>
                            <FlexWidget
                                style={{
                                    ...styles.row,
                                    height: compact ? COMPACT_ROW_HEIGHT : ROW_HEIGHT,
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
                            {/* Its own element, so the gap is a known height rather than
                                padding and a border folded into the row. */}
                            {index < visibleDepartures.length - 1 ? (
                                <FlexWidget
                                    style={{
                                        ...styles.divider,
                                        marginVertical: compact ? 0 : DIVIDER_GAP,
                                    }}
                                />
                            ) : null}
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
    divider: {
        width: 'match_parent',
        height: DIVIDER_LINE,
        backgroundColor: '#FFFFFF',
    },
} as const;
