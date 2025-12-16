/**
 * Create a simple event bus for handling custom events in KubeJS environment.
 * @returns {EventBus}
 */
function createEventBus() {
    /**
     * @type {EventBus}
     */
    const bus = {
        eventMap: {},

        register: function (eventName, callback) {
            this.eventMap[eventName] = callback;
        },

        emit: function (eventName, event) {
            const callback = this.eventMap[eventName];
            if (callback) {
                return callback(event);
            }
        },
    };

    return bus;
}

global["eventBus"] = createEventBus();

// ==================== Forge Event Listeners ====================

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
