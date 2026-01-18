/**
 * C4 Server Scripts
 * Handles C4 block break event to cancel explosion
 */

BlockEvents.broken((event) => {
    const { block, server } = event;

    // Check if the broken block is a C4
    if (block.id !== "kubejs:c4") {
        return;
    }

    // Get the toExplosionC4Map from global
    /** @type {{[key:string]: boolean | null}} */
    const toExplosionC4Map = /** @type {any} */ (global["toExplosionC4Map"]);

    if (toExplosionC4Map === undefined || toExplosionC4Map === null) {
        console.warn("C4 Server: toExplosionC4Map is not available");
        return;
    }

    // Get the block position string
    const blockPosString = block.pos.toShortString();

    // Check if this C4 is in the explosion map
    if (toExplosionC4Map[blockPosString] === true) {
        // Set to null to cancel the explosion
        // The explosion timer checks for === null to skip explosion
        toExplosionC4Map[blockPosString] = null;

        // Notify players that C4 has been defused
        if (server !== null) {
            server.players.forEach((player) => {
                player.tell(
                    /** @type {any} */ (
                        Component.literal("§aC4已被拆除，爆炸已取消！")
                    ),
                );
            });
        } else {
            console.warn("C4 Server: Server is null");
        }
    }
});
