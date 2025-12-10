sync-js:
    rsync -av --delete -r --exclude=config --exclude=probe ./src/ "$(cygpath -u $DST_KJS_DIR)/"

sync-logs:
    rsync -av --delete -r "$(cygpath -u $DST_LOG_DIR)/" ./logs/
