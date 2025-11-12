# KubeJS Utils

**English** | [简体中文](README_zh.md)

This is a collection of utility scripts for KubeJS in Minecraft, designed to provide powerful and efficient tools for server administrators and modpack creators.

## Scripts

### `areacontrol.js`

A powerful area management script that allows administrators to define a special zone and apply rules to players who enter it.

- **Key Features**:
    - Automatically switches the game mode (e.g., from Survival to Adventure/Spectator) when a player enters/leaves the defined area.
    - Configurable whitelist to exempt certain players (like OPs) from the rules.
    - Sets a uniform item usage cooldown for all players within the zone.
    - Provides a rich set of in-game commands to configure the zone's boundaries, target game mode, and more in real-time.
- **Design Philosophy**:
    - **High Performance**: Built with an event-driven architecture and a throttled checking mechanism to minimize impact on server performance.
    - **Persistence**: All configurations are saved automatically and persist through server restarts.

For detailed usage, please refer to the [areacontrol.js documentation](docs/areacontrol_en.md).

### `event_register.js`

A lightweight custom event bus system designed for KubeJS. It creates a global `eventBus` object, allowing for decoupled event listening and firing between different script files.

- **Key Features**:
    - **Decoupling**: Allows one script to trigger an event while other scripts can listen and react, reducing direct dependencies.
    - **Simplified Event Handling**: Converts complex native Forge events into easy-to-manage custom events.
    - **Global Availability**: The `eventBus` is accessible from any server, client, or startup script.

The item cooldown feature of `areacontrol.js` relies on this script. For detailed usage, please refer to the [event_register.js documentation](docs/event_register_en.md).

## License

This project is licensed under the [MIT License](LICENSE).
