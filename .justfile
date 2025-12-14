sync-js:
    rsync -av --delete -r --exclude=config --exclude=probe --exclude=*.txt ./src/ "$(cygpath -u $DST_KJS_DIR)/"

sync-logs:
    rsync -av --delete -r "$(cygpath -u $DST_LOG_DIR)/" ./logs/

sync-types:
    rsync -av --delete -r "$(cygpath -u $DST_KJS_DIR)/probe" ./types/probe
