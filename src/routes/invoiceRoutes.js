const router = require("express").Router();
const c = require("../controllers/invoiceController");
const { protect } = require("../middleware/auth");
const { authorize } = require("../middleware/role");

router.use(protect);
router.post("/generate/:woId", authorize("kasir"), c.generateInvoice);
router.get("/:id", authorize("kasir", "konsumen"), c.getInvoice);

module.exports = router;
