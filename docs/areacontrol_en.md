# `areacontrol.js` Script Documentation

## 1. Overview

**AreaControl** is a powerful area management tool for Minecraft servers, implemented via KubeJS. It allows administrators to define a special zone in the game world and apply specific rules to players who enter it, such as automatically switching game modes or restricting item usage.

The core design philosophy of this script is **high performance** and **ease of use**. It employs an event-driven architecture and various optimization techniques to provide stable and reliable functionality without sacrificing server performance. This document will provide a comprehensive guide from installation and usage to technical implementation.

## 2. Features

-   **Automatic Mode Switching**: Automatically switches players to **Adventure** or **Spectator** mode upon entering a specified area, and back to **Survival** mode upon leaving.
-   **Flexible Whitelist**: Administrators can add players to a whitelist via commands, exempting them from game mode changes. OPs are exempt by default, but this is configurable.
-   **Item Cooldown System**: Sets a uniform item usage cooldown for all players within the zone. This feature depends on the `event_register.js` script.
-   **Real-time Toggling**: Administrators can globally enable or disable all features with a single command, without restarting the server.
-   **High-Performance Design**:
    -   **Event-Driven**: Logic is triggered only on player login, logout, or movement, with no unnecessary polling.
    -   **Throttled Checks**: Player position checks are throttled (defaulting to once every 3 seconds) to reduce server load, and the frequency is configurable.
    -   **State Caching**: Core operations are executed only when a player crosses the area boundary, avoiding redundant calculations.
-   **Configuration Persistence**: All settings (like the zone's center, radius, and whitelist) are saved automatically and persist through server restarts.
-   **Rich Management Commands**: Provides a complete set of commands for real-time adjustment of all script parameters.

## 3. User Guide

This section is for server administrators, guiding you on how to install and use AreaControl.

### 3.1. Installation

1.  Ensure your Minecraft server has the KubeJS Mod installed correctly.
2.  Place the `areacontrol.js` script file in the server's `kubejs/server_scripts/` directory.
3.  (Optional) If you need to enable the **Item Cooldown** feature, make sure `event_register.js` is also installed in the `kubejs/startup_scripts/` directory.
4.  Restart the server or run `/kubejs reload server_scripts` in-game.

The script will initialize automatically upon loading.

### 3.2. Management Commands

You can manage the script in-game using the `/areacontrol` command series. All commands require administrator privileges (level 2 or higher).

-   `/areacontrol status`
    -   **Function**: View all current configurations and the running status of the script.

-   `/areacontrol toggle`
    -   **Function**: Globally enable or disable the script. When disabled, all players inside the zone will be returned to Survival mode.

-   `/areacontrol toggleIncludingOPs`
    -   **Function**: Toggle whether to include administrators (OPs) in the game mode management.

-   `/areacontrol toggleCooldown`
    -   **Function**: Enable or disable the item cooldown feature.

-   `/areacontrol setCircularArea <radius>`
    -   **Function**: Set your current position as the center of the zone and define its radius.
    -   **Example**: `/areacontrol setCircularArea 100`

-   `/areacontrol setAreaPos1`
    -   **Function**: Set the first corner of the area to your current position.

-   `/areacontrol setAreaPos2`
    -   **Function**: Set the second corner of the area to your current position, defining a rectangular zone.

-   `/areacontrol setmode <adventure|spectator>`
    -   **Function**: Set the game mode players will be switched to upon entering the zone.
    -   **Example**: `/areacontrol setmode spectator`

-   `/areacontrol setcooldown <ticks>`
    -   **Function**: Set the item cooldown time in game ticks (20 ticks = 1 second).
    -   **Example**: `/areacontrol setcooldown 200` (sets a 10-second cooldown)

-   `/areacontrol setcheckfrequency <ticks>`
    -   **Function**: Set the frequency for checking player positions, in game ticks. A lower value is more responsive but has a higher performance cost.
    -   **Example**: `/areacontrol setcheckfrequency 40` (checks every 2 seconds)

-   `/areacontrol whitelist <add|remove|list> [playerName]`
    -   **Function**: Manage the whitelist. Whitelisted players are not affected by game mode changes.
    -   `add <playerName>`: Add a player to the whitelist.
    -   `remove <playerName>`: Remove a player from the whitelist.
    -   `list`: List all players on the whitelist.

-   `/areacontrol reload`
    -   **Function**: Reload the configuration from storage.

-   `/areacontrol help`
    -   **Function**: Display a list of all available commands in-game.

## 4. Technical Implementation

This section is for developers who want to understand how it works or perform secondary development.

### 4.1. Script and Environment

This project is written in **JavaScript** and uses JSDoc comments for type hinting to enhance code readability and maintainability. No compilation step is required for development.

-   **Source File**: `kubejs/server_scripts/areacontrol.js`
-   **Configuration File**: The script's configuration is stored via KubeJS's persistent data API, typically located at `saves/<world_name>/server_data/areacontrol_config.json`. Manual editing of this file is not recommended.

### 4.2. Core Design

#### Event-Driven Architecture
The script avoids high-cost `tick` polling and instead listens for specific player events to trigger logic.
-   `PlayerEvents.loggedIn`: When a player logs in, their position is checked and their state is initialized.
-   `PlayerEvents.loggedOut`: When a player logs out, their cached data is cleared to prevent memory leaks.
-   `PlayerEvents.tick`: **Used with throttling**. By default, it checks the player's position once every 3 seconds (60 ticks), with an adjustable frequency.

```javascript
// Example: Throttled player position check
PlayerEvents.tick((event) => {
    const { player } = event;
    // Use player.age and configurable frequency for modulo operation
    if (player.age % config.checkFrequency === 0) {
        checkPlayerAreaStatus(player);
    }
});
```

#### State Caching and Boundary Detection
To avoid unnecessary operations, the script uses state caching and fast boundary detection.

1.  **Boundary Pre-calculation**: When the area is defined (either as a circular zone with `setCircularArea` or a rectangular zone with `setAreaPos1`/`setAreaPos2`), the script pre-calculates the area's `minX`, `maxX`, `minZ`, `maxZ` boundaries.
2.  **Fast Detection**: When checking a player's position, it only needs to compare the player's X and Z coordinates with the pre-calculated boundaries, which is an efficient O(1) operation.
3.  **State Caching**: A global object named `playerStates` caches whether each player is inside the area (as a boolean). The core logic, like switching game modes, is executed only when the player's current state differs from the cached state (i.e., the player has crossed the area boundary). The cache is then updated.

```javascript
// playerStates caches the current state of players
let playerStates = {}; // { [playerUuid]: boolean }

function checkPlayerAreaStatus(player) {
    // ...
    const isCurrentlyInArea = isPositionInArea(pos.x, pos.z);
    const cachedState = playerStates[player.stringUuid];

    // Only perform actions when the state changes
    if (cachedState !== isCurrentlyInArea) {
        if (isCurrentlyInArea) {
            handlePlayerEnterArea(player);
        } else if (cachedState === true) {
            handlePlayerLeaveArea(player);
        }
        // Update the cache
        playerStates[player.stringUuid] = isCurrentlyInArea;
    }
}
```

### 4.3. Interaction with `event_register.js`

The item cooldown feature of `areacontrol.js` is an optional module that relies on the global event bus `eventBus` provided by `event_register.js`.

-   **Check on Startup**: The script checks if `global['eventBus']` exists during initialization.
-   **Graceful Degradation**: If `eventBus` is not defined, the `enableCooldown` setting is forcibly set to `false`, and all cooldown-related features (including commands) become unavailable.
-   **Event Listening**: If `eventBus` exists, the script registers a listener for the `LivingEntityUseItemEvent$Finish` event. When a player in the area finishes using an item, this listener is triggered and adds a cooldown to the item based on the `cooldownSecs` configuration.

This design allows `areacontrol.js` to run standalone (without item cooldowns) or in conjunction with `event_register.js` to provide richer functionality, achieving decoupling between modules.
