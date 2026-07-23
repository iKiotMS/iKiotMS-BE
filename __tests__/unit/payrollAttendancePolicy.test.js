jest.mock("../../src/models/PayrollPeriod", () => ({
  findOne: jest.fn(),
}));

const PayrollPeriod = require("../../src/models/PayrollPeriod");
const {
  assertAttendanceCanChange,
} = require("../../src/modules/attendances/service/PayrollAttendancePolicy");

describe("Payroll attendance policy", () => {
  beforeEach(() => jest.clearAllMocks());

  test.each(["REVIEW", "APPROVED", "PAID"])(
    "blocks attendance changes when payroll is %s",
    async (status) => {
      PayrollPeriod.findOne.mockResolvedValue({ _id: "period1", status });
      await expect(
        assertAttendanceCanChange("tenant1", new Date("2025-07-01")),
      ).rejects.toMatchObject({ statusCode: 409, payrollPeriodId: "period1" });
    },
  );

  test("allows attendance changes while payroll is draft", async () => {
    const period = { _id: "period1", status: "DRAFT" };
    PayrollPeriod.findOne.mockResolvedValue(period);
    await expect(
      assertAttendanceCanChange("tenant1", new Date("2025-07-01")),
    ).resolves.toBe(period);
  });
});
