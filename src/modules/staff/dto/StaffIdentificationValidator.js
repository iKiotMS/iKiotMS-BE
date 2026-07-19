function staffValidationError(field, message) {
  const error = new Error(message);
  error.name = "StaffValidationError";
  error.field = field;
  return error;
}

const VIETNAM_PROVINCE_CODES = new Set([
  "001", "002", "004", "006", "008", "010", "011", "012", "014",
  "015", "017", "019", "020", "022", "024", "025", "026", "027",
  "030", "031", "033", "034", "035", "036", "037", "038", "040",
  "042", "044", "045", "046", "048", "049", "051", "052", "054",
  "056", "058", "060", "062", "064", "066", "067", "068", "070",
  "072", "074", "075", "077", "079", "080", "082", "083", "084",
  "086", "087", "089", "091", "092", "093", "094", "095", "096",
]);

function getBirthYear(centuryGenderCode, yearSuffix) {
  const centuryStart = 1900 + Math.floor(centuryGenderCode / 2) * 100;
  return centuryStart + Number(yearSuffix);
}

function validateStaffIdentificationId(identificationId, { dob, gender } = {}) {
  if (typeof identificationId !== "string" || !identificationId.trim()) {
    throw staffValidationError(
      "identificationId",
      "Số căn cước là bắt buộc",
    );
  }

  const normalizedIdentificationId = identificationId.trim();

  if (!/^\d+$/.test(normalizedIdentificationId)) {
    throw staffValidationError(
      "identificationId",
      "Số căn cước chỉ được chứa chữ số",
    );
  }

  if (normalizedIdentificationId.length !== 12) {
    throw staffValidationError(
      "identificationId",
      "Số căn cước phải gồm đúng 12 chữ số",
    );
  }

  const provinceCode = normalizedIdentificationId.slice(0, 3);
  if (!VIETNAM_PROVINCE_CODES.has(provinceCode)) {
    throw staffValidationError(
      "identificationId",
      "Mã nơi đăng ký khai sinh trên số căn cước không hợp lệ",
    );
  }

  const centuryGenderCode = Number(normalizedIdentificationId[3]);
  const birthYear = getBirthYear(
    centuryGenderCode,
    normalizedIdentificationId.slice(4, 6),
  );

  if (dob !== undefined && dob !== null && dob !== "") {
    const parsedDob = new Date(dob);
    if (Number.isNaN(parsedDob.getTime())) {
      throw staffValidationError("dob", "Ngày sinh của nhân viên không hợp lệ");
    }
    if (parsedDob.getUTCFullYear() !== birthYear) {
      throw staffValidationError(
        "identificationId",
        "Năm sinh trên số căn cước không khớp với ngày sinh của nhân viên",
      );
    }
  }

  if (gender === "MALE" && centuryGenderCode % 2 !== 0) {
    throw staffValidationError(
      "gender",
      "Giới tính trên số căn cước không khớp với giới tính của nhân viên",
    );
  }

  if (gender === "FEMALE" && centuryGenderCode % 2 !== 1) {
    throw staffValidationError(
      "gender",
      "Giới tính trên số căn cước không khớp với giới tính của nhân viên",
    );
  }

  return normalizedIdentificationId;
}

module.exports = {
  VIETNAM_PROVINCE_CODES,
  validateStaffIdentificationId,
};
