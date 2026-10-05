exports.notFound = (req, res) =>
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} tidak ditemukan` });

// eslint-disable-next-line no-unused-vars
exports.errorHandler = (err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message || "Server error";

  if (err.name === "CastError") { status = 400; message = `ID/field tidak valid: ${err.path}`; }
  else if (err.name === "ValidationError") { status = 400; message = Object.values(err.errors).map((e) => e.message).join(", "); }
  else if (err.code === 11000) { status = 409; message = `Data duplikat: ${Object.keys(err.keyValue || {}).join(", ")}`; }
  else if (err.name === "MulterError") { status = 400; }

  if (status >= 500) console.error(err);
  res.status(status).json({ message });
};
