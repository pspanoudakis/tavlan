'use no memo';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { BoardFit, BoardProps, departuresThatFit, formatCountdown, REFRESH_CLICK_ACTION } from '../common';
import { BoardHeader } from './boardHeader';

/**
 * Heights in dp, for working out how many rows a resize leaves room for.
 * They describe this board specifically — the classic board sets type at a very
 * different size and carries its own numbers.
 */
const FIT: BoardFit = {
    // Header row and its rule, plus the 4dp padding above and below the list.
    chromeHeight: 32,
    // SL Gothic's line box is around 32dp at 20dp type — noticeably more than
    // the nominal size — plus the divider's 6dp padding, 1dp rule and 6dp
    // margin. Rounded up rather than down: a row too few leaves a little
    // background showing, a row too many clips.
    rowHeight: 45,
    min: 2,
    // Not a design limit but a sanity bound. This launcher ignores
    // `maxResizeHeight`, so the board has to fill whatever height it is handed.
    max: 10,
};

/**
 * At its smallest the launcher offers a single cell, and SL Gothic's line box
 * leaves no room there for the normal row spacing — two rows plus the header
 * exceed the height before the dividers are even counted.
 *
 * Rather than tighten the board everywhere, spacing is reduced only below this
 * height, and rows are pinned so the total is exact instead of depending on the
 * font's metrics. Every larger size keeps the normal spacing untouched.
 */
const COMPACT_BELOW_DP = 140;
const COMPACT_ROW_HEIGHT = 32;

export function ModernBoard({
    stationName,
    transportType,
    departures,
    presentation,
    message,
    updatedAt,
    heightDp,
}: BoardProps) {
    const visibleDepartures = departures.slice(0, departuresThatFit(heightDp, FIT));
    const compact = !!heightDp && heightDp < COMPACT_BELOW_DP;

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
                        <FlexWidget
                            key={d.id}
                            style={{
                                ...styles.row,
                                ...(compact ? styles.rowCompact : {}),
                                ...(index < visibleDepartures.length - 1
                                    ? (compact ? styles.dividerOnly : styles.rowWithDivider)
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
    // Only at the smallest widget size: a pinned height so two rows are
    // guaranteed to fit, and a divider carrying no spacing of its own.
    rowCompact: {
        height: COMPACT_ROW_HEIGHT,
    },
    dividerOnly: {
        borderBottomWidth: 1,
        borderBottomColor: '#FFFFFF',
    },
} as const;
