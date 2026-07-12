/**
 * Normalize a Vietnamese phone number to E.164 (+84...), so a number entered as
 * "0912345678" is stored/compared consistently as "+84912345678".
 */
function normalizePhone(phone) {
  if (!phone) return "";
  let p = String(phone).trim().replace(/[\s\-().]/g, "");
  if (p.startsWith("+")) return p;
  if (p.startsWith("84")) return "+" + p;
  if (p.startsWith("0")) return "+84" + p.slice(1);
  return "+" + p;
}

module.exports = { normalizePhone };
