const { Tenant } = require('../../../models');
const { createSystemNotification } = require('../../../services/systemNotificationService');
const { notify, tenantOwners } = require('../../../services/notificationService');

const bankingChanged = (prev, next) =>
  prev?.accountNumber !== next?.accountNumber ||
  prev?.bankName !== next?.bankName ||
  prev?.accountName !== next?.accountName;

const hasBankInfo = (banking) =>
  Boolean(banking?.accountNumber && banking?.bankName);

class TenantService {
  async notifyAdminBankUpdated(tenant) {
    try {
      await createSystemNotification({
        title: 'Cửa hàng cập nhật tài khoản ngân hàng',
        description: `Cửa hàng "${tenant.name}" vừa lưu thông tin ngân hàng (${tenant.banking?.bankName} - ${tenant.banking?.accountNumber}). Cần liên kết SePay thủ công.`,
        type: 'SYSTEM_TENANT_BANK_UPDATED',
        referenceId: String(tenant._id),
      });
    } catch (error) {
      console.error('[TenantService] notifyAdminBankUpdated failed:', error.message);
    }
  }

  // TENANT_OWNER updates their own bank info (no key)
  async updateBanking(tenantId, { accountNumber, bankName, accountName }) {
    const prev = await Tenant.findById(tenantId).select('banking name').lean();

    const tenant = await Tenant.findByIdAndUpdate(
      tenantId,
      {
        $set: {
          'banking.accountNumber': accountNumber,
          'banking.bankName': bankName,
          'banking.accountName': accountName,
        },
      },
      { new: true, runValidators: true },
    ).lean();

    if (!tenant) throw new Error('Tenant not found');

    // Alert the operator when the bank details actually changed (after commit).
    if (bankingChanged(prev?.banking, tenant.banking) && hasBankInfo(tenant.banking)) {
      await this.notifyAdminBankUpdated(tenant);
    }

    return tenant;
  }

  // SUPER_ADMIN sets the SePay webhook API key for a tenant
  async setSepayKey(tenantId, sepayWebhookApiKey) {
    const tenant = await Tenant.findByIdAndUpdate(
      tenantId,
      { $set: { 'banking.sepayWebhookApiKey': sepayWebhookApiKey } },
      { new: true },
    ).lean();

    if (!tenant) throw new Error('Tenant not found');

    // Let the tenant owner know their account is now linked with SePay.
    try {
      const owners = await tenantOwners(tenantId);
      await notify({
        tenantId,
        recipientIds: owners,
        type: 'SEPAY_LINKED',
        title: 'Tài khoản ngân hàng đã được liên kết SePay',
        description:
          'Tài khoản ngân hàng của cửa hàng bạn đã được quản trị viên liên kết với cổng thanh toán SePay. Bạn đã có thể nhận thanh toán đơn hàng qua mã QR.',
        link: '/settings',
        referenceId: tenantId,
      });
    } catch (error) {
      console.error('[TenantService] notify SEPAY_LINKED failed:', error.message);
    }

    return tenant;
  }

  async getTenant(tenantId) {
    const tenant = await Tenant.findById(tenantId)
      .select('+banking.sepayWebhookApiKey')
      .lean();
    if (!tenant) throw new Error('Tenant not found');

    const hasSepayKey = Boolean(tenant.banking?.sepayWebhookApiKey);
    if (tenant.banking) delete tenant.banking.sepayWebhookApiKey;
    return { ...tenant, hasSepayKey };
  }

  async updateTenant(tenantId, data) {
    const prev = await Tenant.findById(tenantId).select('banking name').lean();

    const tenant = await Tenant.findByIdAndUpdate(
      tenantId,
      {
        $set: {
          name: data.name,
          phoneNumber: data.phoneNumber,
          mainAddress: data.mainAddress,
          taxNumber: data.taxNumber,
          'banking.accountNumber': data.banking?.accountNumber,
          'banking.bankName': data.banking?.bankName,
          'banking.accountName': data.banking?.accountName,
          status: data.status,
        },
      },
      { new: true, runValidators: true },
    ).lean();

    if (!tenant) throw new Error('Tenant not found');

    if (
      data.banking &&
      bankingChanged(prev?.banking, tenant.banking) &&
      hasBankInfo(tenant.banking)
    ) {
      await this.notifyAdminBankUpdated(tenant);
    }

    return tenant;
  }

  async listTenants() {
    const { User, Subscription, SubscriptionInvoice } = require('../../../models');

    const tenants = await Tenant.find({})
      .select('+banking.sepayWebhookApiKey')
      .populate('tenantOwnerId')
      .lean();

    const data = [];
    for (const tenant of tenants) {
      const activeSubscription = await Subscription.findOne({ tenantId: tenant._id })
        .populate('planId')
        .lean();

      const invoices = await SubscriptionInvoice.find({ tenantId: tenant._id })
        .populate('planId')
        .sort({ createdAt: -1 })
        .lean();

      const hasSepayKey = Boolean(tenant.banking?.sepayWebhookApiKey);
      if (tenant.banking) delete tenant.banking.sepayWebhookApiKey;

      data.push({
        ...tenant,
        hasSepayKey,
        activeSubscription,
        invoices,
      });
    }

    return data;
  }
}

module.exports = new TenantService();
