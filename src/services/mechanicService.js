const User = require("../models/User");
const WorkOrder = require("../models/WorkOrder");
const Booking = require("../models/Booking");
const Review = require("../models/Review");
const { dayRangeWIB, todayWIB, weekdayWIB } = require("../utils/helpers");

const ACTIVE_WO = ["DRAFT", "DIKERJAKAN", "QC"];
const DEFAULT_CAPACITY = 5;
const DAY_ALIASES = [
  ["minggu", "ahad", "sun"], ["senin", "mon"], ["selasa", "tue"], ["rabu", "wed"],
  ["kamis", "thu"], ["jumat", "jum'at", "fri"], ["sabtu", "sat"],
];

// schedule kosong = tersedia setiap hari. Contoh isi: ["Senin 08:00-16:00", "Selasa"]
const worksOnDay = (schedule, date) => {
  if (!schedule || !schedule.length) return true;
  const aliases = DAY_ALIASES[weekdayWIB(date)];
  return schedule.some((s) => aliases.some((a) => String(s).toLowerCase().includes(a)));
};

// Jumlah WO aktif per mekanik -> Map<mechanicId, number>
exports.getActiveWorkload = async () => {
  const rows = await WorkOrder.aggregate([
    { $match: { status: { $in: ACTIVE_WO }, mechanic: { $ne: null } } },
    { $group: { _id: "$mechanic", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
};

const getBookingLoad = async (start, end) => {
  const rows = await Booking.aggregate([
    {
      $match: {
        status: { $in: ["PENDING", "CONFIRMED"] },
        scheduledAt: { $gte: start, $lt: end },
        recommendedMechanic: { $ne: null },
      },
    },
    { $group: { _id: "$recommendedMechanic", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
};

const getRatings = async () => {
  const rows = await Review.aggregate([
    { $match: { mechanic: { $ne: null } } },
    { $group: { _id: "$mechanic", avg: { $avg: { $ifNull: ["$mechanicRating", "$rating"] } }, count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), { avg: r.avg, count: r.count }]));
};

/**
 * Algoritma Smart Mekanik.
 * Skor = sisa kapasitas * 10 + (spesialisasi cocok ? 20 : 0) + rating rata-rata * 2
 * Mekanik nonaktif, tidak masuk jadwal, atau kapasitas penuh tidak direkomendasikan.
 */
exports.rankMechanics = async ({ dateStr, serviceType } = {}) => {
  dateStr = dateStr || todayWIB();
  const { start, end } = dayRangeWIB(dateStr);
  const isToday = dateStr === todayWIB();

  const [mechanics, active, booked, ratings] = await Promise.all([
    User.find({ role: "mekanik", isActive: true }),
    isToday ? exports.getActiveWorkload() : new Map(),
    getBookingLoad(start, end),
    getRatings(),
  ]);

  const ranked = mechanics
    .filter((m) => worksOnDay(m.schedule, start))
    .map((m) => {
      const id = String(m._id);
      const capacity = m.capacity ?? DEFAULT_CAPACITY;
      const load = (active.get(id) || 0) + (booked.get(id) || 0);
      const free = capacity - load;
      const specMatch = !!serviceType &&
        (m.specialization || []).some((s) => String(s).toLowerCase() === String(serviceType).toLowerCase());
      const rating = ratings.get(id);
      const score = free * 10 + (specMatch ? 20 : 0) + (rating ? rating.avg * 2 : 0);
      return {
        mechanic: { _id: m._id, name: m.name, specialization: m.specialization, phone: m.phone },
        capacity, load, freeSlots: free, specializationMatch: specMatch,
        rating: rating ? Number(rating.avg.toFixed(2)) : null, score: Number(score.toFixed(2)),
      };
    })
    .filter((r) => r.freeSlots > 0)
    .sort((a, b) => b.score - a.score);

  return ranked;
};

exports.ACTIVE_WO = ACTIVE_WO;
exports.DEFAULT_CAPACITY = DEFAULT_CAPACITY;
exports.worksOnDay = worksOnDay;
