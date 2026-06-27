const createStaffDTO = (tenantId, data) => {
  return {
    tenantId: tenantId,
    email: data.email,
    phoneNumber: data.phoneNumber,
    role: data.role,
    status: "INACTIVE",
    hireDate: data.hireDate,
    warehouseId: data.warehouseId,
    branchId: data.branchId,
    profile: {
      firstName: data?.firstName,
      lastName: data?.lastName,
      avatarUrl: data?.avatarUrl,
      dob: data?.dob,
      taxNumber: data?.taxNumber,
      identificationId: data.profile?.identificationId,
      address: data.profile?.address,
      gender: data.profile?.gender,
    },
  };
};

const updateStaffDTO = (data) => {
  const staff = {};

  const staffFields = [
    "email",
    "role",
    "hireDate",
    "warehouseId",
    "branchId",
    "accountNote",
  ];

  staffFields.forEach((field) => {
    if (data[field] !== undefined) staff[field] = data[field];
  });

  const profile = {};
  const profileFields = [
    "firstName",
    "lastName",
    "avatarUrl",
    "dob",
    "taxNumber",
    "identificationId",
    "address",
    "gender",
  ];

  profileFields.forEach((field) => {
    if (data.profile?.[field] !== undefined) {
      profile[field] = data.profile[field];
    }
  });

  if (Object.keys(profile).length > 0) staff.profile = profile;

  return staff;
};

const createStaffAccountDTO = (data) => {
  return {
    newPassword: data.newPassword,
    reEnterPassword: data.reEnterPassword,
    status: "ACTIVE",
  };
};

module.exports = { createStaffDTO, updateStaffDTO, createStaffAccountDTO };
