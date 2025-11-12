/**
 * @typedef {(
 *   "PlayerItemFishedEvent" |
 *   "LivingEntityUseItemEvent$Finish"
 * )} EventName
 */

/**
 * @typedef {(
 *   ((event: Internal.ItemFishedEvent) => any) |
 *   ((event: Internal.LivingEntityUseItemEvent$Finish) => any)
 * )} EventCallback
 */

/**
 * A simple event bus for handling custom events in KubeJS environment.
 * @namespace
 */
const eventBus = {
    /**
     * Map storing event names and their corresponding callback functions.
     * @type {{[key: string]: Function}}
     */
    eventMap: {},

    /**
     * Registers a callback function for a specific event.
     * @overload
     * @param {"PlayerItemFishedEvent"} eventName - The name of the event to listen for.
     * @param {(event: Internal.ItemFishedEvent) => any} callback - The callback function.
     * @returns {void}
     */
    /**
     * Registers a callback function for a specific event.
     * @overload
     * @param {"LivingEntityUseItemEvent$Finish"} eventName - The name of the event to listen for.
     * @param {(event: Internal.LivingEntityUseItemEvent$Finish) => any} callback - The callback function.
     * @returns {void}
     */
    /**
     * Registers a callback function for a specific event.
     * @param {EventName} eventName - The name of the event to listen for.
     * @param {EventCallback} callback - The callback function to execute when the event is emitted.
     * @returns {void}
     */
    register: function (eventName, callback) {
        this.eventMap[eventName] = callback;
    },

    /**
     * Registers a callback function for a specific event.
     * @overload
     * @param {"PlayerItemFishedEvent"} eventName - The name of the event to listen for.
     * @param {(event: Internal.ItemFishedEvent) => any} callback - The callback function.
     * @returns {void}
     */
    /**
     * Emits an event, calling the registered callback function if it exists.
     * @overload
     * @param {"LivingEntityUseItemEvent$Finish"} eventName - The name of the event to emit.
     * @param {Internal.LivingEntityUseItemEvent$Finish} event - The event data.
     * @returns {any}
     */
    /**
     * Emits an event, calling the registered callback function if it exists.
     * @param {string} eventName - The name of the event to emit.
     * @param {*} event - The event data to pass to the callback function.
     * @returns {*} The return value of the callback function, or undefined if no callback is registered.
     */
    emit: function (eventName, event) {
        const callback = this.eventMap[eventName];
        if (callback) {
            return callback(event);
        }
    },
};

/**
 * @typedef {typeof eventBus} EventBus
 */

global["eventBus"] = eventBus;

ForgeEvents.onEvent(
    "net.minecraftforge.event.entity.living.LivingEntityUseItemEvent$Finish",
    (event) => {
        eventBus.emit("LivingEntityUseItemEvent$Finish", event);
    },
);

ForgeEvents.onEvent(
    "net.minecraftforge.event.entity.player.ItemFishedEvent",
    (event) => {
        eventBus.emit("PlayerItemFishedEvent", event);
    },
);

ForgeEvents.onEvent(
    "net.minecraftforge.event.entity.player.ItemFishedEvent",
    (event) => {
        eventBus.emit("PlayerItemFishedEvent", event);
    },
);
