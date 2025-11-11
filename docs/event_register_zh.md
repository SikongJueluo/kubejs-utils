# `event_register.js` 脚本说明

## 概述

`event_register.js` 提供了一个简单的自定义事件总线（Event Bus）系统。它允许在 KubeJS 的不同脚本文件之间解耦事件的监听和触发，使得代码组织更加清晰和模块化。该脚本创建了一个全局变量 `eventBus`，可用于在任何服务器、客户端或启动脚本中注册和触发事件。

## 特点

- **全局可用**: 通过 `global['eventBus']` 将事件总线暴露到全局，方便在任何 KubeJS 脚本中调用。
- **简化事件处理**: 将复杂的原生事件（如 Forge 事件）转换为更易于管理和使用的自定义事件。
- **代码解耦**: 允许一个脚本触发事件，而另一个或多个脚本监听并响应这些事件，降低了脚本之间的直接依赖。
- **易于扩展**: 可以轻松添加对更多原生事件的监听，并将它们通过 `eventBus` 进行转发。

## 使用说明

该脚本的核心是 `eventBus` 对象，它有两个主要方法：`register` 和 `emit`。

### 1. 注册事件监听器 (`eventBus.register`)

使用此方法来监听一个自定义事件。当该事件被触发时，提供的回调函数将被执行。

- **参数**:
    - `eventName` (string): 要监听的事件名称。
    - `callback` (Function): 事件触发时要执行的回调函数，它会接收到一个 `event` 对象作为参数。

**示例**:
假设我们想在玩家完成使用物品时执行某些操作。

```javascript
// 在你的某个脚本中 (例如: server_scripts/my_script.js)

// 监听 "LivingEntityUseItemEvent$Finish" 事件
eventBus.register("LivingEntityUseItemEvent$Finish", event => {
    const { entity, item, level } = event;

    // 检查实体是否为玩家
    if (entity.isPlayer()) {
        // 在服务器日志中打印消息
        console.log(`${entity.name.string} 使用完成了 ${item.id}`);

        // 给予玩家一个苹果
        entity.give('minecraft:apple');
    }
});
```

### 2. 触发事件 (`eventBus.emit`)

使用此方法来触发一个自定义事件。所有注册了该事件的监听器都将被调用。

- **参数**:
    - `eventName` (string): 要触发的事件名称。
    - `event` (*): 要传递给回调函数的事件数据对象。

**脚本内置实现**:
`event_register.js` 脚本内部已经监听了一个原生的 Forge 事件，并在该事件发生时通过 `eventBus` 进行了转发。

```javascript
// event_register.js 内部代码

// 监听原生的 Forge 物品使用完成事件
ForgeEvents.onEvent(
    "net.minecraftforge.event.entity.living.LivingEntityUseItemEvent$Finish",
    (event) => {
        // 当原生事件发生时，通过自定义事件总线触发同名事件
        eventBus.emit("LivingEntityUseItemEvent$Finish", event);
    },
);
```

这个实现意味着你无需自己去监听那个复杂的 Forge 事件名称。你只需要通过 `eventBus.register` 监听 `LivingEntityUseItemEvent$Finish` 即可，如第一个示例所示。

### 3. 触发一个全新的自定义事件

你也可以利用 `eventBus` 来创建和管理完全由你定义的事件，用于在你的不同脚本模块之间通信。

**示例**:
假设一个脚本负责检测玩家是否进入了特定区域，并希望通知另一个脚本来执行后续操作。

**脚本 A: `server_scripts/area_detector.js`**
```javascript
// (伪代码) 假设我们有一个方法来检测玩家位置
PlayerEvents.tick(event => {
    const { player } = event;
    if (player.x > 100 && player.z > 200 && player.level.dimension == 'minecraft:overworld') {
        // 玩家进入了 "危险区域"，触发一个自定义事件
        eventBus.emit('kubejs:player_entered_danger_zone', { player: player, zone: 'A1' });
    }
});
```

**脚本 B: `server_scripts/zone_handler.js`**
```javascript
// 监听由脚本 A 触发的自定义事件
eventBus.register('kubejs:player_entered_danger_zone', event => {
    const { player, zone } = event;
    player.tell(`你已进入区域 ${zone}，请小心！`);
    player.potionEffects.add('minecraft:slowness', 600, 1); // 给予缓慢效果
});
```

通过这种方式，`area_detector.js` 无需知道 `zone_handler.js` 的存在，它只负责在特定条件下发出一个信号（事件）。任何其他脚本都可以选择监听这个信号并做出响应，实现了功能的模块化。
