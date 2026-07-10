const StatsService = require("../service/StatsService");
const StatsQueryDTO = require("../dto/StatsQueryDTO");

// All handlers share the same query parsing; only the service call differs.
const run = (method) => async (req, res) => {
  try {
    const dto = new StatsQueryDTO(req.query);
    const { isValid, errors } = dto.validate();
    if (!isValid) {
      return res.status(400).json({ success: false, message: "Validation failed", errors });
    }
    const data = await StatsService[method](req.user, dto);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

class StatsController {
  overview = run("getOverview");
  revenue = run("getRevenueSeries");
  revenueByPaymentMethod = run("getRevenueByPaymentMethod");
  revenueByStaff = run("getRevenueByStaff");
  cashflow = run("getCashflow");
  topProducts = run("getTopProducts");
  inventory = run("getInventory");
}

module.exports = new StatsController();
