const { REFERENCE_PREFIX } = require('../constants/referencePrefix');
const { generateReference } = require('../utils/referenceGenerator');

class SepayService {
  // ─── Subscription (company bank account) ─────────────────────────────────

  generatePaymentReference() {
    return generateReference(REFERENCE_PREFIX.SUBSCRIPTION);
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

  // {6,10}: refs minted before generateReference standardised on 5 bytes are 6 hex.
  extractReference(content = '') {
    const match = content.match(/IKMS[0-9A-F]{6,10}/i);
    return match ? match[0].toUpperCase() : null;
  }

  // ─── Order (tenant bank account) ─────────────────────────────────────────

  // Used for EVERY order, not just SEPAY — an ORD ref marks the money as sales
  // revenue. Order.paymentReference is globally unique across all tenants, so the
  // 5-byte (2^40) space in generateReference keeps checkout-aborting collisions
  // negligible.
  generateOrderRef() {
    return generateReference(REFERENCE_PREFIX.ORDER);
  }

  // Build QR URL from the tenant's own banking info stored in DB
  buildTenantQrUrl(banking, amount, paymentReference) {
    const { accountNumber = '', bankName = '', accountName = '' } = banking;
    return (
      `https://img.vietqr.io/image/${bankName}-${accountNumber}-compact2.png` +
      `?amount=${amount}&addInfo=${encodeURIComponent(paymentReference)}&accountName=${encodeURIComponent(accountName)}`
    );
  }

  // {6,10} not {10}: refs minted before the space was widened are 6 hex, and their
  // orders may still be PENDING. Greedy, so a new 10-hex ref matches in full.
  extractOrderRef(content = '') {
    const match = content.match(/ORD[0-9A-F]{6,10}/i);
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
