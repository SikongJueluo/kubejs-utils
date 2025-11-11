# `event_register.js` Script Documentation

## Overview

`event_register.js` provides a simple custom event bus system. It allows for decoupled event listening and firing between different KubeJS script files, leading to cleaner and more modular code organization. This script creates a global `eventBus` object that can be used to register and emit events in any server, client, or startup script.

## Features

-   **Globally Available**: Exposes the event bus to the global scope via `global['eventBus']`, making it easy to call from any KubeJS script.
-   **Simplified Event Handling**: Converts complex native events (like Forge events) into easier-to-manage custom events.
-   **Code Decoupling**: Allows one script to fire an event while one or more other scripts can listen and react, reducing direct dependencies between scripts.
-   **Easy to Extend**: You can easily add listeners for more native events and forward them through the `eventBus`.

## Usage Guide

The core of this script is the `eventBus` object, which has two main methods: `register` and `emit`.

### 1. Registering an Event Listener (`eventBus.register`)

Use this method to listen for a custom event. When the event is fired, the provided callback function will be executed.

-   **Parameters**:
    -   `eventName` (string): The name of the event to listen for.
    -   `callback` (Function): The callback function to execute when the event is fired. It receives an `event` object as its parameter.

**Example**:
Let's say we want to perform an action when a player finishes using an item.

```javascript
// In one of your scripts (e.g., server_scripts/my_script.js)

// Listen for the "LivingEntityUseItemEvent$Finish" event
eventBus.register("LivingEntityUseItemEvent$Finish", event => {
    const { entity, item, level } = event;

    // Check if the entity is a player
    if (entity.isPlayer()) {
        // Print a message to the server log
        console.log(`${entity.name.string} finished using ${item.id}`);

        // Give the player an apple
        entity.give('minecraft:apple');
    }
});
```

### 2. Firing an Event (`eventBus.emit`)

Use this method to fire a custom event. All listeners registered for that event will be called.

-   **Parameters**:
    -   `eventName` (string): The name of the event to fire.
    -   `event` (*): The event data object to pass to the callback functions.

**Built-in Implementation**:
The `event_register.js` script already listens for a native Forge event and forwards it through the `eventBus`.

```javascript
// Internal code in event_register.js

// Listen for the native Forge event for when an item is finished being used
ForgeEvents.onEvent(
    "net.minecraftforge.event.entity.living.LivingEntityUseItemEvent$Finish",
    (event) => {
        // When the native event occurs, fire an event with the same name on the custom event bus
        eventBus.emit("LivingEntityUseItemEvent$Finish", event);
    },
);
```

This implementation means you don't have to listen for that complex Forge event name yourself. You just need to listen for `LivingEntityUseItemEvent$Finish` via `eventBus.register`, as shown in the first example.

### 3. Firing a New Custom Event

You can also use the `eventBus` to create and manage your own custom events for communication between your different script modules.

**Example**:
Suppose one script is responsible for detecting if a player enters a specific area and wants to notify another script to perform a follow-up action.

**Script A: `server_scripts/area_detector.js`**
```javascript
// (Pseudo-code) Assume we have a method to check the player's position
PlayerEvents.tick(event => {
    const { player } = event;
    if (player.x > 100 && player.z > 200 && player.level.dimension == 'minecraft:overworld') {
        // The player has entered the "danger zone", fire a custom event
        eventBus.emit('kubejs:player_entered_danger_zone', { player: player, zone: 'A1' });
    }
});
```

**Script B: `server_scripts/zone_handler.js`**
```javascript
// Listen for the custom event fired by Script A
eventBus.register('kubejs:player_entered_danger_zone', event => {
    const { player, zone } = event;
    player.tell(`You have entered zone ${zone}, be careful!`);
    player.potionEffects.add('minecraft:slowness', 600, 1); // Apply slowness effect
});
```

In this way, `area_detector.js` doesn't need to know about `zone_handler.js`. It is only responsible for sending a signal (the event) under certain conditions. Any other script can choose to listen for this signal and react, achieving modular functionality.
