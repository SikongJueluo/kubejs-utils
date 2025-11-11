# AreaControl 脚本 MDocs

## 1. 概述

**AreaControl** 是一个为 Minecraft 服务器设计的强大区域管理工具，通过 KubeJS 实现。它允许管理员在游戏世界中定义一个特殊区域，并对进入该区域的玩家施加特定的规则，例如自动切换游戏模式、限制物品使用等。

该脚本的核心设计理念是 **高性能** 与 **易用性**。它采用事件驱动和多种优化技术，确保在不牺牲服务器性能的前提下，提供稳定可靠的功能。本文档将为您提供从安装、使用到二次开发的全方位指南。

---

## 2. 功能特性

- **自动模式切换**：玩家进入指定区域时，自动切换为**冒险**或**旁观**模式；离开时恢复为**生存**模式。
- **动态白名单**：所有功能仅对白名单内的玩家生效，管理员可通过命令随时增删玩家。
- **物品冷却系统**：可以为区域内的玩家设置统一的物品使用冷却时间。
- **实时启/禁用**：管理员可通过一条简单命令，在不重启服务器的情况下，全局启用或禁用所有功能。
- **二维平面检测**：区域检测仅基于水平坐标（X 和 Z 轴），忽略玩家的高度（Y 轴），适用于各种地形。
- **高性能设计**：基于事件驱动，无不必要的循环（tick-polling），确保对服务器的性能影响降至最低。
- **配置持久化**：所有配置（如区域中心、半径、白名单）都会自动保存，服务器重启后无需重新设置。

---

## 3. 用户指南

本节面向服务器管理员和普通用户，指导您如何安装和使用 AreaControl。

### 3.1. 安装

1.  确保您的 Minecraft 服务器已经正确安装了 KubeJS Mod。
2.  将编译后的 `areacontrol.js` 脚本文件放置在服务器的 `kubejs/server_scripts/` 目录下。
3.  重新启动服务器或在游戏内执行 `/kubejs reload server_scripts`。

脚本加载后将自动初始化，默认在世界中心 `(0, 0)` 创建一个半径为 `50` 格的区域。

### 3.2. 管理命令

您可以在游戏内通过 `areacontrol` 系列命令来管理脚本。所有命令都需要管理员权限。

*   `/areacontrol status`：查看脚本当前配置。
*   `/areacontrol toggle`：全局启用或禁用功能。
*   `/areacontrol setcenter`：将当前位置设为区域中心。
*   `/areacontrol setradius <半径>`：设置区域半径。
*   `/areacontrol whitelist <add|remove|list> [玩家名]`：管理白名单。

---

## 4. 开发者参考：技术与定制

本节面向希望理解其工作原理或进行二次开发的开发者。

### 4.1. 开发环境与构建

本项目使用 **TypeScript** 编写，以获得更强的类型安全和代码可维护性。

-   **源码目录**：所有服务器端脚本的 TypeScript 源文件位于 `src/server_scripts/` 目录下。
-   **编译**：在发布或测试前，需要将 TypeScript (`.ts`) 文件编译为 KubeJS 可识别的 JavaScript (`.js`) 文件。
    -   **单次编译**：执行 `npm run tsc` 或 `npx tsc --project tsconfig.server.json`。
    -   **监视模式**：在开发过程中，建议使用监视模式，它会在文件发生变化时自动重新编译。执行 `npm run watch::server` 即可。
-   **类型定义**：项目依赖于 KubeJS Probe 生成的类型定义，位于 `types/probe-types/` 目录，这为开发提供了完整的代码提示和类型检查。

### 4.2. 设计理念

#### 事件驱动架构
脚本不使用高开销的 `tick` 轮询，而是监听特定玩家事件来触发逻辑。
-   `PlayerEvents.loggedIn`: 玩家登录时加入检查。
-   `PlayerEvents.loggedOut`: 玩家登出时清理其缓存数据。
-   `PlayerEvents.tick`: **降频使用**，每秒检查一次玩家位置。
-   `ItemEvents.use`: 在玩家使用物品时触发冷却逻辑。

```typescript
// 示例：利用类型定义，精确捕获事件和玩家对象
ItemEvents.use((event: Internal.ItemUseEvent) => {
    const { player } = event;
    if (player && shouldApplyCooldown(player)) {
        // ...
    }
});
```

#### 分层与状态缓存
为避免不必要的操作，脚本采用分层检查和状态缓存。

1.  **一级过滤**：检查脚本是否启用、玩家是否在白名单内。
2.  **二级检查（降频）**：每秒检查一次玩家是否在区域内。
3.  **三级处理（状态驱动）**：仅当玩家**跨越区域边界**时，才执行核心操作并更新缓存。

```typescript
// playerStates 缓存玩家的当前状态，并提供类型安全
const playerStates = new Map<string, { inArea: boolean }>();

function optimizedPlayerCheck(player: Internal.Player): void {
    const currentState = playerStates.get(player.uuid) ?? { inArea: false };
    const isInArea = isPlayerInArea(player);

    if (currentState.inArea !== isInArea) {
        handleGameModeChange(player, isInArea);
        playerStates.set(player.uuid, { inArea: isInArea });
    }
}
```

### 4.3. 核心算法

#### 快速边界检测
脚本通过**预计算**区域的边界框（Bounding Box）来实现高效的位置判断。

```typescript
// 1. 初始化时预计算边界
function updateBounds(center: Internal.Vec3i, radius: number): void {
    bounds.minX = center.x - radius;
    bounds.maxX = center.x + radius;
    bounds.minZ = center.z - radius;
    bounds.maxZ = center.z + radius;
}

// 2. 运行时进行高效比较
function isPlayerInArea(player: Internal.Player): boolean {
    const pos = player.blockPosition();
    return pos.x >= bounds.minX && pos.x <= bounds.maxX &&
           pos.z >= bounds.minZ && pos.z <= bounds.maxZ;
}
```

#### 内存自动清理
通过监听 `PlayerEvents.loggedOut` 事件，自动从 `playerStates` 缓存中删除下线玩家的数据，防止内存泄漏。

### 4.4. 数据结构

我们使用 TypeScript 的 `interface` 来定义核心数据结构，确保类型安全。

#### 配置 (AreaControlConfig)
```typescript
interface AreaControlConfig {
    enabled: boolean;
    center: { x: number; y: number; z: number };
    radius: number;
    whitelist: string[];
    mode: 'adventure' | 'spectator';
    cooldownTime: number; // In ticks
}
```

#### 缓存 (PlayerState)
```typescript
interface PlayerState {
    inArea: boolean;
}

// 最终的缓存结构
const playerStates: Map<string, PlayerState>; // Key: Player UUID
```

### 4.5. 定制化

#### 调整检查频率
默认检查频率是每秒一次（`20 ticks`）。您可以根据服务器需求调整此值。

```typescript
// 在 PlayerEvents.tick 监听器中调整
PlayerEvents.tick((event: Internal.PlayerTickEvent) => {
    const player = event.player;
    // 将 20 修改为您希望的检查间隔（ticks）
    if (player.age % 20 === 0) {
        optimizedPlayerCheck(player);
    }
});
```
-   **建议值**：`10`（半秒一次，响应快），`40`（两秒一次，开销低）。不建议低于 `10`。
