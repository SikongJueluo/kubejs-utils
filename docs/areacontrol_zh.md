# `areacontrol.js` 脚本说明

## 1. 概述

**AreaControl** 是一个为 Minecraft 服务器设计的强大的区域管理工具，通过 KubeJS 实现。它允许管理员在游戏世界中定义一个特殊区域，并对进入该区域的玩家施加特定的规则，例如自动切换游戏模式、限制物品使用等。

该脚本的核心设计理念是 **高性能** 与 **易用性**。它采用事件驱动和多种优化技术，确保在不牺牲服务器性能的前提下，提供稳定可靠的功能。本文档将为您提供从安装、使用到技术实现的全方位指南。

## 2. 功能特性

- **自动模式切换**：玩家进入指定区域时，自动切换为**冒险**或**旁观**模式；离开时恢复为**生存**模式。
- **灵活的白名单**：管理员可以通过命令将玩家加入白名单，使其不受游戏模式变更的影响。默认情况下，OP 不受影响，但此项可配置。
- **物品冷却系统**：可以为区域内的玩家设置统一的物品使用冷却时间。此功能依赖 `event_register.js` 脚本。
- **实时启/禁用**：管理员可通过一条简单命令，在不重启服务器的情况下，全局启用或禁用所有功能。
- **高性能设计**：
    - **事件驱动**：仅在玩家登录、登出或移动时触发逻辑，无不必要的轮询。
    - **降频检查**：玩家位置检查频率可调（默认为每 3 秒一次），减少服务器负担。
    - **状态缓存**：只在玩家跨越区域边界时执行核心操作，避免重复计算。
- **配置持久化**：所有配置（如区域中心、半径、白名单）都会自动保存，服务器重启后依然不会丢失数据。
- **丰富的管理命令**：提供了一套完整的命令，用于实时调整脚本的所有参数。

## 3. 用户指南

本节面向服务器管理员，指导您如何安装和使用 AreaControl。

### 3.1. 安装

1.  确保您的 Minecraft 服务器已经正确安装了 KubeJS Mod。
2.  将 `areacontrol.js` 脚本文件放置在服务器的 `kubejs/server_scripts/` 目录下。
3.  （可选）如果需要启用**物品冷却**功能，请确保 `event_register.js` 也已安装在 `kubejs/startup_scripts/` 目录下。
4.  重新启动服务器或在游戏内执行 `/kubejs reload server_scripts`。

脚本加载后将自动初始化。

### 3.2. 管理命令

您可以在游戏内通过 `/areacontrol` 系列命令来管理脚本。所有命令都需要管理员权限（等级 2 或更高）。

-   `/areacontrol status`
    -   **功能**：查看脚本所有当前的配置和运行状态。

-   `/areacontrol toggle`
    -   **功能**：全局启用或禁用脚本。禁用时，所有在区域内的玩家将恢复为生存模式。

-   `/areacontrol toggleIncludingOPs`
    -   **功能**：切换是否将管理员（OP）纳入游戏模式更改的管理范围。

-   `/areacontrol toggleCooldown`
    -   **功能**：启用或禁用物品冷却功能。

-   `/areacontrol setCircularArea <半径>`
    -   **功能**：将您当前的位置设置为区域的中心点，并定义其半径。
    -   **示例**：`/areacontrol setCircularArea 100`

-   `/areacontrol setAreaPos1`
    -   **功能**：将您当前的位置设置为区域的第一个角点。

-   `/areacontrol setAreaPos2`
    -   **功能**：将您当前的位置设置为区域的第二个角点，从而定义一个矩形区域。

-   `/areacontrol setmode <adventure|spectator>`
    -   **功能**：设置玩家进入区域后切换到的游戏模式。
    -   **示例**：`/areacontrol setmode spectator`

-   `/areacontrol setcooldown <刻数>`
    -   **功能**：设置物品冷却时间，单位为游戏刻（ticks, 20 ticks = 1 秒）。
    -   **示例**：`/areacontrol setcooldown 200` (设置为 10 秒)

-   `/areacontrol setcheckfrequency <刻数>`
    -   **功能**：设置检查玩家位置的频率，单位为游戏刻。较低的值响应更快，但性能开销更高。
    -   **示例**：`/areacontrol setcheckfrequency 40` (设置为每 2 秒检查一次)

-   `/areacontrol whitelist <add|remove|list> [玩家名]`
    -   **功能**：管理白名单。白名单内的玩家将不受游戏模式更改的影响。
    -   `add <玩家名>`：添加玩家到白名单。
    -   `remove <玩家名>`：从白名单移除玩家。
    -   `list`：列出所有白名单内的玩家。

-   `/areacontrol reload`
    -   **功能**：从存储中重新加载配置。

-   `/areacontrol help`
    -   **功能**：在游戏内显示所有可用命令的列表。

## 4. 技术实现

本节面向希望理解其工作原理或进行二次开发的开发者。

### 4.1. 脚本与环境

本项目使用 **JavaScript** 编写，并利用 JSDoc 注释提供类型提示，以增强代码的可读性和可维护性。开发时无需编译步骤。

-   **源码文件**：`kubejs/server_scripts/areacontrol.js`
-   **配置文件**：脚本的配置通过 KubeJS 的持久化数据 API 存储，通常位于 `saves/<世界名>/server_data/areacontrol_config.json`。不建议手动修改此文件。

### 4.2. 核心设计

#### 事件驱动架构
脚本不使用高开销的 `tick` 轮询，而是监听特定玩家事件来触发逻辑。
-   `PlayerEvents.loggedIn`: 玩家登录时，检查其位置并初始化状态。
-   `PlayerEvents.loggedOut`: 玩家登出时，清理其缓存数据以防内存泄漏。
-   `PlayerEvents.tick`: **降频使用**，默认每 3 秒（60 ticks）检查一次玩家位置，频率可调。

```javascript
// 示例：降频检查玩家位置
PlayerEvents.tick((event) => {
    const { player } = event;
    // 使用 player.age 和可配置的频率进行模运算
    if (player.age % config.checkFrequency === 0) {
        checkPlayerAreaStatus(player);
    }
});
```

#### 状态缓存与边界检测
为避免不必要的操作，脚本采用状态缓存和快速边界检测。

1.  **边界预计算**：当区域被定义时（无论是通过 `setCircularArea` 定义的圆形区域，还是通过 `setAreaPos1`/`setAreaPos2` 定义的矩形区域），脚本会预先计算出区域的 `minX`, `maxX`, `minZ`, `maxZ` 边界。
2.  **快速检测**：在检查玩家位置时，只需将玩家的 X 和 Z 坐标与预计算的边界进行比较，这是一个 O(1) 的高效操作。
3.  **状态缓存**：一个名为 `playerStates` 的全局对象缓存着每个玩家是否在区域内的布尔值。只有当玩家的当前状态与缓存状态不一致时（即玩家穿越了区域边界），脚本才会执行游戏模式切换等核心逻辑，并更新缓存。

```javascript
// playerStates 缓存玩家的当前状态
let playerStates = {}; // { [playerUuid]: boolean }

function checkPlayerAreaStatus(player) {
    // ...
    const isCurrentlyInArea = isPositionInArea(pos.x, pos.z);
    const cachedState = playerStates[player.stringUuid];

    // 仅当状态发生变化时才执行操作
    if (cachedState !== isCurrentlyInArea) {
        if (isCurrentlyInArea) {
            handlePlayerEnterArea(player);
        } else if (cachedState === true) {
            handlePlayerLeaveArea(player);
        }
        // 更新缓存
        playerStates[player.stringUuid] = isCurrentlyInArea;
    }
}
```

### 4.3. 与 `event_register.js` 的交互

`areacontrol.js` 的物品冷却功能是一个可选模块，它依赖于 `event_register.js` 提供的全局事件总线 `eventBus`。

-   **启动时检查**：脚本在初始化时会检查 `global['eventBus']` 是否存在。
-   **功能降级**：如果 `eventBus` 未定义，`enableCooldown` 配置将被强制设为 `false`，并且与冷却相关的功能（包括命令）将不可用。
-   **事件监听**：如果 `eventBus` 存在，脚本会注册 `LivingEntityUseItemEvent$Finish` 事件的监听器。当区域内的玩家完成物品使用时，此监听器会触发并根据 `cooldownSecs` 配置为该物品添加冷却。

这种设计使得 `areacontrol.js` 既可以独立运行（不带物品冷却），也可以与 `event_register.js` 配合使用以提供更丰富的功能，实现了模块间的解耦。
