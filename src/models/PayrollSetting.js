const payrollSetting = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tenant",
        required: true,
    },
    cycle: {
        type: String,
        enum: ["MONTHLY"]
    },
    periodStartDay: {
        type: Number,
        default: 1,
    },
    approveAfterPeriodEndDays:{
        type: Number,
        default: 1,
    },
    payAfterPeriodEndDays:{
        type: Number,
        default: 1,
    },
    autoGenerate:{
        type: Boolean,
        default: false,
    },
    status:{
        type: String,
        enum: ["ACTIVE", "INACTIVE"],
        default: "ACTIVE",
    }
});

module.exports = mongoose.model("PayrollSetting", payrollSetting);
