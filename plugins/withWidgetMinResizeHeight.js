const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Adds `android:minResizeHeight` to the generated widget provider XML.
 *
 * `react-native-android-widget` writes `minHeight`, `maxResizeHeight` and
 * `targetCellHeight`, but has no option for `minResizeHeight` — and that is the
 * attribute deciding how small the launcher lets a widget be dragged. On
 * Android 12 and above `targetCellHeight` is used in place of `minHeight`, so
 * without this the floor ends up being the widget's default size and it cannot
 * be shrunk at all.
 *
 * Must be listed BEFORE `react-native-android-widget` in app.json. Expo composes
 * mods so that the last one registered runs first (`withMod` awaits its own
 * action, then calls `nextMod`), so listing this earlier makes it run later —
 * after the XML it patches has been written.
 */
module.exports = function withWidgetMinResizeHeight(config, { widgets } = {}) {
    return withDangerousMod(config, [
        'android',
        async cfg => {
            const xmlDir = path.join(
                cfg.modRequest.platformProjectRoot,
                'app/src/main/res/xml'
            );

            for (const [name, minResizeHeight] of Object.entries(widgets ?? {})) {
                const file = path.join(xmlDir, `widgetprovider_${name.toLowerCase()}.xml`);
                if (!fs.existsSync(file)) {
                    throw new Error(
                        `withWidgetMinResizeHeight: no generated XML for widget "${name}" at ${file}. ` +
                        `Check the name matches app.json, and that this plugin runs after react-native-android-widget.`
                    );
                }

                const xml = fs.readFileSync(file, 'utf8');
                if (xml.includes('android:minResizeHeight')) continue;

                // Anchor on resizeMode: it is always emitted, so the attribute
                // lands inside the tag regardless of which options are set.
                const patched = xml.replace(
                    /(\s*)(android:resizeMode=)/,
                    `$1android:minResizeHeight="${minResizeHeight}"$1$2`
                );
                if (patched === xml) {
                    throw new Error(
                        `withWidgetMinResizeHeight: could not find android:resizeMode in ${file}.`
                    );
                }

                fs.writeFileSync(file, patched);
            }

            return cfg;
        },
    ]);
};
