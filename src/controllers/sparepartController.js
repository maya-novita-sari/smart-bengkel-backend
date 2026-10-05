const Sparepart = require("../models/Sparepart");
const { httpError, escapeRegex, paginate } = require("../utils/helpers");

// GET /api/v1/spareparts?q=&lowStock=true
exports.getSpareparts = async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const filter = {};
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), "i");
    filter.$or = [{ name: rx }, { code: rx }, { rackLocation: rx }];
  }
  if (req.query.lowStock === "true") filter.$expr = { $lte: ["$stock", "$minStock"] };
  const [data, total] = await Promise.all([
    Sparepart.find(filter).select("-transactions").sort({ name: 1 }).skip(skip).limit(limit),
    Sparepart.countDocuments(filter),
  ]);
  res.json({ data, page, limit, total });
};

// POST /api/v1/spareparts
exports.createSparepart = async (req, res) => {
  const { name, code, price, costPrice, stock = 0, minStock, rackLocation } = req.body;
  if (!name || !code || price === undefined) throw httpError(400, "name, code, dan price wajib diisi");
  const part = await Sparepart.create({
    name, code: String(code).toUpperCase(), price, costPrice, stock, minStock, rackLocation,
    transactions: stock > 0 ? [{ type: "IN", qty: stock, note: "Stok awal", by: req.user._id }] : [],
  });
  res.status(201).json(part);
};

// PUT /api/v1/spareparts/:id   (harga, minimum stok, lokasi rak)
exports.updateSparepart = async (req, res) => {
  const update = {};
  for (const k of ["name", "price", "costPrice", "minStock", "rackLocation"]) {
    if (req.body[k] !== undefined) update[k] = req.body[k];
  }
  const part = await Sparepart.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).select("-transactions");
  if (!part) throw httpError(404, "Sparepart tidak ditemukan");
  res.json(part);
};

// POST /api/v1/spareparts/transactions
// body: { sparepart, type: "IN"|"RETURN"|"OPNAME", qty, note }
//  IN = barang masuk, RETURN = retur ke supplier (stok berkurang), OPNAME = qty adalah stok fisik hasil hitung
exports.createTransaction = async (req, res) => {
  const { sparepart, type, qty, note } = req.body;
  const n = Number(qty);
  if (!sparepart) throw httpError(400, "sparepart wajib diisi");
  if (!["IN", "RETURN", "OPNAME"].includes(type)) throw httpError(400, "type harus IN, RETURN, atau OPNAME");
  if (!Number.isInteger(n) || n < (type === "OPNAME" ? 0 : 1)) throw httpError(400, "qty harus bilangan bulat yang valid");

  const tx = { type, qty: n, note, by: req.user._id };
  let part;

  if (type === "IN") {
    part = await Sparepart.findByIdAndUpdate(sparepart, { $inc: { stock: n }, $push: { transactions: tx } }, { new: true });
  } else if (type === "RETURN") {
    part = await Sparepart.findOneAndUpdate(
      { _id: sparepart, stock: { $gte: n } },
      { $inc: { stock: -n }, $push: { transactions: tx } },
      { new: true }
    );
    if (!part && (await Sparepart.exists({ _id: sparepart }))) throw httpError(409, "Stok tidak mencukupi untuk diretur");
  } else {
    const current = await Sparepart.findById(sparepart).select("stock");
    if (!current) throw httpError(404, "Sparepart tidak ditemukan");
    tx.note = `${note ? note + " | " : ""}Sistem: ${current.stock}, fisik: ${n}, selisih: ${n - current.stock}`;
    part = await Sparepart.findByIdAndUpdate(sparepart, { $set: { stock: n }, $push: { transactions: tx } }, { new: true });
  }
  if (!part) throw httpError(404, "Sparepart tidak ditemukan");
  res.status(201).json({ sparepart: part._id, stock: part.stock, lowStock: part.stock <= part.minStock, transaction: part.transactions.at(-1) });
};
