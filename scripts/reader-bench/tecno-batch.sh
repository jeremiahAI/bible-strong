#!/bin/bash
# SPIKE: run one command as a logged batch on the Tecno phone: waits for the Wi-Fi adb link,
# wakes the screen, logs host load + battery level/temperature at start and end.
# usage: tecno-batch.sh <name> <cmd...>
D=${TECNO:-100.92.219.76:5555}; L=output/reader-bench/tecno-batches.log
for i in $(seq 1 30); do adb -s $D get-state 2>/dev/null | grep -q device && break; adb connect $D >/dev/null 2>&1; sleep 4; done
snap() { echo "$(date +%T) $1 $2 | load $(uptime | sed 's/.*averages: //') | $(adb -s $D shell 'dumpsys battery' | egrep 'level|temperature' | tr -s ' \n' ' ')" >> $L; }
adb -s $D shell input keyevent KEYCODE_WAKEUP
snap "$1" START
"${@:2}" > output/reader-bench/run-$1.log 2>&1
snap "$1" END
