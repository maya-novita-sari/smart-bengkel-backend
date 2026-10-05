const User = require("../models/User");
const bcrypt = require("bcryptjs");
const { getActiveWorkload, DEFAULT_CAPACITY } = require("../services/mechanicService");
const { httpError } = require("../utils/helpers");

// GET /api/v1/users/mechanics  -> daftar mekanik + jam kerja, status, workload
exports.getMechanics = async (req, res) => {
  const [mechanics, workload] = await Promise.all([User.find({ role: "mekanik" }), getActiveWorkload()]);
  res.json(
    mechanics.map((m) => {
      const load = workload.get(String(m._id)) || 0;
      const capacity = m.capacity ?? DEFAULT_CAPACITY;
      return {
        ...m.toObject(),
        workload: load,
        status: !m.isActive ? "NONAKTIF" : load >= capacity ? "OVERLOAD" : load > 0 ? "SIBUK" : "TERSEDIA",
      };
    })
  );
};

// POST /api/v1/users/mechanics
exports.createMechanic = async (req, res) => {
  const { name, email, password, phone, specialization, capacity, schedule } = req.body;
  if (!name || !email || !password) throw httpError(400, "name, email, dan password wajib diisi");
  const hashed = await bcrypt.hash(password, 10);
  const mechanic = await User.create({
    name, email, password: hashed, phone, role: "mekanik", specialization, capacity, schedule,
  });
  const obj = mechanic.toObject();
  delete obj.password;
  res.status(201).json(obj);
};

// PUT /api/v1/users/mechanics/:id
exports.updateMechanic = async (req, res) => {
  const allowed = ["specialization", "capacity", "schedule", "isActive", "phone"];
  const update = {};
  for (const k of allowed) if (req.body[k] !== undefined) update[k] = req.body[k];
  const mechanic = await User.findOneAndUpdate({ _id: req.params.id, role: "mekanik" }, update, {
    new: true, runValidators: true,
  });
  if (!mechanic) throw httpError(404, "Mekanik tidak ditemukan");
  res.json(mechanic);
};
