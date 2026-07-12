const mongoose = require("mongoose");
const Holiday = require("../../../models/Holiday");
const {
  CreateHolidayDTO,
  UpdateHolidayDTO,
  ToggleHolidayStatusDTO,
  ListHolidayDTO,
} = require("../dto/HolidayDTO");

class HolidayService {
  async list({ tenantId, query }) {
    const dto = new ListHolidayDTO(query);
    const validation = dto.validate();
    if (!validation.isValid) {
      const error = new Error("Bộ lọc ngày lễ không hợp lệ");
      error.statusCode = 400;
      error.errors = validation.errors;
      throw error;
    }

    const filter = { tenantId, type: "PUBLIC_HOLIDAY", branchId: null };
    if (dto.year !== undefined) {
      filter.date = {
        $gte: new Date(Date.UTC(dto.year, 0, 1)),
        $lt: new Date(Date.UTC(dto.year + 1, 0, 1)),
      };
    }
    if (dto.isActive !== undefined) filter.isActive = dto.isActive;
    if (dto.source) filter.source = dto.source;
    if (dto.name?.trim()) {
      filter.name = { $regex: dto.name.trim(), $options: "i" };
    }

    const skip = (dto.page - 1) * dto.limit;
    const [data, total] = await Promise.all([
      Holiday.find(filter).sort({ date: 1 }).skip(skip).limit(dto.limit).lean(),
      Holiday.countDocuments(filter),
    ]);
    return {
      data,
      pagination: {
        total,
        page: dto.page,
        limit: dto.limit,
        totalPages: Math.ceil(total / dto.limit),
      },
    };
  }

  async create({ tenantId, data }) {
    const dto = new CreateHolidayDTO(data);
    const validation = dto.validate();
    if (!validation.isValid) {
      const error = new Error("Dữ liệu ngày lễ không hợp lệ");
      error.statusCode = 400;
      error.errors = validation.errors;
      throw error;
    }

    try {
      return await Holiday.create({
        tenantId,
        date: new Date(`${dto.date}T00:00:00.000Z`),
        name: dto.name.trim(),
        type: "PUBLIC_HOLIDAY",
        branchId: null,
        isActive: dto.isActive,
        source: "MANUAL",
        isManuallyEdited: true,
      });
    } catch (error) {
      if (error.code === 11000) {
        const conflict = new Error("Ngày lễ này đã tồn tại");
        conflict.statusCode = 409;
        throw conflict;
      }
      throw error;
    }
  }

  async update({ tenantId, holidayId, data }) {
    if (!mongoose.Types.ObjectId.isValid(holidayId)) {
      const error = new Error("holidayId không hợp lệ");
      error.statusCode = 400;
      throw error;
    }
    const dto = new UpdateHolidayDTO(data);
    const validation = dto.validate();
    if (!validation.isValid) {
      const error = new Error("Dữ liệu ngày lễ không hợp lệ");
      error.statusCode = 400;
      error.errors = validation.errors;
      throw error;
    }

    const update = { isManuallyEdited: true };
    if (dto.date !== undefined) {
      update.date = new Date(`${dto.date}T00:00:00.000Z`);
    }
    if (dto.name !== undefined) update.name = dto.name.trim();

    try {
      const holiday = await Holiday.findOneAndUpdate(
        { _id: holidayId, tenantId },
        { $set: update },
        { new: true, runValidators: true },
      );
      if (!holiday) {
        const error = new Error("Không tìm thấy ngày lễ");
        error.statusCode = 404;
        throw error;
      }
      return holiday;
    } catch (error) {
      if (error.code === 11000) {
        const conflict = new Error("Ngày lễ này đã tồn tại");
        conflict.statusCode = 409;
        throw conflict;
      }
      throw error;
    }
  }

  async updateStatus({ tenantId, holidayId, data }) {
    if (!mongoose.Types.ObjectId.isValid(holidayId)) {
      const error = new Error("holidayId không hợp lệ");
      error.statusCode = 400;
      throw error;
    }
    const dto = new ToggleHolidayStatusDTO(data);
    const validation = dto.validate();
    if (!validation.isValid) {
      const error = new Error("Trạng thái ngày lễ không hợp lệ");
      error.statusCode = 400;
      error.errors = validation.errors;
      throw error;
    }

    const holiday = await Holiday.findOneAndUpdate(
      { _id: holidayId, tenantId },
      { $set: { isActive: dto.isActive, isManuallyEdited: true } },
      { new: true, runValidators: true },
    );
    if (!holiday) {
      const error = new Error("Không tìm thấy ngày lễ");
      error.statusCode = 404;
      throw error;
    }
    return holiday;
  }

  async hardDelete({ tenantId, holidayId }) {
    if (!mongoose.Types.ObjectId.isValid(holidayId)) {
      const error = new Error("holidayId không hợp lệ");
      error.statusCode = 400;
      throw error;
    }
    const holiday = await Holiday.findOneAndDelete({
      _id: holidayId,
      tenantId,
    });
    if (!holiday) {
      const error = new Error("Không tìm thấy ngày lễ");
      error.statusCode = 404;
      throw error;
    }
    return holiday;
  }
}

module.exports = new HolidayService();
