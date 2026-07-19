function staffValidationError(field, message) {
  const error = new Error(message);
  error.name = "StaffValidationError";
  error.field = field;
  return error;
}

const VIETNAM_MOBILE_PHONE_REGEX =
  /^(?:03[2-9]|05[25689]|07[06789]|08[1-9]|09\d)\d{7}$/;

const SPECIAL_PHONE_NUMBER_RULES = [
  {
    regex: /^065\d{7}$/,
    message:
      "Đầu số 065 dành cho dịch vụ điện thoại Internet (VoIP), không được phép sử dụng làm số di động của nhân viên",
  },
  {
    regex: /^067\d{7}$/,
    message:
      "Đầu số 067 dành cho dịch vụ điện thoại vệ tinh (VSAT), không được phép sử dụng làm số di động của nhân viên",
  },
  {
    regex: /^069[2-9]\d{6}$/,
    message:
      "Đầu số 069 dành cho mạng dùng riêng của cơ quan Đảng, Nhà nước, Công an và Quân đội, không được phép sử dụng làm số di động của nhân viên",
  },
  {
    regex: /^080\d{7}$/,
    message:
      "Đầu số 080 dành cho dịch vụ của Cục Bưu điện Trung ương, không được phép sử dụng làm số di động của nhân viên",
  },
  {
    regex: /^111$/,
    message:
      "Số 111 là Tổng đài điện thoại quốc gia bảo vệ trẻ em, không được phép sử dụng làm số di động của nhân viên",
  },
  {
    regex: /^112$/,
    message:
      "Số 112 là tổng đài ứng cứu khẩn cấp, tìm kiếm cứu nạn toàn quốc, không được phép sử dụng làm số di động của nhân viên",
  },
  {
    regex: /^113$/,
    message:
      "Số 113 là số điện thoại khẩn cấp của Công an, không được phép sử dụng làm số di động của nhân viên",
  },
  {
    regex: /^114$/,
    message:
      "Số 114 là số điện thoại khẩn cấp về cứu hỏa và cứu nạn, cứu hộ, không được phép sử dụng làm số di động của nhân viên",
  },
  {
    regex: /^115$/,
    message:
      "Số 115 là số điện thoại cấp cứu y tế, không được phép sử dụng làm số di động của nhân viên",
  },
];

function validateStaffPhoneNumber(phoneNumber) {
  if (typeof phoneNumber !== "string" || !phoneNumber.trim()) {
    throw staffValidationError("phoneNumber", "Số điện thoại là bắt buộc");
  }

  const normalizedPhoneNumber = phoneNumber.trim();
  const specialRule = SPECIAL_PHONE_NUMBER_RULES.find(({ regex }) =>
    regex.test(normalizedPhoneNumber),
  );

  if (specialRule) {
    throw staffValidationError("phoneNumber", specialRule.message);
  }

  if (!/^\d{10}$/.test(normalizedPhoneNumber)) {
    throw staffValidationError(
      "phoneNumber",
      "Số điện thoại phải gồm đúng 10 chữ số",
    );
  }

  if (!VIETNAM_MOBILE_PHONE_REGEX.test(normalizedPhoneNumber)) {
    throw staffValidationError(
      "phoneNumber",
      "Đầu số điện thoại di động Việt Nam không hợp lệ",
    );
  }

  return normalizedPhoneNumber;
}

module.exports = {
  VIETNAM_MOBILE_PHONE_REGEX,
  validateStaffPhoneNumber,
};
