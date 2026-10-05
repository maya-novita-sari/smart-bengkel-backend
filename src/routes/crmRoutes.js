const router = require("express").Router();
const c = require("../controllers/crmController");
const { protect } = require("../middleware/auth");
const { authorize } = require("../middleware/role");

router.get("/loyalty/:customerId", protect, authorize("konsumen", "sa"), c.getLoyalty);

module.exports = router;
