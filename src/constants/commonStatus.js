const STATUS = Object.freeze({
    ACTIVE: "ACTIVE",
    INACTIVE: "INACTIVE",
    SUSPENDED: "SUSPENDED",
    DELETED: "DELETED",
})
const CHECKIN_STATUS = Object.freeze({
    CHECKED_IN: "CHECKED_IN",
    CHECKED_OUT: "CHECKED_OUT",
    LATE: "LATE",
    ABSENT: "ABSENT",
})
module.exports = { STATUS, CHECKIN_STATUS };