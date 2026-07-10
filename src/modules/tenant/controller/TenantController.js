const TenantService = require('../service/TenantService');

class TenantController {
  async getMyTenant(req, res) {
    try {
      const tenant = await TenantService.getTenant(req.user.tenantId);
      res.status(200).json({ success: true, data: tenant });
    } catch (error) {
      res.status(404).json({ success: false, message: error.message });
    }
  }

  // TENANT_OWNER: update their own bank account info (accountNumber, bankName, accountName)
  async updateBanking(req, res) {
    try {
      const { accountNumber, bankName, accountName } = req.body;

      if (!accountNumber || !bankName || !accountName) {
        return res.status(400).json({
          success: false,
          message: 'accountNumber, bankName, and accountName are required',
        });
      }

      const tenant = await TenantService.updateBanking(req.user.tenantId, {
        accountNumber,
        bankName,
        accountName,
      });

      res.status(200).json({ success: true, data: tenant });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  // SUPER_ADMIN: set SePay webhook key for a specific tenant
  async setSepayKey(req, res) {
    try {
      const { tenantId } = req.params;
      const { sepayWebhookApiKey } = req.body;

      if (!sepayWebhookApiKey) {
        return res.status(400).json({ success: false, message: 'sepayWebhookApiKey is required' });
      }

      await TenantService.setSepayKey(tenantId, sepayWebhookApiKey);

      res.status(200).json({ success: true, message: 'SePay key saved' });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async updateMyTenant(req, res) {
    try {
      const tenantId = req.user.tenantId;
      if (!tenantId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const tenant = await TenantService.updateTenant(tenantId, req.body);
      res.status(200).json({ success: true, data: tenant });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async listTenants(req, res) {
    try {
      if (req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }

      const tenants = await TenantService.listTenants();
      res.status(200).json({ success: true, data: tenants });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateTenantAdmin(req, res) {
    try {
      if (req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      const { tenantId } = req.params;
      const tenant = await TenantService.updateTenant(tenantId, req.body);
      res.status(200).json({ success: true, data: tenant });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}

module.exports = new TenantController();
