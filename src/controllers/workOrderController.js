const WorkOrder = require("../models/WorkOrder");
const Booking = require("../models/Booking");
const Customer = require("../models/Customer");
const Vehicle = require("../models/Vehicle");
const User = require("../models/User");
const Sparepart = require("../models/Sparepart");
const Invoice = require("../models/Invoice");
const { rankMechanics } = require("../services/mechanicService");
const { httpError, paginate, genNumber, INTERNAL_ROLES } = require("../utils/helpers");

const loadWO = async (id) => {
  const wo = await WorkOrder.findById(id);
  if (!wo) throw httpError(404, "Work Order tidak ditemukan");
  return wo;
};
const assertAssignedMechanic = (req, wo) => {
  if (req.user.role === "mekanik" && String(wo.mechanic) !== String(req.user._id)) {
    throw httpError(403, "WO ini bukan ditugaskan ke Anda");
  }
};
const assertOpen = (wo) => {
  if (wo.status === "SELESAI") throw httpError(409, "WO sudah selesai dan tidak bisa diubah");
};
const pushStatus = (wo, status, by) => {
  wo.status = status;
  wo.statusHistory.push({ status, by });
};

// POST /api/v1/work-orders  (check-in)
exports.createWorkOrder = async (req, res) => {
  const { booking: bookingId, complaint, services, estimate, odometerKm } = req.body;
  let { customer, vehicle } = req.body;

  if (bookingId) {
    const booking = await Booking.findById(bookingId);
    if (!booking) throw httpError(404, "Booking tidak ditemukan");
    if (booking.status === "CANCELLED") throw httpError(409, "Booking sudah dibatalkan");
    if (booking.status === "CHECKED_IN" || (await WorkOrder.exists({ booking: bookingId }))) {
      throw httpError(409, "Booking ini sudah check-in");
    }
    customer = booking.customer;
    vehicle = booking.vehicle;
  }
  if (!customer || !vehicle) throw httpError(400, "customer dan vehicle (atau booking) wajib diisi");
  if (!(await Vehicle.exists({ _id: vehicle, customer }))) throw httpError(400, "Kendaraan bukan milik pelanggan tersebut");
  if (!(await Customer.exists({ _id: customer }))) throw httpError(404, "Pelanggan tidak ditemukan");

  const svc = Array.isArray(services) ? services : [];
  const wo = await WorkOrder.create({
    woNumber: genNumber("WO"),
    booking: bookingId, customer, vehicle, complaint, odometerKm,
    services: svc,
    estimate: estimate ?? svc.reduce((s, x) => s + (Number(x.price) || 0), 0),
    serviceAdvisor: req.user._id,
    statusHistory: [{ status: "DRAFT", by: req.user._id }],
  });
  if (bookingId) await Booking.findByIdAndUpdate(bookingId, { status: "CHECKED_IN" });
  if (odometerKm) await Vehicle.findByIdAndUpdate(vehicle, { odometerKm });
  res.status(201).json(wo);
};

// GET /api/v1/work-orders?status=DRAFT,DIKERJAKAN&mechanic=&customer=&vehicle=&from=&to=&q=
exports.getWorkOrders = async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const { status, mechanic, customer, vehicle, from, to, q } = req.query;
  const filter = {};
  if (status) filter.status = { $in: String(status).split(",") };
  if (customer) filter.customer = customer;
  if (vehicle) filter.vehicle = vehicle;
  if (q) filter.woNumber = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }
  // Mekanik hanya melihat WO miliknya
  if (req.user.role === "mekanik") filter.mechanic = req.user._id;
  else if (mechanic) filter.mechanic = mechanic;

  const [data, total] = await Promise.all([
    WorkOrder.find(filter)
      .sort({ createdAt: -1 }).skip(skip).limit(limit)
      .populate("customer", "name phone").populate("vehicle", "plateNumber brand model")
      .populate("mechanic", "name"),
    WorkOrder.countDocuments(filter),
  ]);
  res.json({ data, page, limit, total });
};

// GET /api/v1/work-orders/:id
exports.getWorkOrder = async (req, res) => {
  const wo = await WorkOrder.findById(req.params.id)
    .populate("customer", "name phone email")
    .populate("vehicle", "plateNumber brand model year odometerKm")
    .populate("serviceAdvisor", "name").populate("mechanic", "name specialization")
    .populate("spareparts.sparepart", "name code rackLocation")
    .populate("qc.approvedBy qc.checkedBy", "name");
  if (!wo) throw httpError(404, "Work Order tidak ditemukan");
  res.json(wo);
};

// PATCH /api/v1/work-orders/:id/assign   body: { mechanicId } atau { auto: true }
exports.assignMechanic = async (req, res) => {
  const wo = await loadWO(req.params.id);
  assertOpen(wo);
  let mechanicId = req.body.mechanicId;

  if (req.body.auto) {
    const ranked = await rankMechanics({ serviceType: req.body.serviceType });
    if (!ranked.length) throw httpError(409, "Tidak ada mekanik tersedia");
    mechanicId = ranked[0].mechanic._id;
  } else {
    if (!mechanicId) throw httpError(400, "mechanicId atau auto:true wajib diisi");
    if (!(await User.exists({ _id: mechanicId, role: "mekanik", isActive: true }))) {
      throw httpError(404, "Mekanik tidak ditemukan / nonaktif");
    }
  }
  wo.mechanic = mechanicId;
  await wo.save();
  await wo.populate("mechanic", "name");
  res.json(wo);
};

// POST /api/v1/work-orders/:id/dvi   body: { items: [{ item, condition, note }] }
exports.saveDvi = async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || !items.length) throw httpError(400, "items (checklist DVI) wajib diisi");
  if (items.some((i) => !i.item)) throw httpError(400, "Setiap item DVI harus punya nama item");
  const wo = await loadWO(req.params.id);
  assertOpen(wo);
  wo.dvi = items.map(({ item, condition, note }) => ({ item, condition, note }));
  await wo.save();
  res.status(201).json(wo.dvi);
};

// POST /api/v1/work-orders/:id/diagnosis   body: { diagnosis, recommendation, estimate }
exports.saveDiagnosis = async (req, res) => {
  const { diagnosis, recommendation, estimate } = req.body;
  if (!diagnosis) throw httpError(400, "diagnosis wajib diisi");
  const wo = await loadWO(req.params.id);
  assertOpen(wo);
  assertAssignedMechanic(req, wo);
  wo.diagnosis = diagnosis;
  wo.recommendation = recommendation;
  if (estimate !== undefined) wo.estimate = estimate;
  await wo.save();
  res.status(201).json(wo);
};

// POST /api/v1/work-orders/:id/media   (multipart, field "files")
exports.uploadMedia = async (req, res) => {
  if (!req.files?.length) throw httpError(400, "Tidak ada file yang diupload (field: files)");
  const wo = await loadWO(req.params.id);
  assertOpen(wo);
  assertAssignedMechanic(req, wo);
  const added = req.files.map((f) => ({
    url: `/uploads/${f.filename}`,
    type: f.mimetype.startsWith("video") ? "video" : "image",
    originalName: f.originalname,
    uploadedBy: req.user._id,
  }));
  wo.media.push(...added);
  await wo.save();
  res.status(201).json(wo.media.slice(-added.length));
};

// PATCH /api/v1/work-orders/:id/status   body: { status }
// DRAFT -> DIKERJAKAN -> QC. (QC -> SELESAI dilakukan lewat PATCH /:id/qc-approve)
exports.updateStatus = async (req, res) => {
  const { status } = req.body;
  const wo = await loadWO(req.params.id);
  assertAssignedMechanic(req, wo);

  if (status === "SELESAI") throw httpError(400, "Status SELESAI hanya lewat verifikasi QC (qc-approve)");
  const next = { DRAFT: "DIKERJAKAN", DIKERJAKAN: "QC" };
  if (next[wo.status] !== status) {
    throw httpError(409, `Transisi ${wo.status} -> ${status} tidak diizinkan`);
  }
  if (status === "DIKERJAKAN" && !wo.mechanic) throw httpError(409, "Tugaskan mekanik terlebih dahulu");
  if (status === "QC" && wo.spareparts.some((s) => s.status === "REQUESTED")) {
    throw httpError(409, "Masih ada permintaan sparepart yang belum diproses gudang");
  }
  pushStatus(wo, status, req.user._id);
  if (status === "QC") wo.qc.approved = false;
  await wo.save();
  res.json(wo);
};

// POST /api/v1/work-orders/:id/qc   body: { checklist: [{ item, passed }], notes, testNotes }
exports.submitQc = async (req, res) => {
  const { checklist, notes, testNotes } = req.body;
  if (!Array.isArray(checklist) || !checklist.length) throw httpError(400, "checklist QC wajib diisi");
  const wo = await loadWO(req.params.id);
  if (wo.status !== "QC") throw httpError(409, "WO belum berstatus QC");

  wo.qc.checklist = checklist.map((c) => ({ item: c.item, passed: !!c.passed }));
  wo.qc.notes = notes;
  wo.qc.testNotes = testNotes;
  wo.qc.checkedBy = req.user._id;
  wo.qc.approved = false;
  const allPassed = wo.qc.checklist.every((c) => c.passed);
  if (!allPassed) pushStatus(wo, "DIKERJAKAN", req.user._id); // dikembalikan ke mekanik (rework)
  await wo.save();
  res.status(201).json({ allPassed, status: wo.status, qc: wo.qc });
};

// PATCH /api/v1/work-orders/:id/qc-approve
exports.approveQc = async (req, res) => {
  const wo = await loadWO(req.params.id);
  if (wo.status !== "QC") throw httpError(409, "WO belum berstatus QC");
  if (!wo.qc.checklist.length || !wo.qc.checklist.every((c) => c.passed)) {
    throw httpError(409, "Semua checklist QC harus lulus sebelum disetujui");
  }
  wo.qc.approved = true;
  wo.qc.approvedBy = req.user._id;
  wo.qc.approvedAt = new Date();
  pushStatus(wo, "SELESAI", req.user._id); // siap ke Kasir
  await wo.save();

  await Vehicle.findByIdAndUpdate(wo.vehicle, {
    $push: { serviceHistory: { workOrder: wo._id, date: new Date(), note: wo.diagnosis || wo.complaint } },
  });
  res.json(wo);
};

// POST /api/v1/work-orders/:id/spareparts
// body: { action: "request"|"cancel"|"issue"|"return", sparepart, qty, itemId }
//  - request : mekanik/gudang mengajukan sparepart ke WO
//  - cancel  : batalkan pengajuan yang belum dikeluarkan (pengurangan)
//  - issue   : gudang mengeluarkan barang (stok berkurang)
//  - return  : gudang menerima barang kembali dari WO (stok bertambah)
exports.manageSpareparts = async (req, res) => {
  const { action = "request", sparepart, qty, itemId } = req.body;
  const wo = await loadWO(req.params.id);
  assertOpen(wo);
  if (await Invoice.exists({ workOrder: wo._id, status: { $ne: "VOID" } })) {
    throw httpError(409, "Invoice sudah dibuat, sparepart tidak bisa diubah");
  }
  const role = req.user.role;

  if (action === "request") {
    assertAssignedMechanic(req, wo);
    const n = Number(qty);
    if (!sparepart || !Number.isInteger(n) || n < 1) throw httpError(400, "sparepart dan qty (bilangan bulat > 0) wajib diisi");
    const part = await Sparepart.findById(sparepart);
    if (!part) throw httpError(404, "Sparepart tidak ditemukan");
    wo.spareparts.push({
      sparepart: part._id, qty: n, price: part.price, costPrice: part.costPrice,
      status: "REQUESTED", requestedBy: req.user._id,
    });
    await wo.save();
    return res.status(201).json(wo.spareparts[wo.spareparts.length - 1]);
  }

  if (!itemId) throw httpError(400, "itemId wajib diisi");
  const item = wo.spareparts.id(itemId);
  if (!item) throw httpError(404, "Item sparepart pada WO tidak ditemukan");

  if (action === "cancel") {
    assertAssignedMechanic(req, wo);
    const r = await WorkOrder.updateOne(
      { _id: wo._id, spareparts: { $elemMatch: { _id: item._id, status: "REQUESTED" } } },
      { $pull: { spareparts: { _id: item._id } } }
    );
    if (!r.modifiedCount) throw httpError(409, "Hanya pengajuan berstatus REQUESTED yang bisa dibatalkan");
    return res.json({ message: "Pengajuan dibatalkan" });
  }

  if (role !== "gudang") throw httpError(403, "Forbidden: hanya Gudang yang bisa issue/return");

  // klaim perubahan status secara atomik dulu agar tidak terjadi double issue/return
  const from = action === "issue" ? "REQUESTED" : action === "return" ? "ISSUED" : null;
  if (!from) throw httpError(400, "action tidak dikenal");
  const to = action === "issue" ? "ISSUED" : "RETURNED";
  const claim = await WorkOrder.updateOne(
    { _id: wo._id, spareparts: { $elemMatch: { _id: item._id, status: from } } },
    { $set: { "spareparts.$.status": to } }
  );
  if (!claim.modifiedCount) throw httpError(409, `Item harus berstatus ${from} untuk action ${action}`);

  const filter = { _id: item.sparepart };
  if (action === "issue") filter.stock = { $gte: item.qty };
  const updated = await Sparepart.findOneAndUpdate(
    filter,
    {
      $inc: { stock: action === "issue" ? -item.qty : item.qty },
      $push: { transactions: { type: action === "issue" ? "OUT" : "WO_RETURN", qty: item.qty, workOrder: wo._id, by: req.user._id } },
    },
    { new: true }
  );
  if (!updated) {
    await WorkOrder.updateOne({ _id: wo._id, "spareparts._id": item._id }, { $set: { "spareparts.$.status": from } }); // rollback
    throw httpError(409, "Stok tidak mencukupi");
  }
  res.json({ message: `Sparepart ${to}`, stock: updated.stock, lowStock: updated.stock <= updated.minStock });
};
