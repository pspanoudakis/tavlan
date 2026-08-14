'use no memo';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { BoardHeader } from './boardHeader';
import { BoardProps, formatCountdown, REFRESH_CLICK_ACTION } from '../common';

export function ClassicBoard({
    transportType,
    stationName,
    departures,
    presentation,
    message,
    updatedAt,
}: BoardProps) {
    const visibleDepartures = departures.slice(0, 2);

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
