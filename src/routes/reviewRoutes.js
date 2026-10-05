const router = require("express").Router();
const c = require("../controllers/crmController");
const { protect } = require("../middleware/auth");
const { authorize } = require("../middleware/role");

router.post("/", protect, authorize("konsumen"), c.createReview);

module.exports = router;
