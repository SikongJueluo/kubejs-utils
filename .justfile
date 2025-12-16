log_dir := if os() == "linux" { "$LOG_DIR" } else { "$(cygpath -u $LOG_DIR)/" }
kjs_dir := if os() == "linux" { "$KJS_DIR" } else { "$(cygpath -u $KJS_DIR)/" }
pjs_dir := if os() == "linux" { "$PJS_DIR" } else { "$(cygpath -u $PJS_DIR)/" }

sync-js:
    rsync -av --delete -r --exclude=config --exclude=probe --exclude=*.txt ./src/ {{ kjs_dir }}

sync-logs:
    ln -s {{ log_dir }} ./logs

sync-types:
    ln -s {{ pjs_dir }} ./types/probe
