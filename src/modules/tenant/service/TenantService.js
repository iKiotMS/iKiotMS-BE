const { Tenant } = require('../../../models');

class TenantService {
  // TENANT_OWNER updates their own bank info (no key)
  async updateBanking(tenantId, { accountNumber, bankName, accountName }) {
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
    return tenant;
  }

  async getTenant(tenantId) {
    const tenant = await Tenant.findById(tenantId).lean();
    if (!tenant) throw new Error('Tenant not found');
    return tenant;
  }
}

module.exports = new TenantService();
