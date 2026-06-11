const createStaffDTO = (tenantId, data) => {
  return {
    tenantId: tenantId,
    email: data.email,
    phoneNumber: data.phoneNumber,
    password: data.password,
    role: data.role,
    status: data.status,
    hireDate: data.hireDate,
    baseSalary: data.baseSalary,
    salaryType: data.salaryType,
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
  const staff = createStaffDTO(null, data);
  delete staff.tenantId;
  delete staff.password;
  delete staff.phoneNumber;

  Object.keys(staff).forEach((key) => {
    if (staff[key] === undefined) delete staff[key];
  });

  Object.keys(staff.profile || {}).forEach((key) => {
    if (staff.profile[key] === undefined) delete staff.profile[key];
  });

  return staff;
};

module.exports = { createStaffDTO, updateStaffDTO };
