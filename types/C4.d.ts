/**
 * Event data for C4 use started events.
 */
interface C4UseStartedEvent {
    player: Internal.Player;
}

/**
 * Event data for C4 activation events.
 */
interface C4ActivatedEvent {
    level: Internal.Level;
    player: Internal.Player;
    explosionTime: number;
    explosionPower: number;
}

/**
 * Event data for C4 explosion events.
 */
interface C4ExplosionEvent {
    level: Internal.Level;
    position: {
        x: number;
        y: number;
        z: number;
    };
    power: number;
}
