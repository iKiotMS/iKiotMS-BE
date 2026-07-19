const {
  VIETNAM_MOBILE_PHONE_REGEX,
  validateStaffPhoneNumber,
} = require("../../src/modules/staff/dto/StaffPhoneNumberValidator");

describe("staff phone number validation", () => {
  test.each([
    "0321234567",
    "0391234567",
    "0521234567",
    "0551234567",
    "0701234567",
    "0791234567",
    "0811234567",
    "0891234567",
    "0901234567",
    "0991234567",
  ])("accepts allocated Vietnamese mobile prefix: %s", (phoneNumber) => {
    expect(VIETNAM_MOBILE_PHONE_REGEX.test(phoneNumber)).toBe(true);
    expect(validateStaffPhoneNumber(phoneNumber)).toBe(phoneNumber);
  });

  test.each([
    ["0651234567", "điện thoại Internet (VoIP)"],
    ["0671234567", "điện thoại vệ tinh (VSAT)"],
    ["0692123456", "mạng dùng riêng"],
    ["0699123456", "mạng dùng riêng"],
    ["0801234567", "Cục Bưu điện Trung ương"],
    ["111", "bảo vệ trẻ em"],
    ["112", "tìm kiếm cứu nạn"],
    ["113", "Công an"],
    ["114", "cứu hỏa"],
    ["115", "cấp cứu y tế"],
  ])("rejects special number %s with its category", (phoneNumber, category) => {
    expect(() => validateStaffPhoneNumber(phoneNumber)).toThrow(category);
  });

  test.each(["0311234567", "0501234567", "0711234567", "0801234567"])(
    "rejects non-mobile prefix: %s",
    (phoneNumber) => {
      expect(VIETNAM_MOBILE_PHONE_REGEX.test(phoneNumber)).toBe(false);
    },
  );

  test.each(["090123456", "09012345678", "09012345a7"])(
    "reports an invalid 10-digit format: %s",
    (phoneNumber) => {
      expect(() => validateStaffPhoneNumber(phoneNumber)).toThrow(
        "Số điện thoại phải gồm đúng 10 chữ số",
      );
    },
  );

  test.each(["0123123123", "0311234567", "0501234567"])(
    "reports an invalid mobile prefix: %s",
    (phoneNumber) => {
      expect(() => validateStaffPhoneNumber(phoneNumber)).toThrow(
        "Đầu số điện thoại di động Việt Nam không hợp lệ",
      );
    },
  );
});
