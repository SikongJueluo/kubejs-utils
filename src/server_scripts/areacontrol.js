// AreaControl - Advanced Area Management System for KubeJS
// Event-driven architecture with high performance optimization

// ==================== TYPE DEFINITIONS ====================

/**
 * @typedef {object} AreaControlConfig
 * @property {boolean} enabled
 * @property {boolean} isIncludingOPs
 * @property {boolean} enableCooldown
 * @property {{x: number, y: number, z: number}} center
 * @property {number} radius
 * @property {string[]} whitelist - Players protected from gamemode changes
 * @property {"adventure" | "spectator"} mode
 * @property {number} cooldownSecs
 * @property {number} checkFrequency
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

/**
 * @type {EventBus | undefined}
 */
const EventBus = /** @type {any} */ (global["eventBus"]);

// ==================== STATE MANAGEMENT ====================

/**
 * Default configuration
 * @type {AreaControlConfig}
 */
let config = {
    enabled: true,
    isIncludingOPs: false,
    enableCooldown: true,
    center: { x: 0, y: 0, z: 0 },
    radius: 5,
    whitelist: [],
    mode: "adventure",
    cooldownSecs: 10 * SECOND_TICKS, // 60 seconds
    checkFrequency: 3 * SECOND_TICKS,
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
let playerStates = {};

/**
 * Item cooldown tracking
 * @type {{[key: string]: number | undefined}}
 */
let playerCooldowns = {};

// ==================== UTILITY FUNCTIONS ====================

/**
 * Check if EventBus is available
 * @param {any} obj
 * @returns {obj is EventBus}
 */
function isEventBus(obj) {
    return EventBus !== undefined && EventBus !== null;
}

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
        `[AreaControl] Updated bounds: X(${bounds.minX} to ${bounds.maxX}), Z(${bounds.minZ} to ${bounds.maxZ})`,
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
 * Check if player is protected from area control gamemode changes
 * @param {Internal.Player} player
 * @returns {boolean}
 */
function isPlayerWhitelisted(player) {
    if (config.isIncludingOPs) {
        return config.whitelist.indexOf(player.username) !== -1;
    } else {
        return (
            config.whitelist.indexOf(player.username) !== -1 ||
            player.hasPermissions(2) ||
            player.hasPermissions(3) ||
            player.hasPermissions(4)
        );
    }
}

/**
 * Handle player entering the protected area
 * @param {Internal.Player} player
 * @returns {void}
 */
function handlePlayerEnterArea(player) {
    // Apply configured game mode
    const server = Utils.server;
    if (config.mode === "adventure") {
        server.getPlayer(player.stringUuid).setGameMode("adventure");
    } else {
        server.getPlayer(player.stringUuid).setGameMode("spectator");
    }

    // Send notification
    server.runCommandSilent(
        `/title ${player.username} title {"text":"进入活动场地","color":"gold"}`,
    );
    server.runCommandSilent(
        `/title ${player.username} subtitle {"text":"切换为冒险模式","color":"yellow"}`,
    );
}

/**
 * Handle player leaving the protected area
 * @param {Internal.Player} player
 * @returns {void}
 */
function handlePlayerLeaveArea(player) {
    // Restore survival mode
    const server = Utils.server;
    server.getPlayer(player.stringUuid).setGameMode("survival");

    // Send notification
    server.runCommandSilent(
        `/title ${player.username} title {"text":"离开活动场地","color":"gold"}`,
    );
    server.runCommandSilent(
        `/title ${player.username} subtitle {"text":"切换为生存模式","color":"yellow"}`,
    );
}

/**
 * Optimized player area check with state caching
 * Only triggers changes when crossing area boundaries
 * @param {Internal.Player} player
 * @returns {void}
 */
function checkPlayerAreaStatus(player) {
    if (!config.enabled || isPlayerWhitelisted(player)) {
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
    if (!config.enabled || isPlayerWhitelisted(player)) {
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
    // Use KubeJS persistent data instead of JsonIO
    server.persistentData.put(CONFIG_FILE, NBT.toTag(config));
    console.log("[AreaControl] Configuration saved successfully");
}

/**
 * Load configuration from persistent storage
 * @returns {void}
 */
function loadConfiguration() {
    const server = Utils.server;
    if (server.persistentData.contains(CONFIG_FILE)) {
        const savedData = server.persistentData.get(CONFIG_FILE);
        const loadedConfig = NBT.fromTag(savedData);
        config = Object.assign(config, loadedConfig);
        updateBounds(config.center, config.radius);
        console.log("[AreaControl] Configuration loaded from file");
    } else {
        console.warn(
            "[AreaControl] Failed to load configuration, using defaults",
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
            `[AreaControl] Player ${player.username} logged in, in area: ${isInArea}`,
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
        if (player.age % config.checkFrequency === 0) {
            checkPlayerAreaStatus(player);
        }
    });

    if (!isEventBus(EventBus)) {
        config.enableCooldown = false;
        console.warn("[AreaControl] EventBus is not defined");
        return;
    }
    /**
     * @param {Internal.LivingEntityUseItemEvent$Finish} event
     */
    EventBus.register(
        "LivingEntityUseItemEvent$Finish",
        /**
         * @param {Internal.LivingEntityUseItemEvent$Finish} event
         */
        (event) => {
            if (!config.enableCooldown) return;

            const { item: itemStack, entity } = event;
            if (!entity.isPlayer()) return;
            const player = Utils.server.getPlayer(entity.stringUuid);
            if (
                player === undefined ||
                player === null ||
                !playerStates[player.stringUuid]
            )
                return;

            const item = itemStack.getItem();
            const itemsCooldowns = player.getCooldowns();

            if (
                shouldApplyItemCooldown(player) &&
                !itemsCooldowns.isOnCooldown(item)
            ) {
                itemsCooldowns.addCooldown(item, config.cooldownSecs);
            }
        },
    );
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
            source.sendSuccess("§6[区域控制] 当前状态:", false);
            source.sendSuccess(
                `§e- 开启状态: ${config.enabled ? "已开启" : "已关闭"}`,
                false,
            );
            source.sendSuccess(
                `§e- 是否包含管理员: ${config.isIncludingOPs ? "已包含" : "未包含"}`,
                false,
            );
            source.sendSuccess(
                `§e- 中心点: (${config.center.x}, ${config.center.y}, ${config.center.z})`,
                false,
            );
            source.sendSuccess(`§e- 半径: ${config.radius}`, false);
            source.sendSuccess(`§e- 模式: ${config.mode}`, false);
            source.sendSuccess(
                `§e- 白名单: ${config.whitelist.length} 名玩家`,
                false,
            );
            source.sendSuccess(
                `§e- 是否启用物品冷却: ${config.enableCooldown ? "已启用" : "未启用"}`,
                false,
            );
            source.sendSuccess(
                `§e- 物品冷却时间: ${config.cooldownSecs} 刻 (${config.cooldownSecs / SECOND_TICKS}秒)`,
                false,
            );
            source.sendSuccess(
                `§e- 检查频率: ${config.checkFrequency} 刻 (${config.checkFrequency / SECOND_TICKS}秒)`,
                false,
            );
            source.sendSuccess(
                `§e- 活跃玩家: ${Object.keys(playerStates).length}`,
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
            if (!config.enabled) {
                for (const playerUuid of Object.keys(playerStates)) {
                    const player = Utils.server.getPlayer(playerUuid);
                    handlePlayerLeaveArea(player);
                }
                playerStates = {};
                playerCooldowns = {};
            }
            saveConfiguration();
            ctx.source.sendSuccess(
                config.enabled
                    ? "§6[区域控制] §a已启用"
                    : "§6[区域控制] §c已禁用",
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
                source.sendFailure("§c此命令必须由玩家执行");
                return 0;
            }
            const pos = source.player.blockPosition();
            config.center = { x: pos.x, y: pos.y, z: pos.z };
            updateBounds(config.center, config.radius);
            saveConfiguration();
            source.sendSuccess(
                `§6[区域控制] §e中心点设置为 (${pos.x}, ${pos.y}, ${pos.z})`,
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
            if (radius < 1 || radius > 8192) {
                ctx.source.sendFailure("§c半径必须在 1 到 8192 之间");
                return 0;
            }
            config.radius = radius;
            updateBounds(config.center, config.radius);
            saveConfiguration();
            ctx.source.sendSuccess(`§6[区域控制] §e半径设置为 ${radius}`, true);
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
                    '§c模式必须是 "adventure" 或 "spectator"',
                );
                return 0;
            }
            config.mode = mode;
            saveConfiguration();
            ctx.source.sendSuccess(
                `§6[区域控制] §e区域模式设置为 ${mode}`,
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
                ctx.source.sendFailure("§c冷却时间必须是非负数");
                return 0;
            }
            config.cooldownSecs = cooldown;
            saveConfiguration();
            ctx.source.sendSuccess(
                `§6[区域控制] §e物品冷却时间设置为 ${cooldown} 刻 (${cooldown / SECOND_TICKS}秒)`,
                true,
            );
            return 1;
        };

        /**
         * @param {any} ctx
         * @returns {number}
         */
        const setCheckFrequencyCommand = (ctx) => {
            const frequency = Arguments.INTEGER.getResult(
                ctx,
                "checkFrequency",
            );
            if (frequency < 0) {
                ctx.source.sendFailure("§c检查频率必须是非负数");
                return 0;
            }
            config.checkFrequency = frequency;
            saveConfiguration();
            ctx.source.sendSuccess(
                `§6[区域控制] §e检查频率设置为 ${frequency} 刻 (${frequency / SECOND_TICKS}秒)`,
                true,
            );
            return 1;
        };

        /**
         * @param {any} ctx
         * @returns {number}
         */
        const toggleIncludingOPsCommand = (ctx) => {
            config.isIncludingOPs = !config.isIncludingOPs;
            saveConfiguration();
            ctx.source.sendSuccess(
                config.isIncludingOPs
                    ? "§6[区域控制] §a包含管理员"
                    : "§6[区域控制] §c不包含管理员",
                true,
            );
            return 1;
        };

        /**
         * @param {any} ctx
         * @returns {number}
         */
        const toggleCooldownCommand = (ctx) => {
            if (!isEventBus(EventBus)) {
                ctx.source.sendFailure("§c事件总线未注入，无法切换");
                return 0;
            }
            config.enableCooldown = !config.enableCooldown;
            saveConfiguration();
            ctx.source.sendSuccess(
                config.enableCooldown
                    ? "§6[区域控制] §a启用冷却"
                    : "§6[区域控制] §c禁用冷却",
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
                    `§6[区域控制] §e已将 ${playerName} 添加到白名单 (受游戏模式更改保护)`,
                    true,
                );
            } else {
                ctx.source.sendFailure(`§c${playerName} 已受游戏模式更改保护`);
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
                    `§6[区域控制] §e已将 ${playerName} 从白名单中移除 (不再受保护)`,
                    true,
                );
            } else {
                ctx.source.sendFailure(`§c${playerName} 不受游戏模式更改保护`);
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
                    "§6[区域控制] §e没有玩家受游戏模式更改保护",
                    false,
                );
            } else {
                source.sendSuccess(
                    "§6[区域控制] §e受游戏模式更改保护的玩家:",
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
            playerStates = {};
            playerCooldowns = {};
            ctx.source.sendSuccess("§6[区域控制] §a配置已重新加载", true);
            return 1;
        };

        /**
         * @param {any} ctx
         * @returns {number}
         */
        const helpCommand = (ctx) => {
            const source = ctx.source;
            source.sendFailure("§c可用命令:");
            source.sendFailure("§e- /areacontrol status - 显示当前配置");
            source.sendFailure("§e- /areacontrol toggle - 启用/禁用系统");
            source.sendFailure(
                "§e- /areacontrol toggleIncludingOPs - 是/否包括管理员",
            );
            source.sendFailure(
                "§e- /areacontrol toggleCooldown - 启用/禁用物品冷却",
            );
            source.sendFailure(
                "§e- /areacontrol setcenter - 将区域中心设置为当前位置",
            );
            source.sendFailure(
                "§e- /areacontrol setradius <radius> - 设置区域半径",
            );
            source.sendFailure(
                "§e- /areacontrol setmode <adventure|spectator> - 设置区域游戏模式",
            );
            source.sendFailure(
                "§e- /areacontrol setcooldown <ticks> - 设置物品冷却时间",
            );
            source.sendFailure(
                "§e- /areacontrol setcheckfrequency <ticks> - 设置检查频率",
            );
            source.sendFailure(
                "§e- /areacontrol whitelist <add|remove|list> [player] - 管理游戏模式更改白名单",
            );
            source.sendFailure("§e- /areacontrol reload - 重新加载配置");
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
                .then(
                    commands
                        .literal("toggleCooldown")
                        .executes(toggleCooldownCommand),
                )
                .then(
                    commands
                        .literal("toggleIncludingOPs")
                        .executes(toggleIncludingOPsCommand),
                )
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
                        .literal("setcheckFrequency")
                        .then(
                            commands
                                .argument(
                                    "checkFrequency",
                                    Arguments.INTEGER.create(event),
                                )
                                .executes(setCheckFrequencyCommand),
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
                                            Arguments.PLAYER.create(event),
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
                                            Arguments.PLAYER.create(event),
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

    // Load configuration after server loaded
    ServerEvents.loaded((_) => {
        loadConfiguration();
    });

    // Register event handlers
    registerEventHandlers();

    // Register commands
    registerCommands();

    console.log("[AreaControl] System initialized successfully");
    console.log(
        `[AreaControl] Area: center(${config.center.x}, ${config.center.z}), radius: ${config.radius}`,
    );
    console.log(
        `[AreaControl] Mode: ${config.mode}, Enabled: ${config.enabled}`,
    );
    console.log(`[AreaControl] Protected players: ${config.whitelist.length}`);
}

// ==================== STARTUP EXECUTION ====================

// Initialize the system when script loads
initializeAreaControl();
