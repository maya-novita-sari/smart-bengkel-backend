const Invoice = require("../models/Invoice");
const Payment = require("../models/Payment");
const Customer = require("../models/Customer");
const { httpError } = require("../utils/helpers");

const POINT_PER_RUPIAH = 10000; // 1 poin tiap Rp10.000

// Hitung ulang status invoice + poin loyalitas dari seluruh payment SUCCESS
const recalcInvoice = async (invoiceId) => {
  const invoice = await Invoice.findById(invoiceId);
  const pays = await Payment.find({ invoice: invoiceId, status: "SUCCESS" });
  const net = pays.reduce((s, p) => s + (p.isRefund ? -p.amount : p.amount), 0);
  invoice.paidAmount = net;
  invoice.status = net >= invoice.totalCost ? "PAID" : net > 0 ? "PARTIAL" : "UNPAID";

  if (invoice.status === "PAID" && invoice.pointsAwarded === 0) {
    const pts = Math.floor(invoice.totalCost / POINT_PER_RUPIAH);
    if (pts > 0) await Customer.findByIdAndUpdate(invoice.customer, { $inc: { loyaltyPoints: pts } });
    invoice.pointsAwarded = pts;
  } else if (invoice.status !== "PAID" && invoice.pointsAwarded > 0) {
    await Customer.findByIdAndUpdate(invoice.customer, { $inc: { loyaltyPoints: -invoice.pointsAwarded } });
    invoice.pointsAwarded = 0;
  }
  await invoice.save();
  return invoice;
};

// POST /api/v1/payments   body: { invoice, method: CASH|QRIS|TRANSFER, amount, type?: DP|PELUNASAN, reference }
exports.createPayment = async (req, res) => {
  const { invoice: invoiceId, method, amount, type, reference } = req.body;
  const n = Number(amount);
  if (!invoiceId || !["CASH", "QRIS", "TRANSFER"].includes(method) || !(n > 0)) {
    throw httpError(400, "invoice, method (CASH/QRIS/TRANSFER), dan amount (> 0) wajib diisi");
  }
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw httpError(404, "Invoice tidak ditemukan");
  if (invoice.status === "VOID") throw httpError(409, "Invoice sudah void");
  if (invoice.status === "PAID") throw httpError(409, "Invoice sudah lunas");

  const remaining = invoice.totalCost - invoice.paidAmount;
  if (n > remaining) throw httpError(400, `Nominal melebihi sisa tagihan (Rp${remaining})`);

  const payment = await Payment.create({
    invoice: invoice._id, method, amount: n, reference, processedBy: req.user._id,
    type: type || (n < remaining ? "DP" : "PELUNASAN"),
  });
  const updated = await recalcInvoice(invoice._id);
  res.status(201).json({ payment, invoice: { status: updated.status, paidAmount: updated.paidAmount, remaining: updated.totalCost - updated.paidAmount } });
};

// POST /api/v1/payments/:id/refund   body: { action: "REFUND"|"VOID", amount?, reason }
exports.refundOrVoid = async (req, res) => {
  const { action = "REFUND", amount, reason } = req.body;
  if (!["REFUND", "VOID"].includes(action)) throw httpError(400, "action harus REFUND atau VOID");
  if (!reason) throw httpError(400, "reason wajib diisi");

  const payment = await Payment.findById(req.params.id);
  if (!payment) throw httpError(404, "Pembayaran tidak ditemukan");
  if (payment.isRefund) throw httpError(400, "Tidak bisa me-refund transaksi refund");
  if (payment.status === "VOID") throw httpError(409, "Pembayaran sudah void");

  const refunds = await Payment.find({ refundOf: payment._id, status: "SUCCESS" });
  const refunded = refunds.reduce((s, r) => s + r.amount, 0);

  let result;
  if (action === "VOID") {
    if (refunded > 0) throw httpError(409, "Pembayaran sudah pernah di-refund, tidak bisa di-void");
    payment.status = "VOID";
    payment.reason = reason;
    await payment.save();
    result = payment;
  } else {
    const refundable = payment.amount - refunded;
    const n = amount === undefined ? refundable : Number(amount);
    if (!(n > 0) || n > refundable) throw httpError(400, `Nominal refund harus 1 - ${refundable}`);
    result = await Payment.create({
      invoice: payment.invoice, method: payment.method, type: payment.type, amount: n,
      isRefund: true, refundOf: payment._id, reason, processedBy: req.user._id,
    });
  }
  const invoice = await recalcInvoice(payment.invoice);
  res.status(201).json({ transaction: result, invoice: { status: invoice.status, paidAmount: invoice.paidAmount } });
};
