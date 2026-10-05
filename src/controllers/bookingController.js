const Booking = require("../models/Booking");
const Vehicle = require("../models/Vehicle");
const Customer = require("../models/Customer");
const User = require("../models/User");
const { rankMechanics, worksOnDay } = require("../services/mechanicService");
const { httpError, dayRangeWIB, todayWIB, getOwnCustomer } = require("../utils/helpers");

const WIB = 7 * 3600 * 1000;
const slotHours = () => {
  const s = parseInt(process.env.SLOT_START) || 8;
  const e = parseInt(process.env.SLOT_END) || 17;
  return Array.from({ length: Math.max(0, e - s) }, (_, i) => s + i);
};
const hourWIB = (d) => new Date(d.getTime() + WIB).getUTCHours();
const dateWIB = (d) => new Date(d.getTime() + WIB).toISOString().slice(0, 10);

const slotCapacityFor = async (start) => {
  const mechanics = await User.find({ role: "mekanik", isActive: true }).select("schedule");
  return mechanics.filter((m) => worksOnDay(m.schedule, start)).length;
};

// GET /api/v1/bookings/schedule?date=YYYY-MM-DD
exports.getSchedule = async (req, res) => {
  const date = req.query.date || todayWIB();
  const { start, end } = dayRangeWIB(date);
  const [capacity, bookings] = await Promise.all([
    slotCapacityFor(start),
    Booking.find({ scheduledAt: { $gte: start, $lt: end }, status: { $in: ["PENDING", "CONFIRMED"] } }).select("scheduledAt"),
  ]);
  const counts = {};
  bookings.forEach((b) => { const h = hourWIB(b.scheduledAt); counts[h] = (counts[h] || 0) + 1; });

  const now = Date.now();
  const slots = slotHours().map((h) => {
    const slotStart = new Date(start.getTime() + h * 3600 * 1000);
    const booked = counts[h] || 0;
    return {
      time: `${String(h).padStart(2, "0")}:00`,
      startsAt: slotStart,
      capacity,
      booked,
      available: slotStart.getTime() > now && booked < capacity,
    };
  });
  res.json({ date, slots });
};

// POST /api/v1/bookings
exports.createBooking = async (req, res) => {
  const { scheduledAt, serviceType, notes, mechanic } = req.body;
  const when = new Date(scheduledAt);
  if (!scheduledAt || isNaN(when)) throw httpError(400, "scheduledAt tidak valid");
  if (when.getTime() <= Date.now()) throw httpError(400, "Jadwal booking harus di masa depan");
  if (!slotHours().includes(hourWIB(when))) throw httpError(400, "Di luar jam operasional bengkel");

  // Tentukan pelanggan
  let customerId;
  if (req.user.role === "konsumen") {
    const own = await getOwnCustomer(req.user);
    if (!own) throw httpError(400, "Profil pelanggan belum ada");
    customerId = own._id;
  } else {
    customerId = req.body.customer;
    if (!customerId || !(await Customer.exists({ _id: customerId }))) throw httpError(404, "Pelanggan tidak ditemukan");
  }

  const vehicle = await Vehicle.findOne({ _id: req.body.vehicle, customer: customerId });
  if (!vehicle) throw httpError(404, "Kendaraan tidak ditemukan atau bukan milik pelanggan");

  // Cek kapasitas slot
  const hourStart = new Date(Math.floor(when.getTime() / 3600000) * 3600000);
  const dateStr = dateWIB(when);
  const { start } = dayRangeWIB(dateStr);
  const [capacity, used] = await Promise.all([
    slotCapacityFor(start),
    Booking.countDocuments({
      scheduledAt: { $gte: hourStart, $lt: new Date(hourStart.getTime() + 3600000) },
      status: { $in: ["PENDING", "CONFIRMED"] },
    }),
  ]);
  if (used >= capacity) throw httpError(409, "Slot sudah penuh, pilih jam lain");

  // Mekanik: pakai pilihan user, atau rekomendasi otomatis
  let recommendedMechanic = mechanic;
  if (recommendedMechanic) {
    if (!(await User.exists({ _id: recommendedMechanic, role: "mekanik", isActive: true }))) {
      throw httpError(400, "Mekanik tidak valid");
    }
  } else {
    const ranked = await rankMechanics({ dateStr, serviceType });
    recommendedMechanic = ranked[0]?.mechanic._id;
  }

  const booking = await Booking.create({
    customer: customerId, vehicle: vehicle._id, scheduledAt: when, serviceType, notes,
    recommendedMechanic, createdBy: req.user._id,
  });
  res.status(201).json(booking);
};

// GET /api/v1/bookings/smart-mechanic?date=YYYY-MM-DD&serviceType=
exports.smartMechanic = async (req, res) => {
  const ranked = await rankMechanics({ dateStr: req.query.date, serviceType: req.query.serviceType });
  res.json({ recommended: ranked[0] || null, candidates: ranked });
};

// PATCH /api/v1/bookings/:id/status   body: { status: "CONFIRMED" | "CANCELLED", reason }
exports.updateBookingStatus = async (req, res) => {
  const { status, reason } = req.body;
  if (!["CONFIRMED", "CANCELLED"].includes(status)) throw httpError(400, "status harus CONFIRMED atau CANCELLED");
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw httpError(404, "Booking tidak ditemukan");
  const allowed = { PENDING: ["CONFIRMED", "CANCELLED"], CONFIRMED: ["CANCELLED"] };
  if (!(allowed[booking.status] || []).includes(status)) {
    throw httpError(409, `Booking berstatus ${booking.status} tidak bisa diubah ke ${status}`);
  }
  booking.status = status;
  if (status === "CANCELLED") booking.cancelReason = reason;
  await booking.save();
  res.json(booking);
};
