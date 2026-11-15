/**
 * Deep copy for plain JSON data (state, views). Hermes may lack the global structured-clone API,
 * so the engine never relies on it. Optional fields that are undefined are dropped.
 */
export function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}
