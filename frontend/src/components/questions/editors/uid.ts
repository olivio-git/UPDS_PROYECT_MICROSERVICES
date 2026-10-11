/** Short unique id for options and items created in the editor. */
export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
