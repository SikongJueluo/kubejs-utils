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
