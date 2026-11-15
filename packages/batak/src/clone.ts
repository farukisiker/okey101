/** Deep copy for plain JSON data. Hermes may lack structuredClone, so the engine never uses it. */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
