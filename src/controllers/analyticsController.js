const Payment = require("../models/Payment");
const Invoice = require("../models/Invoice");
const WorkOrder = require("../models/WorkOrder");
const Customer = require("../models/Customer");
const Booking = require("../models/Booking");
const Review = require("../models/Review");
const Sparepart = require("../models/Sparepart");
const User = require("../models/User");
const { getActiveWorkload, DEFAULT_CAPACITY, ACTIVE_WO } = require("../services/mechanicService");
const { httpError, dayRangeWIB, todayWIB, toCsv } = require("../utils/helpers");

const TZ = "+07:00";
const netAmount = { $cond: ["$isRefund", { $multiply: ["$amount", -1] }, "$amount"] };

// default periode: awal bulan ini s/d akhir hari ini (WIB)
const getRange = (q) => {
  const today = todayWIB();
  const from = dayRangeWIB(q.from || `${today.slice(0, 7)}-01`).start;
  const to = dayRangeWIB(q.to || today).end;
  return { from, to };
};

// GET /api/v1/dashboard/owner?from=&to=
exports.ownerDashboard = async (req, res) => {
  const { from, to } = getRange(req.query);
  const inRange = { $gte: from, $lt: to };

  const [revenueDaily, cogsRows, woCount, woDone, newCustomers, rating, topMechanics, receivables] = await Promise.all([
    Payment.aggregate([
      { $match: { status: "SUCCESS", createdAt: inRange } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: TZ } }, revenue: { $sum: netAmount } } },
      { $sort: { _id: 1 } },
    ]),
    // HPP part dari invoice lunas pada periode
    Invoice.aggregate([
      { $match: { status: "PAID", createdAt: inRange } },
      { $lookup: { from: "workorders", localField: "workOrder", foreignField: "_id", as: "wo" } },
      { $unwind: "$wo" },
      { $unwind: "$wo.spareparts" },
      { $match: { "wo.spareparts.status": "ISSUED" } },
      { $group: { _id: null, cogs: { $sum: { $multiply: ["$wo.spareparts.qty", { $ifNull: ["$wo.spareparts.costPrice", 0] }] } } } },
    ]),
    WorkOrder.countDocuments({ createdAt: inRange }),
    WorkOrder.countDocuments({ status: "SELESAI", createdAt: inRange }),
    Customer.countDocuments({ createdAt: inRange }),
    Review.aggregate([{ $match: { createdAt: inRange } }, { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } }]),
    WorkOrder.aggregate([
      { $match: { status: "SELESAI", createdAt: inRange, mechanic: { $ne: null } } },
      { $group: { _id: "$mechanic", completed: { $sum: 1 } } },
      { $sort: { completed: -1 } }, { $limit: 5 },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "m" } },
      { $project: { completed: 1, name: { $arrayElemAt: ["$m.name", 0] } } },
    ]),
    Invoice.aggregate([
      { $match: { status: { $in: ["UNPAID", "PARTIAL"] } } },
      { $group: { _id: null, total: { $sum: { $subtract: ["$totalCost", "$paidAmount"] } } } },
    ]),
  ]);

  const revenue = revenueDaily.reduce((s, d) => s + d.revenue, 0);
  const cogs = cogsRows[0]?.cogs || 0;
  res.json({
    period: { from, to },
    kpi: {
      revenue, cogs, profit: revenue - cogs,
      workOrders: woCount, workOrdersCompleted: woDone, newCustomers,
      averageRating: rating[0] ? Number(rating[0].avg.toFixed(2)) : null,
      reviewCount: rating[0]?.count || 0,
      outstandingReceivables: receivables[0]?.total || 0,
    },
    revenueChart: revenueDaily.map((d) => ({ date: d._id, revenue: d.revenue })),
    topMechanics,
  });
};

// GET /api/v1/dashboard/operational
exports.operationalDashboard = async (req, res) => {
  const today = dayRangeWIB(todayWIB());
  const [queueRows, activeOrders, mechanics, workload, bookingsToday, lowStock] = await Promise.all([
    WorkOrder.aggregate([{ $match: { status: { $in: ACTIVE_WO } } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    WorkOrder.find({ status: { $in: ACTIVE_WO } }).sort({ createdAt: 1 }).limit(100)
      .select("woNumber status createdAt mechanic vehicle complaint")
      .populate("mechanic", "name").populate("vehicle", "plateNumber brand model"),
    User.find({ role: "mekanik" }).select("name capacity isActive"),
    getActiveWorkload(),
    Booking.countDocuments({ scheduledAt: { $gte: today.start, $lt: today.end }, status: { $in: ["PENDING", "CONFIRMED"] } }),
    Sparepart.find({ $expr: { $lte: ["$stock", "$minStock"] } }).select("name code stock minStock").limit(50),
  ]);

  const queue = Object.fromEntries(ACTIVE_WO.map((s) => [s, 0]));
  queueRows.forEach((r) => (queue[r._id] = r.count));

  res.json({
    queue,
    activeOrders,
    mechanics: mechanics.map((m) => {
      const load = workload.get(String(m._id)) || 0;
      const capacity = m.capacity ?? DEFAULT_CAPACITY;
      return { _id: m._id, name: m.name, isActive: m.isActive, workload: load, capacity, overload: load >= capacity };
    }),
    bookingsToday,
    lowStock,
  });
};

// GET /api/v1/reports?type=financial|stock|commission|service&from=&to=&format=json|csv
exports.getReport = async (req, res) => {
  const type = req.query.type || "financial";
  const { from, to } = getRange(req.query);
  const inRange = { $gte: from, $lt: to };
  let rows;

  if (type === "financial") {
    rows = (await Payment.aggregate([
      { $match: { status: "SUCCESS", createdAt: inRange } },
      { $group: {
          _id: { date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: TZ } }, method: "$method" },
          transactions: { $sum: 1 }, amount: { $sum: netAmount } } },
      { $sort: { "_id.date": 1, "_id.method": 1 } },
    ])).map((r) => ({ date: r._id.date, method: r._id.method, transactions: r.transactions, netAmount: r.amount }));
  } else if (type === "stock") {
    rows = (await Sparepart.find().select("-transactions").sort({ name: 1 })).map((p) => ({
      code: p.code, name: p.name, rack: p.rackLocation || "", stock: p.stock, minStock: p.minStock,
      price: p.price, costPrice: p.costPrice, stockValue: p.stock * p.costPrice, lowStock: p.stock <= p.minStock ? "YA" : "TIDAK",
    }));
  } else if (type === "commission") {
    const rate = Number(process.env.COMMISSION_RATE) || 0.1; // 10% dari nilai jasa
    rows = (await WorkOrder.aggregate([
      { $match: { status: "SELESAI", "qc.approvedAt": inRange, mechanic: { $ne: null } } },
      { $group: { _id: "$mechanic", completedOrders: { $sum: 1 }, serviceTotal: { $sum: { $sum: "$services.price" } } } },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "m" } },
      { $project: { _id: 0, mechanic: { $arrayElemAt: ["$m.name", 0] }, completedOrders: 1, serviceTotal: 1 } },
      { $sort: { serviceTotal: -1 } },
    ])).map((r) => ({ ...r, commissionRate: rate, commission: Math.round(r.serviceTotal * rate) }));
  } else if (type === "service") {
    rows = (await WorkOrder.find({ createdAt: inRange }).sort({ createdAt: 1 })
      .populate("customer", "name").populate("vehicle", "plateNumber").populate("mechanic", "name")).map((w) => ({
      woNumber: w.woNumber, date: w.createdAt.toISOString().slice(0, 10), customer: w.customer?.name,
      plate: w.vehicle?.plateNumber, mechanic: w.mechanic?.name || "", status: w.status,
    }));
  } else {
    throw httpError(400, "type harus financial, stock, commission, atau service");
  }

  if (req.query.format === "csv") {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="laporan-${type}.csv"`);
    return res.send(toCsv(rows));
  }
  res.json({ type, period: { from, to }, count: rows.length, rows });
};
