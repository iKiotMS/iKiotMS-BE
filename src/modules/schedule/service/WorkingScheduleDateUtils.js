function getPagination({ page = 1, recordPerPage = 10 } = {}) {
  const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
  const perPage = Math.max(parseInt(recordPerPage, 10) || 10, 1);

  return {
    page: pageNumber,
    recordPerPage: perPage,
    skip: (pageNumber - 1) * perPage,
  };
}

function getLocalDateText(dateValue) {
  if (typeof dateValue === "string") {
    return dateValue.slice(0, 10);
  }

  return dateValue.toISOString().slice(0, 10);
}

function buildDateTime(workDate, timeText) {
  const dateText = getLocalDateText(workDate);
  return new Date(`${dateText}T${timeText}:00.000Z`);
}

function buildWorkDate(workDate) {
  const dateText = getLocalDateText(workDate);
  return new Date(`${dateText}T00:00:00.000Z`);
}

function configWorkAndEndDate(workDate, shiftTemplate) {
  const startTime = shiftTemplate.startTime;
  const endTime = shiftTemplate.endTime;

  const startAt = buildDateTime(workDate, startTime);
  const endAt = buildDateTime(workDate, endTime);

  if (startTime > endTime) {
    endAt.setUTCDate(endAt.getUTCDate() + 1);
  }

  return { startAt, endAt };
}

module.exports = {
  getPagination,
  getLocalDateText,
  buildDateTime,
  buildWorkDate,
  configWorkAndEndDate,
};
