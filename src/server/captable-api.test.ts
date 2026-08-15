import { describe, expect, it } from "vitest";
import {
  CaptableApiError,
  type Share,
  captableFailure,
  date,
  normalizeConvertible,
  normalizeEquityPlan,
  normalizeOption,
  normalizeSafe,
  normalizeShare,
  normalizeShareClass,
  normalizeStakeholder,
  normalizeSummary,
  rows,
} from "./captable-api";

/**
 * The backend is another team's service reached over HTTP, so every shape here
 * is a claim rather than a guarantee. These pin the two properties that matter:
 * a documented payload survives intact, and an undocumented one degrades to an
 * honest empty value instead of throwing inside a React render.
 */

const GARBAGE: unknown[] = [
  undefined,
  null,
  "",
  0,
  false,
  "not json",
  [],
  {},
  { data: null },
  { data: "nope" },
  [null, 1, "x"],
  { totals: "nope", byStakeholder: {} },
];

describe("rows", () => {
  it("unwraps a bare array (stakeholders, classes)", () => {
    expect(rows([{ id: "a" }, { id: "b" }])).toEqual([
      { id: "a" },
      { id: "b" },
    ]);
  });

  it("unwraps the { data } envelope (shares, options, safes, rounds)", () => {
    expect(rows({ data: [{ id: "a" }] })).toEqual([{ id: "a" }]);
  });

  it("unwraps items and rows envelopes", () => {
    expect(rows({ items: [{ id: "a" }] })).toEqual([{ id: "a" }]);
    expect(rows({ rows: [{ id: "a" }] })).toEqual([{ id: "a" }]);
  });

  it("drops entries that are not objects rather than passing them on", () => {
    expect(rows([{ id: "a" }, null, 7, "x", ["nested"]])).toEqual([
      { id: "a" },
    ]);
  });

  it("answers an empty list for anything it does not recognise", () => {
    for (const payload of GARBAGE) expect(rows(payload)).toEqual([]);
  });
});

describe("date", () => {
  it("reads an ISO date and an ISO datetime", () => {
    expect(date("2024-03-01")?.toISOString()).toBe("2024-03-01T00:00:00.000Z");
    expect(date("2024-03-01T12:30:00.000Z")?.toISOString()).toBe(
      "2024-03-01T12:30:00.000Z",
    );
  });

  it("is null when absent or unparseable — never an Invalid Date", () => {
    for (const v of [undefined, null, "", "not a date", {}, []]) {
      expect(date(v)).toBeNull();
    }
  });
});

describe("normalizeStakeholder", () => {
  it("reads the documented camelCase row", () => {
    expect(
      normalizeStakeholder({
        id: "st_1",
        name: "Ada Lovelace",
        email: "ada@example.com",
        institutionName: "Analytical Engines",
        stakeholderType: "INSTITUTION",
        currentRelationship: "INVESTOR",
        taxId: "12-345",
        streetAddress: "1 Byron St",
        city: "London",
        state: "LDN",
        zipcode: "N1",
        country: "GB",
        createdAt: "2024-03-01T00:00:00.000Z",
      }),
    ).toMatchObject({
      id: "st_1",
      name: "Ada Lovelace",
      institutionName: "Analytical Engines",
      stakeholderType: "INSTITUTION",
      currentRelationship: "INVESTOR",
      country: "GB",
    });
  });

  it("reads the same row in snake_case", () => {
    const r = normalizeStakeholder({
      id: "st_1",
      institution_name: "Analytical Engines",
      stakeholder_type: "INSTITUTION",
      current_relationship: "INVESTOR",
      street_address: "1 Byron St",
      tax_id: "12-345",
      created_at: "2024-03-01T00:00:00.000Z",
    });
    expect(r.institutionName).toBe("Analytical Engines");
    expect(r.stakeholderType).toBe("INSTITUTION");
    expect(r.currentRelationship).toBe("INVESTOR");
    expect(r.streetAddress).toBe("1 Byron St");
    expect(r.taxId).toBe("12-345");
    expect(r.createdAt).toBeInstanceOf(Date);
  });

  it("carries the joined company name the pickers label with", () => {
    expect(normalizeStakeholder({ companyName: "Acme" }).companyName).toBe(
      "Acme",
    );
    expect(normalizeStakeholder({ company_name: "Acme" }).companyName).toBe(
      "Acme",
    );
  });

  it("falls back to the vocabulary default when the wire word is not one", () => {
    const r = normalizeStakeholder({
      stakeholderType: "PARTNERSHIP",
      currentRelationship: "CHAIRMAN",
    });
    expect(r.stakeholderType).toBe("INDIVIDUAL");
    expect(r.currentRelationship).toBe("EMPLOYEE");
  });

  it("degrades an empty row to empty strings and nulls", () => {
    const r = normalizeStakeholder({});
    expect(r).toEqual({
      id: "",
      name: "",
      email: "",
      institutionName: "",
      stakeholderType: "INDIVIDUAL",
      currentRelationship: "EMPLOYEE",
      taxId: "",
      streetAddress: "",
      city: "",
      state: "",
      zipcode: "",
      country: "US",
      companyName: "",
      createdAt: null,
      updatedAt: null,
    });
  });
});

describe("normalizeShareClass", () => {
  it("reads the documented row in both spellings", () => {
    const camel = normalizeShareClass({
      id: "sc_1",
      idx: 1,
      name: "Common",
      classType: "COMMON",
      initialSharesAuthorized: 10_000_000,
      votesPerShare: 1,
      parValue: 0.0001,
      pricePerShare: 1.25,
      conversionRights: "CONVERTS_TO_FUTURE_ROUND",
      liquidationPreferenceMultiple: 1,
      participationCapMultiple: 0,
      boardApprovalDate: "2024-01-01",
    });
    expect(camel.initialSharesAuthorized).toBe(10_000_000);
    expect(camel.pricePerShare).toBe(1.25);
    expect(camel.boardApprovalDate).toBeInstanceOf(Date);

    const snake = normalizeShareClass({
      initial_shares_authorized: 10_000_000,
      class_type: "PREFERRED",
      price_per_share: 1.25,
      converts_to_share_class_id: "sc_0",
      liquidation_preference_multiple: 2,
    });
    expect(snake.initialSharesAuthorized).toBe(10_000_000);
    expect(snake.classType).toBe("PREFERRED");
    expect(snake.convertsToShareClassId).toBe("sc_0");
    expect(snake.liquidationPreferenceMultiple).toBe(2);
  });

  it("does not turn an absent number into NaN", () => {
    const r = normalizeShareClass({ initialSharesAuthorized: "not a number" });
    expect(r.initialSharesAuthorized).toBe(0);
    expect(Number.isNaN(r.initialSharesAuthorized)).toBe(false);
  });

  it("keeps an unset conversion target null rather than an empty string", () => {
    expect(normalizeShareClass({}).convertsToShareClassId).toBeNull();
  });

  it("carries the joined company name", () => {
    expect(normalizeShareClass({ companyName: "Acme" }).companyName).toBe(
      "Acme",
    );
  });

  it("is null for the approval dates the list route does not select", () => {
    // listShareClasses selects neither; the UI must show absent, not 1970.
    const r = normalizeShareClass({ id: "sc_1", name: "Common" });
    expect(r.boardApprovalDate).toBeNull();
    expect(r.stockholderApprovalDate).toBeNull();
  });
});

describe("normalizeShare", () => {
  it("reads the documented row and splits out the joined names", () => {
    const r = normalizeShare({
      id: "sh_1",
      certificateId: "CS-1",
      quantity: 1000,
      pricePerShare: 0.5,
      capitalContribution: 500,
      status: "ACTIVE",
      issueDate: "2024-02-02",
      stakeholderName: "Ada Lovelace",
      stakeholderId: "st_1",
      shareClassName: "Common",
      shareClassType: "COMMON",
      shareClassId: "sc_1",
    });
    expect(r).toMatchObject({
      certificateId: "CS-1",
      quantity: 1000,
      stakeholderName: "Ada Lovelace",
      shareClassType: "COMMON",
      status: "ACTIVE",
    });
    expect(r.issueDate).toBeInstanceOf(Date);
  });

  it("distinguishes a money field the backend omits from one it reports as 0", () => {
    // The columns are nullable, so "not reported" must not read as "zero".
    expect(normalizeShare({}).capitalContribution).toBeNull();
    expect(normalizeShare({ capitalContribution: 0 }).capitalContribution).toBe(
      0,
    );
  });

  it("always answers an array for companyLegends", () => {
    expect(normalizeShare({}).companyLegends).toEqual([]);
    expect(
      normalizeShare({ companyLegends: "US_SECURITIES_ACT" }).companyLegends,
    ).toEqual([]);
    expect(
      normalizeShare({ company_legends: ["US_SECURITIES_ACT"] }).companyLegends,
    ).toEqual(["US_SECURITIES_ACT"]);
  });

  it("degrades an empty row without throwing", () => {
    const r: Share = normalizeShare({});
    expect(r.id).toBe("");
    expect(r.status).toBe("DRAFT");
    expect(r.quantity).toBe(0);
    expect(r.issueDate).toBeNull();
  });
});

describe("normalizeOption, normalizeSafe, normalizeConvertible, normalizeEquityPlan", () => {
  it("reads the documented rows", () => {
    expect(
      normalizeOption({
        id: "op_1",
        grantId: "GR-1",
        quantity: 500,
        exercisePrice: 0.1,
        type: "ISO",
        status: "ACTIVE",
        stakeholderName: "Ada",
        equityPlanName: "2024 Plan",
      }),
    ).toMatchObject({
      grantId: "GR-1",
      quantity: 500,
      equityPlanName: "2024 Plan",
    });

    expect(
      normalizeSafe({
        id: "sa_1",
        publicId: "SAFE-01",
        type: "POST_MONEY",
        capital: 100_000,
        valuationCap: 5_000_000,
        mfn: true,
        pro_rata: "true",
        stakeholder_name: "Ada",
      }),
    ).toMatchObject({
      publicId: "SAFE-01",
      capital: 100_000,
      valuationCap: 5_000_000,
      mfn: true,
      proRata: true,
      stakeholderName: "Ada",
    });

    expect(
      normalizeConvertible({
        id: "cn_1",
        public_id: "CN-01",
        type: "NOTE",
        capital: 250_000,
        conversion_cap: 8_000_000,
        interest_rate: 5,
      }),
    ).toMatchObject({
      publicId: "CN-01",
      capital: 250_000,
      conversionCap: 8_000_000,
      interestRate: 5,
    });

    expect(
      normalizeEquityPlan({
        id: "ep_1",
        name: "2024 Plan",
        initial_shares_reserved: 1_000_000,
        share_class_id: "sc_1",
      }),
    ).toMatchObject({
      name: "2024 Plan",
      initialSharesReserved: 1_000_000,
      shareClassId: "sc_1",
    });
  });

  it("degrades every empty row to its documented default", () => {
    expect(normalizeOption({}).type).toBe("ISO");
    expect(normalizeOption({}).status).toBe("DRAFT");
    expect(normalizeSafe({}).type).toBe("POST_MONEY");
    expect(normalizeSafe({}).mfn).toBe(false);
    expect(normalizeSafe({}).valuationCap).toBeNull();
    expect(normalizeConvertible({}).type).toBe("NOTE");
    expect(normalizeEquityPlan({}).comments).toBeNull();
  });
});

describe("normalizeSummary", () => {
  it("reads the computed cap table the backend publishes", () => {
    const summary = normalizeSummary({
      company: { id: "co_1", name: "Acme" },
      totals: {
        outstandingShares: 10_000,
        grantedOptions: 2_000,
        fullyDilutedShares: 12_000,
        stakeholders: 3,
        shareClasses: 2,
      },
      byStakeholder: [
        {
          stakeholderId: "st_1",
          name: "Ada",
          shares: 6_000,
          options: 0,
          fullyDiluted: 6_000,
          ownershipPct: 50,
        },
      ],
      byShareClass: [
        {
          shareClassId: "sc_1",
          name: "Common",
          classType: "COMMON",
          authorized: 20_000,
          issued: 10_000,
        },
      ],
      convertibles: {
        safes: { count: 2, capital: 300_000 },
        notes: { count: 1, capital: 250_000 },
      },
      rounds: { count: 1, totalRaised: 550_000 },
    });

    expect(summary.totals.fullyDilutedShares).toBe(12_000);
    expect(summary.byStakeholder).toHaveLength(1);
    expect(summary.byStakeholder[0]?.ownershipPct).toBe(50);
    expect(summary.byShareClass[0]?.authorized).toBe(20_000);
    expect(summary.convertibles.safes.capital).toBe(300_000);
    expect(summary.rounds.totalRaised).toBe(550_000);
  });

  it("answers a zeroed cap table for any payload it cannot read", () => {
    for (const payload of GARBAGE) {
      const s = normalizeSummary(payload);
      expect(s.totals.fullyDilutedShares).toBe(0);
      expect(s.byStakeholder).toEqual([]);
      expect(s.byShareClass).toEqual([]);
      expect(s.convertibles.notes.capital).toBe(0);
      expect(s.rounds.count).toBe(0);
      expect(s.company.name).toBe("");
    }
  });

  it("keeps the rows it can read when a neighbouring one is malformed", () => {
    const s = normalizeSummary({
      totals: { outstandingShares: 10 },
      byStakeholder: [null, { name: "Ada", fullyDiluted: 5 }, "x"],
    });
    expect(s.totals.outstandingShares).toBe(10);
    expect(s.totals.grantedOptions).toBe(0);
    expect(s.byStakeholder).toHaveLength(3);
    expect(s.byStakeholder[1]).toMatchObject({ name: "Ada", fullyDiluted: 5 });
    expect(s.byStakeholder[0]).toMatchObject({ name: "", fullyDiluted: 0 });
  });
});

describe("captableFailure", () => {
  it("names the session when the backend refused the principal", () => {
    for (const status of [401, 403]) {
      expect(
        captableFailure(new CaptableApiError(status, "forbidden")),
      ).toMatch(/Sign in again/);
    }
  });

  it("passes the backend's own reason through for anything else", () => {
    expect(
      captableFailure(new CaptableApiError(400, "certificateId already taken")),
    ).toBe("certificateId already taken");
  });

  it("does not leak an unexpected error's text to the user", () => {
    expect(captableFailure(new TypeError("fetch failed: ECONNREFUSED"))).toBe(
      "Oops, something went wrong. Please try again later.",
    );
  });
});
