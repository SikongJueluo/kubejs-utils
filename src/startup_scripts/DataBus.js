/**
 * Creates a simple data-exchange bus for sharing values across KubeJS scripts.
 * Provides export/import functionality similar to TypeScript modules with type hints.
 *
 * @returns {DataBus}
 */
function createDataBus() {
    /**
     * @type {Map<string, any>}
     */
    const dataMap = new Map();

    /**
     * @type {DataBus}
     */
    const bus = {
        /**
         * Export a value under a given name.
         * @template T
         * @param {string} name - Export identifier
         * @param {T} value - Value to export
         */
        export: function (name, value) {
            dataMap.set(name, value);
        },

        /**
         * Import a previously exported value.
         * @template T
         * @param {string} name - Export identifier
         * @returns {T} The exported value
         * @throws {Error} If the export does not exist.
         */
        import: function (name) {
            if (!dataMap.has(name)) {
                throw new Error(`DataBus: export "${name}" not found`);
            }
            return dataMap.get(name);
        },

        /**
         * Check if an export exists.
         * @param {string} name - Export identifier
         * @returns {boolean}
         */
        hasExport: function (name) {
            return dataMap.has(name);
        },

        /**
         * List all available export names.
         * @returns {string[]}
         */
        listExports: function () {
            return Array.from(dataMap.keys());
        },
    };

    return bus;
}

global["dataBus"] = createDataBus();
