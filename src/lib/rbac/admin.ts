// Who may change whose role. A role is authority, so only an ADMIN writes one —
// a custom role's permissions or a member's role — and only an ADMIN acts on an
// ADMIN. A company always keeps one ACTIVE ADMIN.

export type Role = "ADMIN" | "CUSTOM" | null;
export type Status = "ACTIVE" | "INACTIVE" | "PENDING";

/** A member as a change sees it. */
export interface Seat {
  role: Role;
  customRoleId: string | null;
  status: Status;
}

/** What a change does to a member: removes them, or sets a role or a status. */
export type Change =
  | { remove: true }
  | {
      remove?: false;
      role?: { role: Role; customRoleId: string | null };
      status?: Status;
    };

export const ONLY_ADMIN_WRITES_ROLES = "Only an admin can change a role.";
export const ONLY_ADMIN_TOUCHES_ADMIN = "Only an admin can change an admin.";
export const LAST_ADMIN =
  "This is the company's last admin. Make another member an admin first.";

/** Why the caller may not write a role at all, or null when they may. */
export const roleWriteRefusal = (caller: { role: Role }): string | null =>
  caller.role === "ADMIN" ? null : ONLY_ADMIN_WRITES_ROLES;

/**
 * Why `caller` may not make `change` to `target`, or null when they may.
 * `activeAdmins` counts the company's ACTIVE ADMINs, the target included.
 */
export const memberChangeRefusal = ({
  caller,
  target,
  change,
  activeAdmins,
}: {
  caller: { role: Role };
  target: Seat;
  change: Change;
  activeAdmins: number;
}): string | null => {
  const admin = caller.role === "ADMIN";
  const next = change.remove ? undefined : change;

  if (target.role === "ADMIN" && !admin) return ONLY_ADMIN_TOUCHES_ADMIN;

  const roleChanges =
    !!next?.role &&
    (next.role.role !== target.role ||
      next.role.customRoleId !== target.customRoleId);
  if (roleChanges && !admin) return ONLY_ADMIN_WRITES_ROLES;

  const losesAdmin =
    target.role === "ADMIN" &&
    target.status === "ACTIVE" &&
    (change.remove === true ||
      (roleChanges && next?.role?.role !== "ADMIN") ||
      (next?.status !== undefined && next.status !== "ACTIVE"));
  if (losesAdmin && activeAdmins <= 1) return LAST_ADMIN;

  return null;
};
