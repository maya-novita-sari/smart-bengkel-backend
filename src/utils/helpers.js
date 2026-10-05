const Customer = require("../models/Customer");

exports.httpError = (status, message) => Object.assign(new Error(message), { status });

exports.escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

exports.paginate = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
};

exports.INTERNAL_ROLES = ["owner", "kepala_bengkel", "sa", "mekanik", "gudang", "kasir"];

// Jam Indonesia Barat (WIB) = UTC+7
const WIB = 7 * 3600 * 1000;
exports.dayRangeWIB = (dateStr) => {
  const start = new Date(`${dateStr}T00:00:00+07:00`);
  if (isNaN(start)) throw exports.httpError(400, "Format tanggal harus YYYY-MM-DD");
  return { start, end: new Date(start.getTime() + 24 * 3600 * 1000) };
};
exports.todayWIB = () => new Date(Date.now() + WIB).toISOString().slice(0, 10);
exports.weekdayWIB = (date) => new Date(date.getTime() + WIB).getUTCDay(); // 0 = Minggu

// Konsumen hanya boleh mengakses data miliknya sendiri
exports.getOwnCustomer = (user) => Customer.findOne({ user: user._id });

exports.assertCustomerAccess = async (user, customerId) => {
  if (user.role !== "konsumen") return;
  const own = await exports.getOwnCustomer(user);
  if (!own || String(own._id) !== String(customerId)) {
    throw exports.httpError(403, "Forbidden: bukan data milik Anda");
  }
};

exports.toCsv = (rows) => {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
};

exports.genNumber = (prefix) =>
  `${prefix}-${exports.todayWIB().replace(/-/g, "")}-${require("crypto").randomBytes(3).toString("hex").toUpperCase()}`;
