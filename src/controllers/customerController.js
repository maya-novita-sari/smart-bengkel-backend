const Customer = require("../models/Customer");
const Vehicle = require("../models/Vehicle");
const WorkOrder = require("../models/WorkOrder");
const { httpError, escapeRegex, paginate, getOwnCustomer, assertCustomerAccess } = require("../utils/helpers");

// GET /api/v1/customers?q=&page=&limit=
exports.getCustomers = async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const filter = {};
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), "i");
    filter.$or = [{ name: rx }, { phone: rx }, { email: rx }];
  }
  const [data, total] = await Promise.all([
    Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Customer.countDocuments(filter),
  ]);
  res.json({ data, page, limit, total });
};

// POST /api/v1/customers
exports.createCustomer = async (req, res) => {
  const { name, phone, email, address } = req.body;
  if (!name || !phone) throw httpError(400, "name dan phone wajib diisi");
  const customer = await Customer.create({ name, phone, email, address });
  res.status(201).json(customer);
};

// GET /api/v1/customers/:id/vehicles
exports.getCustomerVehicles = async (req, res) => {
  await assertCustomerAccess(req.user, req.params.id);
  const vehicles = await Vehicle.find({ customer: req.params.id }).select("-serviceHistory");
  res.json(vehicles);
};

// POST /api/v1/vehicles
exports.createVehicle = async (req, res) => {
  const { plateNumber, brand, model, year, odometerKm } = req.body;
  if (!plateNumber) throw httpError(400, "plateNumber wajib diisi");
  let customerId = req.body.customer;
  if (req.user.role === "konsumen") {
    const own = await getOwnCustomer(req.user);
    if (!own) throw httpError(400, "Profil pelanggan belum ada");
    customerId = own._id;
  } else {
    if (!customerId) throw httpError(400, "customer wajib diisi");
    if (!(await Customer.exists({ _id: customerId }))) throw httpError(404, "Pelanggan tidak ditemukan");
  }
  const vehicle = await Vehicle.create({
    customer: customerId,
    plateNumber: String(plateNumber).replace(/\s+/g, "").toUpperCase(),
    brand, model, year, odometerKm,
  });
  res.status(201).json(vehicle);
};

// GET /api/v1/vehicles/:id/history
exports.getVehicleHistory = async (req, res) => {
  const vehicle = await Vehicle.findById(req.params.id);
  if (!vehicle) throw httpError(404, "Kendaraan tidak ditemukan");
  await assertCustomerAccess(req.user, vehicle.customer);

  const orders = await WorkOrder.find({ vehicle: vehicle._id, status: "SELESAI" })
    .sort({ createdAt: -1 })
    .select("woNumber complaint diagnosis recommendation services spareparts odometerKm mechanic createdAt updatedAt")
    .populate("mechanic", "name")
    .populate("spareparts.sparepart", "name code");

  res.json({
    vehicle: {
      _id: vehicle._id, plateNumber: vehicle.plateNumber, brand: vehicle.brand,
      model: vehicle.model, year: vehicle.year, odometerKm: vehicle.odometerKm,
    },
    history: orders,
  });
};
