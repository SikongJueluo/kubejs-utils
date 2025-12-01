const C4_EXPLOSION_TIME = 3 * 20;
const C4_EXPLOSION_RANGE = 256;

/**
 * @type {Map<Internal.UUID, {
 *  angle: {x: number, y:number, z:number},
 *  pos: {x: number, y: number, z: number}
 * }>}
 */
const lastPlayerInfoMap = new Map();

/**
 * @param {Internal.ItemStack} itemstack
 * @param {Internal.Level} level
 * @param {Internal.Player} player
 * @returns {boolean}
 */
function shouldActivateC4(itemstack, level, player) {
    const playerPos = player.position();
    const block = level.getBlock(
        playerPos.x() - 1, // Must subtract 1, is it a Bug ???
        playerPos.y() - 1, // The block under the player
        playerPos.z(),
    );

    const lookAngle = player.lookAngle;
    const lastPlayerInfo = lastPlayerInfoMap.get(player.UUID);
    if (lastPlayerInfo === undefined) return false;
    const isPlayerInfoChanged =
        lookAngle.x() !== lastPlayerInfo.angle.x ||
        lookAngle.y() !== lastPlayerInfo.angle.y ||
        lookAngle.z() !== lastPlayerInfo.angle.z ||
        playerPos.x() !== lastPlayerInfo.pos.x ||
        playerPos.y() !== lastPlayerInfo.pos.y ||
        playerPos.z() !== lastPlayerInfo.pos.z;

    return (
        /** @type {string} */ (block.id) === "kubejs:c4_target" &&
        !isPlayerInfoChanged
    );
}

StartupEvents.registry("block", (event) => {
    event
        .create("c4_target") // Create a new block
        .soundType(SoundType.WOOD) // Set a material (affects the sounds and some properties)
        .unbreakable()
        .textureAll("minecraft:block/target_top")
        .displayName(/** @type {any} */ ("C4 Target Block")); // Set a custom name
});

StartupEvents.registry("block", (event) => {
    event
        .create("c4") // Create a new block
        .soundType(SoundType.GRASS) // Set a material (affects the sounds and some properties)
        .hardness(1) // Set hardness (affects mining time)
        .resistance(1) // Set resistance (to explosions, etc)
        .noItem() // Player cannot hold or place the item
        .noDrops()
        .noCollision() // Set no hitbox
        .textureAll("minecraft:block/tnt_top")
        .displayName(/** @type {any} */ ("C4")); // Set a custom name
});

let c4PlacedGameTime = 0;
StartupEvents.registry("item", (event) => {
    event
        .create("c4_item")
        .unstackable()
        .useAnimation("eat")
        .useDuration((itemStack) => 100) // 5 Seconds
        .use((level, player, hand) => {
            const playerPos = player.position();
            const block = level.getBlock(
                playerPos.x() - 1, // Must subtract 1, is it a Bug ???
                playerPos.y() - 1, // The block under the player
                playerPos.z(),
            );

            if (/** @type {string} */ (block.id) === "kubejs:c4_target") {
                const itemstack = player.getUseItem();

                const lookAngle = player.lookAngle;
                lastPlayerInfoMap.set(player.UUID, {
                    angle: {
                        x: lookAngle.x(),
                        y: lookAngle.y(),
                        z: lookAngle.z(),
                    },
                    pos: {
                        x: playerPos.x(),
                        y: playerPos.y(),
                        z: playerPos.z(),
                    },
                });

                return true;
            } else {
                return false;
            }
        })
        .finishUsing((itemstack, level, entity) => {
            if (!entity.isPlayer()) {
                itemstack.shrink(1);
                return itemstack;
            }

            if (
                !shouldActivateC4(itemstack, level, /** @type {any} */ (entity))
            ) {
                return itemstack; // Do nothing
            }

            const playerPos = entity.position();
            const newBlock = level.getBlock(playerPos);
            newBlock.set(/** @type {any} */ ("kubejs:c4"));

            itemstack.shrink(1);
            itemstack.resetHoverName();

            const server = level.server;
            c4PlacedGameTime = level.levelData.getGameTime();
            server.scheduleInTicks(20, (event) => {
                const gameTime = level.levelData.getGameTime();
                const explosionRestTime =
                    C4_EXPLOSION_RANGE - gameTime - c4PlacedGameTime;
                if (explosionRestTime > 0) {
                    server.tell(
                        /** @type {Component} */ (
                            Component.literal(
                                `C4还剩 ${Math.floor(explosionRestTime / 20)} 秒`,
                            )
                        ),
                    );
                    event.reschedule(20);
                } else {
                    const blockPos = newBlock.pos;
                    level.explode(
                        /** @type {any} */ (null),
                        blockPos.x,
                        blockPos.y,
                        blockPos.z,
                        C4_EXPLOSION_RANGE,
                        "block",
                    );
                }
            });

            return itemstack;
        })
        .releaseUsing((itemstack, level, entity, count) => {
            itemstack.resetHoverName();
            if (!entity.isPlayer()) return;
            lastPlayerInfoMap.delete(entity.UUID);
        })
        .displayName(/** @type {any} */ ("C4"));
});

let useItemTickCnt = 0;
const useItemTickInterval = 5;
ForgeEvents.onEvent(
    "net.minecraftforge.event.entity.living.LivingEntityUseItemEvent$Tick",
    (event) => {
        // Check every 5 ticks (0.25s)
        if (useItemTickCnt++ % useItemTickInterval !== 0) return;

        const itemstack = event.getItem();
        if (/** @type {string} */ (itemstack.id) !== "kubejs:c4_item") return;

        if (
            !shouldActivateC4(
                itemstack,
                event.entity.level,
                /** @type {any} */ (event.entity),
            )
        ) {
            event.setCanceled(true);
        }

        const useDuration = event.duration;
        if (useDuration <= 0) return;
        itemstack.setHoverName(
            /** @type {any} */ (
                Component.literal(`C4 - ${(useDuration / 20.0).toFixed(2)}s`)
            ),
        );
    },
);
