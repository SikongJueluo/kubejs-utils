/**
 * C4 Server Scripts
 * Handles C4 block break event to cancel explosion
 * Handles C4 use started and activated events
 */

// ==================== Block Break Event Handler ====================

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

// ==================== C4 Event Handlers ====================

/**
 * @param {{player: Internal.Player}} event
 */
function handleC4UseStarted(event) {
    const server = Utils.getServer();
    if (server === null) {
        console.error("C4 Handler: Server is not available");
        return;
    }

    // Get shared variables from global
    /** @type {typeof shouldActivateC4} */
    const shouldActivateC4 = /** @type {any} */ (global["shouldActivateC4"]);
    /** @type {typeof shouldStartUseC4} */
    const shouldStartUseC4 = /** @type {any} */ (global["shouldStartUseC4"]);
    /** @type {{ [key: string]: any }} */
    const lastPlayerInfoMap = /** @type {any} */ (global["lastPlayerInfoMap"]);
    /** @type {number} */
    const C4_USE_TIME = /** @type {any} */ (global["C4_USE_TIME"]);

    if (
        shouldActivateC4 === undefined ||
        shouldStartUseC4 === undefined ||
        lastPlayerInfoMap === undefined ||
        C4_USE_TIME === undefined
    ) {
        console.error("C4 Handler: Required global variables not available");
        return;
    }

    const player = server.getPlayerList().getPlayer(event.player.uuid);
    const level = player.level;

    const startTime = level.levelData.gameTime;
    const originalItemstack = player.mainHandItem;

    server.scheduleRepeatingInTicks(2, (event) => {
        const itemstack = player.getMainHandItem();

        if (
            !shouldActivateC4(
                itemstack,
                player.level,
                /** @type {any} */ (player),
            )
        ) {
            player.stopUsingItem();
            player.addItemCooldown(originalItemstack.item, 20);
            originalItemstack.releaseUsing(
                level,
                /** @type {any} */ (player),
                originalItemstack.count,
            );
            event.clear();
            return;
        }

        // Get remaining ticks for this use
        const remainingTicks =
            C4_USE_TIME - (level.levelData.gameTime - startTime);

        if (remainingTicks <= 0) {
            originalItemstack.finishUsingItem(
                level,
                /** @type {any} */ (player),
            );
            delete lastPlayerInfoMap[player.uuid.toString()];
            event.clear();
            return;
        }

        itemstack.setHoverName(
            /** @type {any} */ (
                Component.literal(`C4 - ${(remainingTicks / 20.0).toFixed(1)}s`)
            ),
        );
    });
}

/**
 * Handle C4 activation event
 * @param {C4ActivatedEvent} event
 */
function handleC4Activated(event) {
    const server = Utils.getServer();
    if (server === null) {
        console.error("C4 Handler: Server is not available");
        return;
    }

    const { level, player, explosionTime, explosionPower } = event;

    // Get shared variables from global
    /** @type {{[key:string]: boolean | null}} */
    const toExplosionC4Map = /** @type {any} */ (global["toExplosionC4Map"]);

    if (toExplosionC4Map === undefined || toExplosionC4Map === null) {
        console.error("C4 Handler: toExplosionC4Map is not available");
        return;
    }

    // Place C4 at player's feet
    const c4BlockPos = {
        x: Math.floor(player.x),
        y: Math.floor(player.y),
        z: Math.floor(player.z),
    };
    const newBlock = level.getBlock(c4BlockPos.x, c4BlockPos.y, c4BlockPos.z);
    newBlock.set(/** @type {any} */ ("kubejs:c4"));

    // Add record
    const newBlockPosString = newBlock.pos.toShortString();
    toExplosionC4Map[newBlockPosString] = true;

    /**
     * TODO: It should use reschedule to replace several schedules
     * But reschedule not work at current time.
     * Relative Issue: https://github.com/KubeJS-Mods/KubeJS/issues/763
     */
    let remainingSeconds = explosionTime / 20;
    server.scheduleRepeatingInTicks(20, (scheduledEvent) => {
        // Assert C4 exsiting
        if (toExplosionC4Map[newBlockPosString] === null) {
            scheduledEvent.clear();
            return;
        }

        remainingSeconds -= 1;
        if (remainingSeconds <= 0) {
            scheduledEvent.clear();
            return;
        }

        server.players.forEach((p) => {
            p.tell(
                /** @type {any} */ (
                    Component.literal(`C4还剩 ${remainingSeconds} 秒爆炸`)
                ),
            );
        });
    });

    // Create explosion after countdown
    server.scheduleInTicks(explosionTime, (_) => {
        // Assert C4 exsiting
        if (toExplosionC4Map[newBlockPosString] === null) return;

        level.explode(
            /** @type {any} */ (null),
            c4BlockPos.x + 0.5,
            c4BlockPos.y + 0.5,
            c4BlockPos.z + 0.5,
            explosionPower,
            "block",
        );
    });
}

// ==================== Server Initialization ====================

ServerEvents.loaded((event) => {
    /**
     * WARNING: Must Do!!!
     * Because Kubejs scheduler is not stable
     * And need to fire once at first time
     * Relative Issue: https://github.com/KubeJS-Mods/KubeJS/issues/763
     */
    event.server.scheduleInTicks(1, (_) => {
        console.log("Init Scheduler");
    });

    /** @type {EventBus} */
    const eventBus = /** @type {any} */ (global["eventBus"]);

    if (eventBus === null) {
        console.error("C4 Handler: eventBus is not available");
        return;
    }

    eventBus.register("C4Activated", handleC4Activated);
    eventBus.register("C4UseStarted", handleC4UseStarted);
    console.log("C4 Handler: Registered C4Activated event handler");
});
