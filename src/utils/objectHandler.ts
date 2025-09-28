export function areObjectsEqual(objA: object, objB: object): boolean {
    return JSON.stringify(objA) === JSON.stringify(objB);
}
