/**
 * Mapping of event names to their corresponding event types.
 */
interface EventMap {
    PlayerItemFishedEvent: Internal.ItemFishedEvent;
    LivingEntityUseItemEvent$Finish: Internal.LivingEntityUseItemEvent$Finish;
    C4Activated: C4ActivatedEvent;
    C4UseStarted: C4UseStartedEvent;
    C4Explosion: C4ExplosionEvent;
}

/**
 * Union type of all valid event names.
 */
type EventName = keyof EventMap;

/**
 * Callback function type for a specific event.
 */
type EventCallback<T extends EventName> = (event: EventMap[T]) => any;

/**
 * A simple event bus for handling custom events in KubeJS environment.
 */
interface EventBus {
    /**
     * Map storing event names and their corresponding callback functions.
     */
    eventMap: { [key: string]: Function };

    /**
     * Registers a callback function for a specific event.
     * @param eventName - The name of the event to listen for.
     * @param callback - The callback function to execute when the event is emitted.
     */
    register<T extends EventName>(
        eventName: T,
        callback: EventCallback<T>,
    ): void;

    /**
     * Emits an event, calling the registered callback function if it exists.
     * @param eventName - The name of the event to emit.
     * @param event - The event data to pass to the callback function.
     * @returns The return value of the callback function, or undefined if no callback is registered.
     */
    emit<T extends EventName>(eventName: T, event: EventMap[T]): any;
}
