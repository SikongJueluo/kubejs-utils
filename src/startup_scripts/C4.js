const $TickEvent$PlayerTickEvent = Java.loadClass(
    "net.minecraftforge.event.TickEvent$PlayerTickEvent",
);

/**
 * C4 explosion time in ticks (7 seconds)
 * @type {number}
 */
const C4_EXPLOSION_TIME = 10 * 20;

/**
 * C4 explosion power (TNT is 4)
 * @type {number}
 */
const C4_EXPLOSION_POWER = 128;

/**
 * C4 use time in ticks (5 seconds)
 * @type {number}
 */
const C4_USE_TIME = 5 * 20;

/**
 * @type {DataBus}
 */
const dataBus = /** @type {any} */ (global["dataBus"]);

// Export constants for server scripts
dataBus.export("C4_EXPLOSION_TIME", C4_EXPLOSION_TIME);

dataBus.export("C4_EXPLOSION_POWER", C4_EXPLOSION_POWER);

dataBus.export("C4_USE_TIME", C4_USE_TIME);

// Tolerance for floating point comparison
const ANGLE_TOLERANCE = 0.001;
const POS_TOLERANCE = 0.01;

/**
 * @type {Internal.KeyMapping | undefined}
 */
let operationKeyMapping;

/**
 * @type {{ [key: string]:{
 *  angle: {x: number, y:number, z:number},
 *  pos: {x: number, y: number, z: number},
 *  blockPos: {x: number, y: number, z: number}
 * } | undefined}}
 */
const lastPlayerInfoMap = {};

// Export for server scripts
/**
 * @type {{ [key: string]:{
 *  angle: {x: number, y:number, z:number},
 *  pos: {x: number, y: number, z: number},
 *  blockPos: {x: number, y: number, z: number}
 * } | undefined}}
 */
dataBus.export("lastPlayerInfoMap", lastPlayerInfoMap);

/**
 * @type {{[key:string]: boolean | null}}
 */
const toExplosionC4Map = {};

/**
 * @type {{[key:string]: boolean | null}}
 */
dataBus.export("toExplosionC4Map", toExplosionC4Map);

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
function getFeetBlockPosition(player) {
    return {
        x: Math.floor(player.x),
        y: Math.floor(player.y) - 1,
        z: Math.floor(player.z),
    };
}

/**
 * @param {Internal.ItemStack} itemstack
 * @param {Internal.Level} level
 * @param {Internal.Player} player
 * @returns {boolean}
 */
function shouldActivateC4(itemstack, level, player) {
    const blockUnder = getFeetBlockPosition(player);
    const block = level.getBlock(blockUnder.x, blockUnder.y, blockUnder.z);

    const lookAngle = player.lookAngle;
    const lastPlayerInfo = lastPlayerInfoMap[player.uuid.toString()];

    if (lastPlayerInfo === undefined) return false;

    // Check if player moved (using block position for stability)
    const currentBlockPos = getFeetBlockPosition(player);
    const isBlockPosChanged =
        currentBlockPos.x !== lastPlayerInfo.blockPos.x ||
        currentBlockPos.y !== lastPlayerInfo.blockPos.y ||
        currentBlockPos.z !== lastPlayerInfo.blockPos.z;

    // Check if player moved within the same block (with tolerance)
    const isPosChanged =
        !isApproximatelyEqual(player.x, lastPlayerInfo.pos.x, POS_TOLERANCE) ||
        !isApproximatelyEqual(player.y, lastPlayerInfo.pos.y, POS_TOLERANCE) ||
        !isApproximatelyEqual(player.z, lastPlayerInfo.pos.z, POS_TOLERANCE);

    // Check if player rotated view (with tolerance)
    const isAngleChanged =
        !isApproximatelyEqual(
            lookAngle.get("x"),
            lastPlayerInfo.angle.x,
            ANGLE_TOLERANCE,
        ) ||
        !isApproximatelyEqual(
            lookAngle.get("y"),
            lastPlayerInfo.angle.y,
            ANGLE_TOLERANCE,
        ) ||
        !isApproximatelyEqual(
            lookAngle.get("z"),
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

// Export for server scripts
/**
 * @param {Internal.ItemStack} itemstack
 * @param {Internal.Level} level
 * @param {Internal.Player} player
 * @returns {boolean}
 */
dataBus.export("shouldActivateC4", shouldActivateC4);

/**
 * Check if C4 use should start
 * @param {Internal.Player} player
 * @param {Internal.Level} level
 * @returns {boolean}
 */
function shouldStartUseC4(player, level) {
    const blockUnder = getFeetBlockPosition(player);
    const block = level.getBlock(blockUnder.x, blockUnder.y, blockUnder.z);

    if (block.id !== "kubejs:c4_target") {
        return false;
    }

    const playerUuid = player.uuid.toString();
    if (lastPlayerInfoMap[playerUuid] !== undefined) {
        return false;
    }

    const lookAngle = player.lookAngle;
    lastPlayerInfoMap[playerUuid] = {
        angle: {
            x: lookAngle.get("x"),
            y: lookAngle.get("y"),
            z: lookAngle.get("z"),
        },
        pos: {
            x: player.x,
            y: player.y,
            z: player.z,
        },
        blockPos: blockUnder,
    };

    return true;
}

// Export for server scripts
/**
 * @param {Internal.Player} player
 * @param {Internal.Level} level
 * @returns {boolean}
 */
dataBus.export("shouldStartUseC4", shouldStartUseC4);

// ==================== Block Registration ====================

StartupEvents.registry("block", (event) => {
    event
        .create("c4_target") // Create a new block
        .soundType(SoundType.WOOD) // Set a material (affects the sounds and some properties)
        .unbreakable()
        .textureAll("minecraft:block/target_top");

    event
        .create("c4") // Create a new block
        .soundType(SoundType.GRASS) // Set a material (affects the sounds and some properties)
        .hardness(1) // Set hardness (affects mining time)
        .requiresTool(true)
        .tagBlock("minecraft:mineable/axe") //can be mined faster with an axe
        .resistance(1) // Set resistance (to explosions, etc)
        .noItem() // Player cannot hold or place the item
        .noDrops()
        .noCollision() // Set no hitbox
        .textureAll("minecraft:block/tnt_top");
});

// ==================== Item Registration ====================

StartupEvents.registry("item", (event) => {
    event
        .create("c4_item")
        .unstackable()
        .useAnimation("eat")
        .useDuration((_itemStack) => C4_USE_TIME)
        .use((level, player, _hand) => {
            if (!shouldStartUseC4(player, level)) return false;

            /** @type {EventBus} */
            const eventBus = /** @type {any} */ (global["eventBus"]);
            if (eventBus !== null) {
                eventBus.emit("C4UseStarted", { player: player });
            } else {
                console.warn("EventBus is not available");
            }

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

            itemstack.shrink(1);

            // Emit custom event to server_scripts for explosion logic
            /** @type {EventBus} */
            const eventBus = /** @type {any} */ (global["eventBus"]);
            if (eventBus !== null) {
                eventBus.emit("C4Activated", {
                    level: level,
                    player: player,
                    explosionTime: C4_EXPLOSION_TIME,
                    explosionPower: C4_EXPLOSION_POWER,
                });
            }

            return itemstack;
        })
        .releaseUsing((itemstack, _level, entity, _count) => {
            itemstack.resetHoverName();
            if (!entity.isPlayer() || entity.uuid === undefined) return;
            delete lastPlayerInfoMap[entity.uuid.toString()];
        });

    event.create("c4_defuser", "axe").attackDamageBaseline(0).maxDamage(0);
});

// ==================== Client Side Logic ====================

// Register keybindings during client initialization
ClientEvents.init(() => {
    // Load required Java classes
    const KeyMappingRegistry = Java.loadClass(
        "dev.architectury.registry.client.keymappings.KeyMappingRegistry",
    );
    const KeyMapping = Java.loadClass("net.minecraft.client.KeyMapping");
    const GLFW = Java.loadClass("org.lwjgl.glfw.GLFW");

    // Create the KeyMapping
    // Parameters:
    //   1. Translation key for the key name (shown in controls menu)
    //   2. GLFW key code (default key)
    //   3. Translation key for the category
    operationKeyMapping = new KeyMapping(
        "key.kubejs.example", // Will be localized using this translation key
        GLFW.GLFW_KEY_G, // Default key is G
        "key.categories.kubejs", // Custom category for KubeJS keybindings
    );

    // Register the KeyMapping using Architectury's registry
    KeyMappingRegistry.register(operationKeyMapping);
});

// Send data to the server when the key is pressed
ForgeEvents.onEvent($TickEvent$PlayerTickEvent, (event) => {
    if (operationKeyMapping === undefined) {
        console.warn("Not in client platform");
        return event;
    }

    while (operationKeyMapping.consumeClick()) {
        const player = event.player;
        const level = player.level;
        if (!shouldStartUseC4(player, level)) continue;

        /** @type {EventBus} */
        const eventBus = /** @type {any} */ (global["eventBus"]);
        if (eventBus !== null) {
            eventBus.emit("C4UseStarted", { player: player });
        } else {
            console.warn("EventBus is not available");
        }
    }
});
