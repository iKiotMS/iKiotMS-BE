const StaffController = require("../../src/modules/staff/controller/StaffController");

describe("staff validation response", () => {
  test("returns a field-specific validation response", () => {
    const json = jest.fn();
    const res = { status: jest.fn(() => ({ json })) };

    StaffController.sendValidationError(
      res,
      Object.assign(
        new Error("Đầu số điện thoại di động Việt Nam không hợp lệ"),
        { field: "phoneNumber" },
      ),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: "Validation failed",
      errors: {
        phoneNumber: "Đầu số điện thoại di động Việt Nam không hợp lệ",
      },
    });
  });

  test("uses general for errors without a field", () => {
    const json = jest.fn();
    const res = { status: jest.fn(() => ({ json })) };

    StaffController.sendValidationError(res, new Error("Invalid staff ID"));

    expect(json).toHaveBeenCalledWith({
      success: false,
      message: "Validation failed",
      errors: { general: "Invalid staff ID" },
    });
  });
});
