let isFirstTime = true;
ClientEvents.tick((event) => {
    if (!isFirstTime) return;

    const player = event.player;
    const lookAngle = player.lookAngle;
    console.log(`Player Pos: ${player.x}, ${player.y}, ${player.z}`);
    // console.log(
    //     `LookAngle(property): ${lookAngle.x}, ${lookAngle.y}, ${lookAngle.z}`,
    // );
    console.log(
        `LookAngle(method): ${lookAngle.x()}, ${lookAngle.y()}, ${lookAngle.z()}`,
    );
    console.log(
        `LookAngle(get method): ${lookAngle.get("x")}, ${lookAngle.get("y")}, ${lookAngle.get("z")}`,
    );
    isFirstTime = false;
});
