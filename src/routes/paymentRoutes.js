const router = require("express").Router();
const c = require("../controllers/paymentController");
const { protect } = require("../middleware/auth");
const { authorize } = require("../middleware/role");

router.use(protect, authorize("kasir"));
router.post("/", c.createPayment);
router.post("/:id/refund", c.refundOrVoid);

module.exports = router;
