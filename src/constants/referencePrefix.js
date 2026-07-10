// Prefix on a paymentReference identifies which money-flow a payment / CashFlow row
// belongs to. Stats filter by it (a `^PREFIX` match on paymentReference) to report
// "which category the money went to / came from".
//
// Values are PERSISTED on historical rows — never rename an existing prefix, only add.
// Keep each prefix a distinct string that is not a prefix of another (so `^ORD` can't
// accidentally match a different flow).
const REFERENCE_PREFIX = {
  ORDER: "ORD", // Customer order: INCOME on sale, EXPENSE on refund/return
  SUPPLIER: "SUP", // Supplier debt payment (EXPENSE)
  SUBSCRIPTION: "IKMS", // Tenant pays iKiot for a plan (company bank — not tenant CashFlow)
};

// Every flow that can appear in a tenant's CashFlow, for stats filtering.
const CASHFLOW_PREFIXES = [REFERENCE_PREFIX.ORDER, REFERENCE_PREFIX.SUPPLIER];

module.exports = { REFERENCE_PREFIX, CASHFLOW_PREFIXES };
