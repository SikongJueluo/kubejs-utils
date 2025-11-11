// AreaControl - Advanced Area Management System for KubeJS
// Event-driven architecture with high performance optimization

// ==================== TYPE DEFINITIONS ====================

/**
 * @typedef {object} AreaControlConfig
 * @property {boolean} enabled
 * @property {{x: number, y: number, z: number}} center
 * @property {number} radius
 * @property {string[]} whitelist
 * @property {"adventure" | "spectator"} mode
 * @property {number} cooldownSecs
 */

/**
 * @typedef {object} AreaBounds
 * @property {number} minX
 * @property {number} maxX
 * @property {number} minZ
 * @property {number} maxZ
 */

/**
 * @typedef {typeof Internal.HashMap} HashMap
 */

// ==================== GLOBAL CONSTANTS ====================

const SECOND_TICKS = 20;
const CONFIG_FILE = "areacontrol_config.json";
const CHECK_FREQUENCY = 20; // ticks (1 second)

// ==================== STATE MANAGEMENT ====================

/**
 * Default configuration
 * @type {AreaControlConfig}
 */
let config = {
    enabled: true,
    center: { x: 0, y: 0, z: 0 },
    radius: 5,
    whitelist: [],
    mode: "adventure",
    cooldownSecs: 10 * SECOND_TICKS, // 60 seconds
};

/**
 * Pre-calculated bounds for O(1) area checking
 * @type {AreaBounds}
 */
const bounds = {
    minX: -50,
    maxX: 50,
    minZ: -50,
    maxZ: 50,
};

/**
 * Player state cache - prevents unnecessary operations
 * @type {{[key: string]: boolean | undefined}}
 */
const playerStates = {};

/**
 * Item cooldown tracking
 * @type {{[key: string]: number | undefined}}
 */
const playerCooldowns = {};

// ==================== UTILITY FUNCTIONS ====================

/**
 * Update area bounds based on center and radius
 * Pre-calculates boundaries for efficient checking
 * @param {{x: number, y: number, z: number}} center
 * @param {number} radius
 * @returns {void}
 */
function updateBounds(center, radius) {
    bounds.minX = center.x - radius;
    bounds.maxX = center.x + radius;
    bounds.minZ = center.z - radius;
    bounds.maxZ = center.z + radius;

    console.log(
        `[AreaControl] Updated bounds: X(${String(bounds.minX)} to ${String(bounds.maxX)}), Z(${String(bounds.minZ)} to ${String(bounds.maxZ)})`,
    );
}

/**
 * Fast 2D area boundary check (ignores Y coordinate)
 * Uses pre-calculated bounds for O(1) performance
 * @param {number} x
 * @param {number} z
 * @returns {boolean}
 */
function isPositionInArea(x, z) {
    return (
        x >= bounds.minX &&
        x <= bounds.maxX &&
        z >= bounds.minZ &&
        z <= bounds.maxZ
    );
}

/**
 * Check if player is whitelisted for area control
 * @param {string} playerName
 * @returns {boolean}
 */
function isPlayerWhitelisted(playerName) {
    return config.whitelist.indexOf(playerName) !== -1;
}

/**
 * Handle player entering the protected area
 * @param {Internal.Player} player
 * @returns {void}
 */
function handlePlayerEnterArea(player) {
    // Apply configured game mode
    if (config.mode === "adventure") {
        Utils.getServer().getPlayer(player.stringUuid).setGameMode("adventure");
    } else {
        Utils.getServer().getPlayer(player.stringUuid).setGameMode("spectator");
    }

    // Send notification
    player.tell(
        /** @type {any} */ (
            Component.string(
                "§6[AreaControl] §eEntered protected area. Game mode changed.",
            )
        ),
    );
}

/**
 * Handle player leaving the protected area
 * @param {Internal.Player} player
 * @returns {void}
 */
function handlePlayerLeaveArea(player) {
    // Restore survival mode
    Utils.getServer().getPlayer(player.stringUuid).setGameMode("survival");

    // Send notification
    player.tell(
        /** @type {any} */ (
            Component.string(
                "§6[AreaControl] §eLeft protected area. Game mode restored.",
            )
        ),
    );
}

/**
 * Optimized player area check with state caching
 * Only triggers changes when crossing area boundaries
 * @param {Internal.Player} player
 * @returns {void}
 */
function checkPlayerAreaStatus(player) {
    if (!config.enabled || !isPlayerWhitelisted(player.username)) {
        return;
    }

    const pos = player.blockPosition();
    const isCurrentlyInArea = isPositionInArea(pos.x, pos.z);
    const playerId = player.stringUuid;
    const cachedState = playerStates[playerId];

    // Only process if state changed or first check
    if (cachedState !== isCurrentlyInArea) {
        if (isCurrentlyInArea) {
            handlePlayerEnterArea(player);
        } else if (cachedState === true) {
            // Only trigger leave if we were previously in area
            handlePlayerLeaveArea(player);
        }

        // Update cached state
        playerStates[playerId] = isCurrentlyInArea;
    }
}

/**
 * Check if item cooldown should be applied
 * @param {Internal.Player} player
 * @returns {boolean}
 */
function shouldApplyItemCooldown(player) {
    if (!config.enabled || !isPlayerWhitelisted(player.username)) {
        return false;
    }

    const playerState = playerStates[player.stringUuid];
    return playerState === undefined || playerState === true;
}

/**
 * Save configuration to persistent storage
 * @returns {void}
 */
function saveConfiguration() {
    const server = Utils.server;
    try {
        // Use KubeJS persistent data instead of JsonIO
        if (server.persistentData.contains(CONFIG_FILE)) {
            server.persistentData.put(CONFIG_FILE, NBT.toTag(config));
            console.log("[AreaControl] Configuration saved successfully");
        }
    } catch (error) {
        console.warn(`[AreaControl] Failed to save configuration:${error}`);
    }
}

/**
 * Load configuration from persistent storage
 * @returns {void}
 */
function loadConfiguration() {
    const server = Utils.server;
    try {
        if (server.persistentData.contains(CONFIG_FILE)) {
            const savedData = server.persistentData.get(CONFIG_FILE);
            if (typeof savedData === "string") {
                const loadedConfig = JSON.parse(savedData);
                config = Object.assign(config, loadedConfig);
                updateBounds(config.center, config.radius);
                console.log("[AreaControl] Configuration loaded from file");
            } else {
                updateBounds(config.center, config.radius);
                saveConfiguration(); // Create initial config
                console.log("[AreaControl] Created default configuration");
            }
        }
    } catch (error) {
        console.warn(
            `[AreaControl] Failed to load configuration, using defaults: ${error}`,
        );
        updateBounds(config.center, config.radius);
    }
}

/**
 * Register all event handlers
 * @returns {void}
 */
function registerEventHandlers() {
    /**
     * @param {Internal.PlayerEvent.LoggedIn} event
     */
    PlayerEvents.loggedIn((event) => {
        const { player } = event;

        const pos = player.blockPosition();
        const isInArea = isPositionInArea(pos.x, pos.z);

        playerStates[player.stringUuid] = isInArea;

        // Apply immediate game mode if in area
        if (isInArea && config.enabled) {
            handlePlayerEnterArea(player);
        }

        console.log(
            `[AreaControl] Player ${player.username} logged in, in area: ${String(isInArea)}`,
        );
    });

    /**
     * @param {Internal.PlayerEvent.LoggedOut} event
     */
    PlayerEvents.loggedOut((event) => {
        const { player } = event;
        const playerId = player.stringUuid;

        delete playerStates[playerId];
        delete playerCooldowns[playerId];

        console.log(
            `[AreaControl] Cleaned up data for player ${player.username}`,
        );
    });

    /**
     * @param {Internal.PlayerEvent.Tick} event
     */
    PlayerEvents.tick((event) => {
        const { player } = event;

        // Check every CHECK_FREQUENCY ticks for performance
        if (player.age % CHECK_FREQUENCY === 0) {
            checkPlayerAreaStatus(player);
        }
    });

    /**
     * @param {Internal.LivingEntityUseItemEvent$Finish} event
     */
    // ForgeEvents.onEvent(
    //     "net.minecraftforge.event.entity.living.LivingEntityUseItemEvent$Finish",
    //     (event) => {
    //         const { item: itemStack, entity } = event;
    //         if (!entity.isPlayer()) return;
    //         const player = Utils.server.getPlayer(entity.stringUuid);
    //         if (player === undefined || player === null) return;

    //         const item = itemStack.getItem();
    //         const itemsCooldowns = player.getCooldowns();

    //         if (
    //             shouldApplyItemCooldown(player) &&
    //             !itemsCooldowns.isOnCooldown(item)
    //         ) {
    //             itemsCooldowns.addCooldown(item, config.cooldownSecs);
    //         }
    //     },
    // );
}

/**
 * Register command system
 * @returns {void}
 */
function registerCommands() {
    /**
     * @param {Internal.ServerCommandEvent} event
     */
    ServerEvents.commandRegistry((event) => {
        const { commands, arguments: Arguments } = event;

        /**
         * @param {any} ctx
         * @returns {number}
         */
        const statusCommand = (ctx) => {
            const source = ctx.source;
            source.sendSuccess("§6[AreaControl] Current Status:", false);
            source.sendSuccess(`§e- Enabled: ${String(config.enabled)}`, false);
            source.sendSuccess(
                `§e- Center: (${String(config.center.x)}, ${String(config.center.y)}, ${String(config.center.z)})`,
                false,
            );
            source.sendSuccess(`§e- Radius: ${String(config.radius)}`, false);
            source.sendSuccess(`§e- Mode: ${config.mode}`, false);
            source.sendSuccess(
                `§e- Whitelist: ${String(config.whitelist.length)} players`,
                false,
            );
            source.sendSuccess(
                `§e- Cooldown: ${String(config.cooldownSecs)} Ticks (${String(config.cooldownSecs / SECOND_TICKS)}s)`,
                false,
            );
            source.sendSuccess(
                `§e- Active players: ${String(Object.keys(playerStates).length)}`,
                false,
            );
            return 1;
        };

        /**
         * @param {any} ctx
         * @returns {number}
         */
        const toggleCommand = (ctx) => {
            config.enabled = !config.enabled;
            saveConfiguration();
            ctx.source.sendSuccess(
                config.enabled
                    ? "§6[AreaControl] §aEnabled"
                    : "§6[AreaControl] §cDisabled",
                true,
            );
            return 1;
        };

        /**
         * @param {any} ctx
         * @returns {number}
         */
        const setCenterCommand = (ctx) => {
            const source = ctx.source;
            if (!source.player) {
                source.sendFailure("§cThis command must be run by a player");
                return 0;
            }
            const pos = source.player.blockPosition();
            config.center = { x: pos.x, y: pos.y, z: pos.z };
            updateBounds(config.center, config.radius);
            saveConfiguration();
            source.sendSuccess(
                `§6[AreaControl] §eCenter set to (${String(pos.x)}, ${String(pos.y)}, ${String(pos.z)})`,
                true,
            );
            return 1;
        };

        /**
         * @param {any} ctx
         * @returns {number}
         */
        const setRadiusCommand = (ctx) => {
            const radius = Arguments.INTEGER.getResult(ctx, "radius");
            if (radius < 1 || radius > 1000) {
                ctx.source.sendFailure("§cRadius must be between 1 and 1000");
                return 0;
            }
            config.radius = radius;
            updateBounds(config.center, config.radius);
            saveConfiguration();
            ctx.source.sendSuccess(
                `§6[AreaControl] §eRadius set to ${String(radius)}`,
                true,
            );
            return 1;
        };

        /**
         * @param {any} ctx
         * @returns {number}
         */
        const setModeCommand = (ctx) => {
            const mode = Arguments.STRING.getResult(ctx, "mode");
            if (mode !== "adventure" && mode !== "spectator") {
                ctx.source.sendFailure(
                    '§cMode must be either "adventure" or "spectator"',
                );
                return 0;
            }
            config.mode = mode;
            saveConfiguration();
            ctx.source.sendSuccess(
                `§6[AreaControl] §eArea mode set to ${mode}`,
                true,
            );
            return 1;
        };

        /**
         * @param {any} ctx
         * @returns {number}
         */
        const setCooldownCommand = (ctx) => {
            const cooldown = Arguments.INTEGER.getResult(ctx, "cooldown");
            if (cooldown < 0) {
                ctx.source.sendFailure(
                    "§cCooldown must be a non-negative number",
                );
                return 0;
            }
            config.cooldownSecs = cooldown;
            saveConfiguration();
            ctx.source.sendSuccess(
                `§6[AreaControl] §eItem cooldown set to ${String(cooldown)} ticks (${String(cooldown / 20)}s)`,
                true,
            );
            return 1;
        };

        /**
         * @param {any} ctx
         * @returns {number}
         */
        const whitelistAddCommand = (ctx) => {
            const playerName = Arguments.STRING.getResult(ctx, "player");
            if (config.whitelist.indexOf(playerName) === -1) {
                config.whitelist.push(playerName);
                saveConfiguration();
                ctx.source.sendSuccess(
                    `§6[AreaControl] §eAdded ${playerName} to whitelist`,
                    true,
                );
            } else {
                ctx.source.sendFailure(
                    `§c${playerName} is already whitelisted`,
                );
            }
            return 1;
        };

        /**
         * @param {any} ctx
         * @returns {number}
         */
        const whitelistRemoveCommand = (ctx) => {
            const playerName = Arguments.STRING.getResult(ctx, "player");
            const index = config.whitelist.indexOf(playerName);
            if (index !== -1) {
                config.whitelist.splice(index, 1);
                // Clean up player state if they're removed
                const server = ctx.source.server;
                const onlinePlayer = server.players.find(
                    /**
                     * @param {Internal.Player} p
                     * @returns {boolean}
                     */
                    (p) => p.username === playerName,
                );
                if (onlinePlayer) {
                    delete playerStates[onlinePlayer.stringUUID];
                    delete playerCooldowns[onlinePlayer.stringUUID];
                }
                saveConfiguration();
                ctx.source.sendSuccess(
                    `§6[AreaControl] §eRemoved ${playerName} from whitelist`,
                    true,
                );
            } else {
                ctx.source.sendFailure(`§c${playerName} is not whitelisted`);
            }
            return 1;
        };

        /**
         * @param {any} ctx
         * @returns {number}
         */
        const whitelistListCommand = (ctx) => {
            const source = ctx.source;
            if (config.whitelist.length === 0) {
                source.sendSuccess(
                    "§6[AreaControl] §eWhitelist is empty",
                    false,
                );
            } else {
                source.sendSuccess(
                    "§6[AreaControl] §eWhitelisted players:",
                    false,
                );
                config.whitelist.forEach((playerName) => {
                    source.sendSuccess(`§e- ${playerName}`, false);
                });
            }
            return 1;
        };

        /**
         * @param {any} ctx
         * @returns {number}
         */
        const reloadCommand = (ctx) => {
            loadConfiguration();
            ctx.source.sendSuccess(
                "§6[AreaControl] §aConfiguration reloaded",
                true,
            );
            return 1;
        };

        /**
         * @param {any} ctx
         * @returns {number}
         */
        const helpCommand = (ctx) => {
            const source = ctx.source;
            source.sendFailure("§cAvailable commands:");
            source.sendFailure(
                "§e- /areacontrol status - Show current configuration",
            );
            source.sendFailure(
                "§e- /areacontrol toggle - Enable/disable the system",
            );
            source.sendFailure(
                "§e- /areacontrol setcenter - Set area center to current position",
            );
            source.sendFailure(
                "§e- /areacontrol setradius <radius> - Set area radius",
            );
            source.sendFailure(
                "§e- /areacontrol setmode <adventure|spectator> - Set area game mode",
            );
            source.sendFailure(
                "§e- /areacontrol setcooldown <ticks> - Set item cooldown",
            );
            source.sendFailure(
                "§e- /areacontrol whitelist <add|remove|list> [player] - Manage whitelist",
            );
            source.sendFailure(
                "§e- /areacontrol reload - Reload configuration",
            );
            return 1;
        };

        // Register the main command with all subcommands
        event.register(
            commands
                .literal("areacontrol")
                .requires((source) => source.hasPermission(2))
                .executes(statusCommand) // Default to status when no args
                .then(commands.literal("status").executes(statusCommand))
                .then(commands.literal("toggle").executes(toggleCommand))
                .then(commands.literal("setcenter").executes(setCenterCommand))
                .then(
                    commands
                        .literal("setradius")
                        .then(
                            commands
                                .argument(
                                    "radius",
                                    Arguments.INTEGER.create(event),
                                )
                                .executes(setRadiusCommand),
                        ),
                )
                .then(
                    commands
                        .literal("setmode")
                        .then(
                            commands
                                .argument(
                                    "mode",
                                    Arguments.STRING.create(event),
                                )
                                .executes(setModeCommand),
                        ),
                )
                .then(
                    commands
                        .literal("setcooldown")
                        .then(
                            commands
                                .argument(
                                    "cooldown",
                                    Arguments.INTEGER.create(event),
                                )
                                .executes(setCooldownCommand),
                        ),
                )
                .then(
                    commands
                        .literal("whitelist")
                        .then(
                            commands
                                .literal("add")
                                .then(
                                    commands
                                        .argument(
                                            "player",
                                            Arguments.STRING.create(event),
                                        )
                                        .executes(whitelistAddCommand),
                                ),
                        )
                        .then(
                            commands
                                .literal("remove")
                                .then(
                                    commands
                                        .argument(
                                            "player",
                                            Arguments.STRING.create(event),
                                        )
                                        .executes(whitelistRemoveCommand),
                                ),
                        )
                        .then(
                            commands
                                .literal("list")
                                .executes(whitelistListCommand),
                        ),
                )
                .then(commands.literal("reload").executes(reloadCommand))
                .then(commands.literal("help").executes(helpCommand)),
        );
    });
}

// ==================== INITIALIZATION ====================

/**
 * Initialize the AreaControl system
 * @returns {void}
 */
function initializeAreaControl() {
    console.log("[AreaControl] Initializing area control system...");

    // Load configuration
    loadConfiguration();

    // Register event handlers
    registerEventHandlers();

    // Register commands
    registerCommands();

    console.log("[AreaControl] System initialized successfully");
    console.log(
        `[AreaControl] Area: center(${String(config.center.x)}, ${String(config.center.z)}), radius: ${String(config.radius)}`,
    );
    console.log(
        `[AreaControl] Mode: ${config.mode}, Enabled: ${String(config.enabled)}`,
    );
    console.log(
        `[AreaControl] Whitelisted players: ${String(config.whitelist.length)}`,
    );
}

// ==================== STARTUP EXECUTION ====================

// Initialize the system when script loads
initializeAreaControl();
