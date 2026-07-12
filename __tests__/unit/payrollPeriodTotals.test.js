const mongoose = require("mongoose");
const PayrollPeriod = require("../../src/models/PayrollPeriod");
const Payslip = require("../../src/models/Payslip");
const PayrollService = require("../../src/modules/payroll/service/PayrollService");

function paginatedQuery(result) {
  const query = {};
  query.populate = jest.fn().mockReturnValue(query);
  query.sort = jest.fn().mockReturnValue(query);
  query.skip = jest.fn().mockReturnValue(query);
  query.limit = jest.fn().mockReturnValue(query);
  query.lean = jest.fn().mockResolvedValue(result);
  return query;
}

describe("Payroll period totalCost", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("adds the full payslip total to each listed payroll period", async () => {
    const tenantId = new mongoose.Types.ObjectId();
    const firstPeriodId = new mongoose.Types.ObjectId();
    const secondPeriodId = new mongoose.Types.ObjectId();
    jest.spyOn(PayrollPeriod, "find").mockReturnValue(
      paginatedQuery([
        { _id: firstPeriodId, name: "First" },
        { _id: secondPeriodId, name: "Second" },
      ]),
    );
    jest.spyOn(PayrollPeriod, "countDocuments").mockResolvedValue(2);
    jest.spyOn(Payslip, "aggregate").mockResolvedValue([
      { _id: firstPeriodId, totalCost: 1500000 },
    ]);

    const result = await PayrollService.listPayrollPeriods({
      tenantId,
      query: {},
    });

    expect(Payslip.aggregate).toHaveBeenCalledWith([
      {
        $match: {
          tenantId,
          payrollPeriodId: { $in: [firstPeriodId, secondPeriodId] },
        },
      },
      {
        $group: {
          _id: "$payrollPeriodId",
          totalCost: { $sum: { $ifNull: ["$netSalary", 0] } },
        },
      },
    ]);
    expect(result.data).toEqual([
      expect.objectContaining({ _id: firstPeriodId, totalCost: 1500000 }),
      expect.objectContaining({ _id: secondPeriodId, totalCost: 0 }),
    ]);
  });

  test("detail totalCost includes payslips outside the requested page", async () => {
    const tenantId = new mongoose.Types.ObjectId();
    const periodId = new mongoose.Types.ObjectId();
    jest.spyOn(PayrollPeriod, "findOne").mockReturnValue({
      lean: jest.fn().mockResolvedValue({ _id: periodId, name: "July" }),
    });
    jest.spyOn(Payslip, "find").mockReturnValue(
      paginatedQuery([{ netSalary: 100000 }]),
    );
    jest.spyOn(Payslip, "countDocuments").mockResolvedValue(25);
    jest.spyOn(Payslip, "aggregate").mockResolvedValue([
      { _id: periodId, totalCost: 5000000 },
    ]);

    const result = await PayrollService.getPayrollPeriod({
      tenantId,
      periodId,
      query: { page: 1, limit: 1 },
    });

    expect(Payslip.aggregate).toHaveBeenCalledWith([
      { $match: { tenantId, payrollPeriodId: periodId } },
      {
        $group: {
          _id: "$payrollPeriodId",
          totalCost: { $sum: { $ifNull: ["$netSalary", 0] } },
        },
      },
    ]);
    expect(result.payrollPeriod.totalCost).toBe(5000000);
    expect(result.payslips).toEqual([{ netSalary: 100000 }]);
    expect(result.pagination).toMatchObject({ total: 25, limit: 1 });
  });
});
