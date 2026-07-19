const {
  VIETNAM_PROVINCE_CODES,
  validateStaffIdentificationId,
} = require("../../src/modules/staff/dto/StaffIdentificationValidator");

describe("staff identification validation", () => {
  test("contains all 63 Vietnamese province codes", () => {
    expect(VIETNAM_PROVINCE_CODES.size).toBe(63);
  });

  test("accepts a structurally valid identification number", () => {
    expect(
      validateStaffIdentificationId("087084000999", {
        dob: "1984-05-20",
        gender: "MALE",
      }),
    ).toBe("087084000999");
  });

  test("trims a valid identification number", () => {
    expect(validateStaffIdentificationId(" 079201000001 ")).toBe(
      "079201000001",
    );
  });

  test.each(["08708400099", "0870840009999"])(
    "rejects an identification number with invalid length: %s",
    (identificationId) => {
      expect(() => validateStaffIdentificationId(identificationId)).toThrow(
        "Số căn cước phải gồm đúng 12 chữ số",
      );
    },
  );

  test("rejects non-digit characters", () => {
    expect(() => validateStaffIdentificationId("08708400099a")).toThrow(
      "Số căn cước chỉ được chứa chữ số",
    );
  });

  test("rejects an unknown province code", () => {
    expect(() => validateStaffIdentificationId("003084000999")).toThrow(
      "Mã nơi đăng ký khai sinh trên số căn cước không hợp lệ",
    );
  });

  test("rejects a birth year that does not match dob", () => {
    expect(() =>
      validateStaffIdentificationId("087084000999", {
        dob: "1985-05-20",
      }),
    ).toThrow(
      "Năm sinh trên số căn cước không khớp với ngày sinh của nhân viên",
    );
  });

  test.each([
    ["087184000999", "MALE"],
    ["087084000999", "FEMALE"],
  ])("rejects a gender mismatch for %s", (identificationId, gender) => {
    expect(() =>
      validateStaffIdentificationId(identificationId, { gender }),
    ).toThrow(
      "Giới tính trên số căn cước không khớp với giới tính của nhân viên",
    );
  });

  test("does not compare OTHER gender with the encoded binary gender", () => {
    expect(
      validateStaffIdentificationId("087084000999", { gender: "OTHER" }),
    ).toBe("087084000999");
  });
});
