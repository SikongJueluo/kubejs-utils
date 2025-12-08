const KeyMapping = Java.loadClass("net.minecraft.client.KeyMapping");

const C4_EXPLOSION_TIME = 3 * 20; // 3 seconds in ticks
const C4_EXPLOSION_POWER = 4; // Explosion power (TNT is 4)

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
        /** @type {string} */ (block.id) === "kubejs:c4_target" &&
        !isPlayerInfoChanged &&
        /** @type {string} */ (itemstack.id) === "kubejs:c4_item"
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

            if (/** @type {string} */ (block.id) !== "kubejs:c4_target") {
                return false;
            }

            const playerPos = player.position();
            const lookAngle = player.lookAngle;
            lastPlayerInfoMap[player.uuid.toString()] = {
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

            console.log(`Player UUID: ${player.uuid}`);
            console.log(
                `Player Info: ${JSON.stringify(lastPlayerInfoMap[player.uuid.toString()])}`,
            );

            const server = Utils.server;
            server.scheduleInTicks(5, (event) => {
                const itemstack = player.getUseItem();

                // Check if player is still using the item
                if (
                    itemstack === undefined ||
                    /** @type {string} */ (itemstack.id) !== "kubejs:c4_item"
                ) {
                    return;
                }

                if (!shouldActivateC4(itemstack, level, player)) {
                    player.stopUsingItem();
                    player.addItemCooldown(itemstack.getItem(), 20);
                    itemstack.resetHoverName();
                    delete lastPlayerInfoMap[player.uuid.toString()];
                    return;
                }

                // Get remaining ticks for this use
                const ticksUsingItem = player.getTicksUsingItem();
                const remainingTicks = 100 - ticksUsingItem; // useDuration is 100

                // if (remainingTicks <= 0) return;

                itemstack.setHoverName(
                    /** @type {any} */ (
                        Component.literal(
                            `C4 - ${(remainingTicks / 20.0).toFixed(2)}s`,
                        )
                    ),
                );

                event.reschedule();
            });

            return true;
        })
        .finishUsing((itemstack, level, entity) => {
            if (!entity.isPlayer()) {
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
            const c4PlacedGameTime = level.levelData.getGameTime();

            // Store block position for explosion (capture in closure)
            const explosionX = c4BlockPos.x;
            const explosionY = c4BlockPos.y;
            const explosionZ = c4BlockPos.z;

            server.scheduleInTicks(20, (event) => {
                const currentGameTime = level.levelData.getGameTime();
                const elapsedTime = currentGameTime - c4PlacedGameTime;
                const explosionRestTime = C4_EXPLOSION_TIME - elapsedTime;

                if (explosionRestTime > 0) {
                    server.players.forEach((p) => {
                        p.tell(
                            /** @type {any} */ (
                                Component.literal(
                                    `C4还剩 ${Math.ceil(explosionRestTime / 20)} 秒爆炸`,
                                )
                            ),
                        );
                    });
                    event.reschedule();
                } else {
                    // Check if C4 block is still there before exploding
                    const c4Block = level.getBlock(
                        explosionX,
                        explosionY,
                        explosionZ,
                    );
                    if (/** @type {string} */ (c4Block.id) === "kubejs:c4") {
                        // Remove the C4 block first
                        c4Block.set(/** @type {any} */ ("minecraft:air"));

                        // Create explosion
                        level.explode(
                            /** @type {any} */ (null),
                            explosionX + 0.5,
                            explosionY + 0.5,
                            explosionZ + 0.5,
                            C4_EXPLOSION_POWER,
                            "block",
                        );
                    }
                }
            });

            return itemstack;
        })
        .releaseUsing((itemstack, _level, entity, _count) => {
            itemstack.resetHoverName();
            if (!entity.isPlayer()) return;
            delete lastPlayerInfoMap[entity.uuid.toString()];
        })
        .displayName(/** @type {any} */ ("C4"));
});

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
