const crypto = require('crypto');

class SepayService {
  // ─── Subscription (company bank account) ─────────────────────────────────

  generatePaymentReference() {
    return 'IKMS' + crypto.randomBytes(3).toString('hex').toUpperCase();
  }

  buildQrUrl(amount, paymentReference) {
    const accountNumber = process.env.SEPAY_ACCOUNT_NUMBER ?? '';
    const bankName = process.env.SEPAY_BANK_NAME ?? '';
    const accountName = process.env.SEPAY_ACCOUNT_NAME ?? '';

    return (
      `https://img.vietqr.io/image/${bankName}-${accountNumber}-compact2.png` +
      `?amount=${amount}&addInfo=${encodeURIComponent(paymentReference)}&accountName=${encodeURIComponent(accountName)}`
    );
  }

  verifyWebhookKey(receivedKey) {
    const expectedKey = process.env.SEPAY_WEBHOOK_API_KEY ?? '';
    return expectedKey && receivedKey === expectedKey;
  }

  extractReference(content = '') {
    const match = content.match(/IKMS[0-9A-F]{6}/i);
    return match ? match[0].toUpperCase() : null;
  }

  // ─── Order (tenant bank account) ─────────────────────────────────────────

  generateOrderRef() {
    return 'ORD' + crypto.randomBytes(3).toString('hex').toUpperCase();
  }

  // Build QR URL from the tenant's own banking info stored in DB
  buildTenantQrUrl(banking, amount, paymentReference) {
    const { accountNumber = '', bankName = '', accountName = '' } = banking;
    return (
      `https://img.vietqr.io/image/${bankName}-${accountNumber}-compact2.png` +
      `?amount=${amount}&addInfo=${encodeURIComponent(paymentReference)}&accountName=${encodeURIComponent(accountName)}`
    );
  }

  extractOrderRef(content = '') {
    const match = content.match(/ORD[0-9A-F]{6}/i);
    return match ? match[0].toUpperCase() : null;
  }

  // Find tenant by their stored SePay webhook key (select: false field — must +select)
  async findTenantByWebhookKey(apiKey) {
    if (!apiKey) return null;
    const { Tenant } = require('../models');
    return Tenant.findOne({ 'banking.sepayWebhookApiKey': apiKey })
      .select('+banking.sepayWebhookApiKey')
      .lean();
  }
}

module.exports = new SepayService();
