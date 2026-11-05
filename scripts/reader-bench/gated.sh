#!/bin/bash
# SPIKE: run one renderer fixture-by-fixture, waiting for host load1 < 12 before each, logging load before/after.
# usage: gated.sh <renderer> <label-prefix> <extra args...>
R=$1; P=$2; shift 2
OUT=output/reader-bench
load1() { uptime | sed 's/.*averages: //' | cut -d, -f1 | cut -d. -f1; }
for F in ${FIXTURES:-psalm119 john1-strong genesis1-bhg-interlinear john1-parallel romans8-annotated}; do
  for i in $(seq 1 360); do [ "$(load1)" -lt 12 ] && break; sleep 10; done
  echo "$(date +%T) $R $F BEFORE $(uptime | sed 's/.*averages: //')" >> $OUT/load-$P.log
  node scripts/reader-bench/run.mjs --serial emulator-5580 --renderer $R --fixture $F --runs 5 --label $P-$F "$@" > $OUT/run-$P-$F.log 2>&1
  echo "$(date +%T) $R $F AFTER $(uptime | sed 's/.*averages: //')" >> $OUT/load-$P.log
done
echo DONE >> $OUT/load-$P.log
