const cron = require("node-cron");

const expireOverduePendingRequest = async () => {
  const now = new Date();
  const result = await LeaveRequest.updateMany(
    {
      status: "PENDING",
      startDate: { $lt: now },
    },
    {
      $set: {
        status: "EXPIRED",
      },
    },
  );

  if (result.modifiedCount > 0) {
    console.log(`[LeaveRequestJob] Expired ${result.modifiedCount} requests`);
  }
};

const startLeaveRequestJob = () => {
  // Run every day at midnight
    cron.schedule("0 1 0 * * *", expireOverduePendingRequest);
};

module.exports = {
  startLeaveRequestJob,
};
