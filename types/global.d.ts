export {}; // Mark the file as a module, do not remove unless there are other import/exports!
// Override the global type
declare global {
    export type ProbeJS$$ResolvedGlobal = {
        eventBus: EventBus;
        toExplosionC4Map: { [key: string]: boolean };
    };
}
