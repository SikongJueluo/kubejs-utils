const KeyMapping = Java.loadClass("net.minecraft.client.KeyMapping");

const C4_EXPLOSION_TIME = 3 * 20; // 3 seconds in ticks
const C4_EXPLOSION_POWER = 128; // Explosion power (TNT is 4)

// Tolerance for floating point comparison
const ANGLE_TOLERANCE = 0.001;
const POS_TOLERANCE = 0.01;

/**
 * @type {{ [key: string]:{
 *  angle: {x: number, y:number, z:number},
 *  pos: {x: number, y: number, z: number},
 *  blockPos: {x: number, y: number, z: number}
 * } | undefined}}
 */
const lastPlayerInfoMap = {};

/**
 * Helper function to compare floating point numbers with tolerance
 * @param {number} a
 * @param {number} b
 * @param {number} tolerance
 * @returns {boolean}
 */
function isApproximatelyEqual(a, b, tolerance) {
    return Math.abs(a - b) <= tolerance;
}

/**
 * Get the block position under the player
 * @param {Internal.Player} player
 * @returns {{x: number, y: number, z: number}}
 */
function getBlockUnderPlayer(player) {
    const playerPos = player.position();
    return {
        x: Math.floor(playerPos.x()),
        y: Math.floor(playerPos.y()) - 1,
        z: Math.floor(playerPos.z()),
    };
}

/**
 * @param {Internal.ItemStack} itemstack
 * @param {Internal.Level} level
 * @param {Internal.Player} player
 * @returns {boolean}
 */
function shouldActivateC4(itemstack, level, player) {
    const blockUnder = getBlockUnderPlayer(player);
    const block = level.getBlock(blockUnder.x, blockUnder.y, blockUnder.z);

    const lookAngle = player.lookAngle;
    const playerPos = player.position();
    const lastPlayerInfo = lastPlayerInfoMap[player.uuid.toString()];

    if (lastPlayerInfo === undefined) return false;

    // Check if player moved (using block position for stability)
    const currentBlockPos = getBlockUnderPlayer(player);
    const isBlockPosChanged =
        currentBlockPos.x !== lastPlayerInfo.blockPos.x ||
        currentBlockPos.y !== lastPlayerInfo.blockPos.y ||
        currentBlockPos.z !== lastPlayerInfo.blockPos.z;

    // Check if player moved within the same block (with tolerance)
    const isPosChanged =
        !isApproximatelyEqual(
            playerPos.x(),
            lastPlayerInfo.pos.x,
            POS_TOLERANCE,
        ) ||
        !isApproximatelyEqual(
            playerPos.y(),
            lastPlayerInfo.pos.y,
            POS_TOLERANCE,
        ) ||
        !isApproximatelyEqual(
            playerPos.z(),
            lastPlayerInfo.pos.z,
            POS_TOLERANCE,
        );

    // Check if player rotated view (with tolerance)
    const isAngleChanged =
        !isApproximatelyEqual(
            lookAngle.x(),
            lastPlayerInfo.angle.x,
            ANGLE_TOLERANCE,
        ) ||
        !isApproximatelyEqual(
            lookAngle.y(),
            lastPlayerInfo.angle.y,
            ANGLE_TOLERANCE,
        ) ||
        !isApproximatelyEqual(
            lookAngle.z(),
            lastPlayerInfo.angle.z,
            ANGLE_TOLERANCE,
        );

    const isPlayerInfoChanged =
        isBlockPosChanged || isPosChanged || isAngleChanged;

    return (
        block.id === "kubejs:c4_target" &&
        !isPlayerInfoChanged &&
        itemstack.id === "kubejs:c4_item"
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

StartupEvents.registry("item", (event) => {
    event
        .create("c4_item")
        .unstackable()
        .useAnimation("eat")
        .useDuration((_itemStack) => 100) // 5 Seconds
        .use((level, player, _hand) => {
            const blockUnder = getBlockUnderPlayer(player);
            const block = level.getBlock(
                blockUnder.x,
                blockUnder.y,
                blockUnder.z,
            );

            if (block.id !== "kubejs:c4_target") {
                return false;
            }

            const playerUuid = player.uuid.toString();
            if (lastPlayerInfoMap[playerUuid] !== undefined) {
                return true;
            }

            const playerPos = player.position();
            const lookAngle = player.lookAngle;
            lastPlayerInfoMap[playerUuid] = {
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
                blockPos: blockUnder,
            };

            return true;
        })
        .finishUsing((itemstack, level, entity) => {
            if (!entity.isPlayer() || entity.uuid === undefined) {
                itemstack.shrink(1);
                return itemstack;
            }

            /** @type {Internal.Player} */
            const player = /** @type {any} */ (entity);

            if (!shouldActivateC4(itemstack, level, player)) {
                itemstack.resetHoverName();
                delete lastPlayerInfoMap[player.uuid.toString()];
                return itemstack; // Do nothing
            }

            // Place C4 at player's feet
            const playerPos = player.position();
            const c4BlockPos = {
                x: Math.floor(playerPos.x()),
                y: Math.floor(playerPos.y()),
                z: Math.floor(playerPos.z()),
            };
            const newBlock = level.getBlock(
                c4BlockPos.x,
                c4BlockPos.y,
                c4BlockPos.z,
            );
            newBlock.set(/** @type {any} */ ("kubejs:c4"));

            itemstack.shrink(1);
            itemstack.resetHoverName();
            delete lastPlayerInfoMap[player.uuid.toString()];

            const server = level.server;

            for (let i = 0; i < C4_EXPLOSION_TIME; i += 20) {
                server.scheduleInTicks(i, (event) => {
                    server.players.forEach((p) => {
                        p.tell(
                            /** @type {any} */ (
                                Component.literal(
                                    `C4还剩 ${(C4_EXPLOSION_TIME - event.timer) / 20} 秒爆炸`,
                                )
                            ),
                        );
                    });
                });
            }

            // Create explosion
            server.scheduleInTicks(C4_EXPLOSION_TIME, (_) => {
                level.explode(
                    /** @type {any} */ (null),
                    newBlock.pos.x,
                    newBlock.pos.y,
                    newBlock.pos.z,
                    C4_EXPLOSION_POWER,
                    "block",
                );
            });

            return itemstack;
        })
        .releaseUsing((itemstack, _level, entity, _count) => {
            itemstack.resetHoverName();
            if (!entity.isPlayer() || entity.uuid === undefined) return;
            delete lastPlayerInfoMap[entity.uuid.toString()];
        })
        .displayName(/** @type {any} */ ("C4"));
});

let useItemTickCnt = 0;
const useItemTickInterval = 5;
ForgeEvents.onEvent(
    "net.minecraftforge.event.entity.living.LivingEntityUseItemEvent$Tick",
    (event) => {
        // Check every 5 ticks (0.25s)
        if (useItemTickCnt++ % useItemTickInterval !== 0) {
            return;
        }

        const itemstack = event.item;
        if (
            !event.entity.isPlayer() ||
            event.entity.uuid === undefined ||
            itemstack === undefined ||
            itemstack.id !== "kubejs:c4_item"
        ) {
            return;
        }

        const player = event.entity.level.getPlayerByUUID(event.entity.uuid);

        if (!shouldActivateC4(itemstack, player.level, player)) {
            player.stopUsingItem();
            player.addItemCooldown(itemstack.item, 20);
            itemstack.resetHoverName();
            delete lastPlayerInfoMap[player.uuid.toString()];
            event.setCanceled(true);
            return;
        }

        // Get remaining ticks for this use
        const remainingTicks = event.duration;

        itemstack.setHoverName(
            /** @type {any} */ (
                Component.literal(`C4 - ${(remainingTicks / 20.0).toFixed(2)}s`)
            ),
        );
    },
);

const EXAMPLE_MAPPING = new KeyMapping(
    "key.examplemod.example1", // Will be localized using this translation key
    69, // Default key is E
    "key.categories.misc", // Mapping will be in the misc category
);
ForgeEvents.onEvent(
    "net.minecraftforge.client.event.RegisterKeyMappingsEvent",
    (event) => {
        event.register(EXAMPLE_MAPPING);
    },
);

/**
 * WARNING: Must Do!!!
 * Because Kubejs scheduler is not stable
 * And need to fire once at first time
 * Relative Issue: https://github.com/KubeJS-Mods/KubeJS/issues/763
 */
ForgeEvents.onEvent(
    "net.minecraftforge.event.server.ServerStartedEvent",
    (event) => {
        event.server.scheduleInTicks(1, (_) => {
            console.log("Init Scheduler");
        });
    },
);
