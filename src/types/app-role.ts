export const APP_ROLE_NAMES = ["admin", "owner", "manager", "staff"] as const;
export type AppRoleName = (typeof APP_ROLE_NAMES)[number];
