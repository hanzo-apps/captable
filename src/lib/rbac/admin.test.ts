import { describe, expect, it } from "vitest";
import {
  LAST_ADMIN,
  ONLY_ADMIN_TOUCHES_ADMIN,
  ONLY_ADMIN_WRITES_ROLES,
  type Seat,
  memberChangeRefusal,
  roleWriteRefusal,
} from "./admin";

const admin = { role: "ADMIN" as const };
const custom = { role: "CUSTOM" as const };
const adminSeat: Seat = { role: "ADMIN", customRoleId: null, status: "ACTIVE" };
const customSeat: Seat = {
  role: "CUSTOM",
  customRoleId: "r1",
  status: "ACTIVE",
};
const toCustom = (id: string) => ({
  role: { role: "CUSTOM" as const, customRoleId: id },
});
const toAdmin = { role: { role: "ADMIN" as const, customRoleId: null } };

describe("roleWriteRefusal", () => {
  it("lets only an admin write a role", () => {
    expect(roleWriteRefusal(admin)).toBeNull();
    expect(roleWriteRefusal(custom)).toBe(ONLY_ADMIN_WRITES_ROLES);
    expect(roleWriteRefusal({ role: null })).toBe(ONLY_ADMIN_WRITES_ROLES);
  });
});

describe("memberChangeRefusal", () => {
  const refuse = (
    caller: { role: "ADMIN" | "CUSTOM" | null },
    target: Seat,
    change: Parameters<typeof memberChangeRefusal>[0]["change"],
    activeAdmins = 2,
  ) => memberChangeRefusal({ caller, target, change, activeAdmins });

  it("refuses a non-admin any role change, their own included", () => {
    expect(refuse(custom, customSeat, toCustom("r2"))).toBe(
      ONLY_ADMIN_WRITES_ROLES,
    );
    expect(refuse(custom, customSeat, toAdmin)).toBe(ONLY_ADMIN_WRITES_ROLES);
    expect(
      refuse(
        custom,
        { ...customSeat, role: null, customRoleId: null },
        toCustom("r1"),
      ),
    ).toBe(ONLY_ADMIN_WRITES_ROLES);
  });

  it("lets a non-admin change what is not a role", () => {
    expect(refuse(custom, customSeat, {})).toBeNull();
    expect(refuse(custom, customSeat, toCustom("r1"))).toBeNull();
    expect(refuse(custom, customSeat, { status: "INACTIVE" })).toBeNull();
    expect(refuse(custom, customSeat, { remove: true })).toBeNull();
  });

  it("refuses a non-admin anything done to an admin", () => {
    for (const change of [
      {},
      { status: "INACTIVE" as const },
      { remove: true as const },
    ]) {
      expect(refuse(custom, adminSeat, change)).toBe(ONLY_ADMIN_TOUCHES_ADMIN);
    }
  });

  it("lets an admin change roles and admins", () => {
    expect(refuse(admin, customSeat, toAdmin)).toBeNull();
    expect(refuse(admin, adminSeat, toCustom("r1"))).toBeNull();
    expect(refuse(admin, adminSeat, { remove: true })).toBeNull();
  });

  it("keeps the last active admin", () => {
    expect(refuse(admin, adminSeat, { remove: true }, 1)).toBe(LAST_ADMIN);
    expect(refuse(admin, adminSeat, { status: "INACTIVE" }, 1)).toBe(
      LAST_ADMIN,
    );
    expect(refuse(admin, adminSeat, toCustom("r1"), 1)).toBe(LAST_ADMIN);
    expect(refuse(admin, adminSeat, toAdmin, 1)).toBeNull();
    expect(refuse(admin, adminSeat, { status: "ACTIVE" }, 1)).toBeNull();
  });

  it("does not count a pending admin invitation as the last admin", () => {
    expect(
      refuse(admin, { ...adminSeat, status: "PENDING" }, { remove: true }, 1),
    ).toBeNull();
  });
});
