#!/usr/bin/env bash
# Drives the on-device refresh journal over adb; see src/utils/refreshJournal.ts.
#
#   scripts/pull-journal.sh on                  # start recording
#   scripts/pull-journal.sh print > journal.tsv # rows: id, UTC time, kind, ms, detail
#   scripts/pull-journal.sh status | off | clear
#
# Opens Tavlan's diagnostics screen on the phone, which runs the action.
set -euo pipefail

action="${1:-print}"
case "$action" in
  on|off|status|print|clear) ;;
  *) echo "usage: $0 [print|on|off|status|clear]" >&2; exit 2 ;;
esac

# Device time, so that only lines from this run are read back.
since="$(adb shell "date '+%m-%d %H:%M:%S.000'" | tr -d '\r')"
# Identifies this request's result line among any earlier ones.
n="$(date +%s%N)"
# Single quotes for the phone's shell, which would otherwise split the link at `&`.
adb shell am start -W -a android.intent.action.VIEW \
  -d "'tavlan://debug?journal=$action&n=$n'" com.anonymous.tavlan >/dev/null

# The screen logs a `result` line once the action is done; `print` logs its rows
# first, so the last begin/end block before our result is ours.
for _ in $(seq 120); do
  log="$(adb logcat -d -v raw -s ReactNativeJS:I -T "$since" | tr -d '\r')"
  result="$(grep -m1 "^\[journal\] result $n " <<<"$log" || true)"
  if [[ -n "$result" ]]; then
    if [[ "$action" == print ]]; then
      awk '/^\[journal\] begin /{rows=""; inside=1; next}
           /^\[journal\] end /{inside=0; next}
           inside && /^\[journal\] /{sub(/^\[journal\] /, ""); rows = rows $0 "\n"}
           END{printf "%s", rows}' <<<"$log"
    fi
    echo "${result#"[journal] result $n "}" >&2
    exit 0
  fi
  sleep 1
done

echo "no result from the phone within 2 minutes" >&2
exit 1
