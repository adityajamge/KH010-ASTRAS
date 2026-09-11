export const ROLES = {
  FARMER: "farmer",
  JAL_VIGYANI: "jal_vigyani",
  DAM_OPERATOR: "dam_operator",
} as const;

export type AppRole = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: AppRole[] = [
  ROLES.FARMER,
  ROLES.JAL_VIGYANI,
  ROLES.DAM_OPERATOR,
];

/** Dashboard home path for a role. Unknown roles fall back to role picker. */
export function roleHome(role: unknown): string {
  switch (role) {
    case ROLES.FARMER:
      return "/app/farmer";
    case ROLES.JAL_VIGYANI:
      return "/app/jal-vigyani";
    case ROLES.DAM_OPERATOR:
      return "/app/dam";
    default:
      return "/app";
  }
}

/** Roles are assigned in the Clerk dashboard via publicMetadata: {"role": "<one of AppRole>"}. */
export function isAppRole(value: unknown): value is AppRole {
  return (
    value === ROLES.FARMER ||
    value === ROLES.JAL_VIGYANI ||
    value === ROLES.DAM_OPERATOR
  );
}
