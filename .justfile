sync-js:
    rsync --delete -r --exclude=config ./src/ "$(cygpath -u $DST_KJS_DIR)/"

sync-log:
    rsync --delete -r "$(cygpath -u $DST_LOG_DIR)/" ./logs/
