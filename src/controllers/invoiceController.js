const Invoice = require("../models/Invoice");
const Payment = require("../models/Payment");
const WorkOrder = require("../models/WorkOrder");
const Customer = require("../models/Customer");
const { httpError, genNumber, assertCustomerAccess } = require("../utils/helpers");

// POST /api/v1/invoices/generate/:woId   body (opsional): { discount, voucherCode }
exports.generateInvoice = async (req, res) => {
  const wo = await WorkOrder.findById(req.params.woId).populate("spareparts.sparepart", "name code");
  if (!wo) throw httpError(404, "Work Order tidak ditemukan");
  if (wo.status !== "SELESAI") throw httpError(409, "Invoice hanya bisa dibuat untuk WO berstatus SELESAI (lulus QC)");
  if (await Invoice.exists({ workOrder: wo._id, status: { $ne: "VOID" } })) {
    throw httpError(409, "Invoice untuk WO ini sudah ada");
  }

  const items = [];
  wo.services.forEach((s) => items.push({ kind: "JASA", name: s.name, qty: 1, price: s.price || 0, total: s.price || 0 }));
  wo.spareparts
    .filter((s) => s.status === "ISSUED")
    .forEach((s) => items.push({
      kind: "PART", name: s.sparepart?.name || "Sparepart", qty: s.qty, price: s.price || 0, total: (s.price || 0) * s.qty,
    }));

  const serviceCost = items.filter((i) => i.kind === "JASA").reduce((a, i) => a + i.total, 0);
  const partsCost = items.filter((i) => i.kind === "PART").reduce((a, i) => a + i.total, 0);
  const subtotal = serviceCost + partsCost;

  // Diskon: manual atau voucher pelanggan
  let discount = Number(req.body.discount) || 0;
  const customer = await Customer.findById(wo.customer);
  let voucher;
  if (req.body.voucherCode) {
    voucher = customer.vouchers.find(
      (v) => v.code === req.body.voucherCode && !v.used && (!v.expiresAt || v.expiresAt > new Date())
    );
    if (!voucher) throw httpError(400, "Voucher tidak valid / sudah dipakai / kedaluwarsa");
    discount += voucher.discount || 0;
  }
  discount = Math.min(Math.max(discount, 0), subtotal);

  const invoice = await Invoice.create({
    invoiceNumber: genNumber("INV"),
    workOrder: wo._id, customer: wo.customer, items,
    serviceCost, partsCost, discount, totalCost: subtotal - discount, createdBy: req.user._id,
  });
  if (voucher) {
    voucher.used = true;
    await customer.save();
  }
  res.status(201).json(invoice);
};

// GET /api/v1/invoices/:id
exports.getInvoice = async (req, res) => {
  const invoice = await Invoice.findById(req.params.id)
    .populate("customer", "name phone")
    .populate({ path: "workOrder", select: "woNumber vehicle", populate: { path: "vehicle", select: "plateNumber brand model" } });
  if (!invoice) throw httpError(404, "Invoice tidak ditemukan");
  await assertCustomerAccess(req.user, invoice.customer._id);
  const payments = await Payment.find({ invoice: invoice._id }).sort({ createdAt: 1 });
  res.json({ ...invoice.toObject(), remaining: Math.max(0, invoice.totalCost - invoice.paidAmount), payments });
};
