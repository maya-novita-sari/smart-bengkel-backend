const Customer = require("../models/Customer");
const Invoice = require("../models/Invoice");
const Review = require("../models/Review");
const WorkOrder = require("../models/WorkOrder");
const { httpError, assertCustomerAccess, getOwnCustomer } = require("../utils/helpers");

// GET /api/v1/crm/loyalty/:customerId
exports.getLoyalty = async (req, res) => {
  await assertCustomerAccess(req.user, req.params.customerId);
  const customer = await Customer.findById(req.params.customerId);
  if (!customer) throw httpError(404, "Pelanggan tidak ditemukan");

  const invoices = await Invoice.find({ customer: customer._id, status: { $in: ["PAID", "PARTIAL"] } })
    .sort({ createdAt: -1 }).limit(50)
    .select("invoiceNumber totalCost paidAmount status pointsAwarded createdAt");
  const now = new Date();
  res.json({
    customer: { _id: customer._id, name: customer.name },
    points: customer.loyaltyPoints,
    vouchers: customer.vouchers.filter((v) => !v.used && (!v.expiresAt || v.expiresAt > now)),
    totalSpent: invoices.filter((i) => i.status === "PAID").reduce((s, i) => s + i.totalCost, 0),
    history: invoices,
  });
};

// POST /api/v1/reviews   body: { workOrder, rating, mechanicRating?, comment }
exports.createReview = async (req, res) => {
  const { workOrder, rating, mechanicRating, comment } = req.body;
  if (!workOrder || !rating) throw httpError(400, "workOrder dan rating wajib diisi");
  const customer = await getOwnCustomer(req.user);
  if (!customer) throw httpError(400, "Profil pelanggan belum ada");

  const wo = await WorkOrder.findOne({ _id: workOrder, customer: customer._id });
  if (!wo) throw httpError(404, "Work Order tidak ditemukan atau bukan milik Anda");
  if (wo.status !== "SELESAI") throw httpError(409, "Ulasan hanya bisa diberikan setelah servis selesai");

  const review = await Review.create({
    customer: customer._id, workOrder: wo._id, mechanic: wo.mechanic, rating, mechanicRating, comment,
  });
  res.status(201).json(review);
};
