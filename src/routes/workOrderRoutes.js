const router = require("express").Router();
const c = require("../controllers/workOrderController");
const { protect } = require("../middleware/auth");
const { authorize } = require("../middleware/role");
const upload = require("../middleware/upload");
const { INTERNAL_ROLES } = require("../utils/helpers");

router.use(protect);
router.post("/", authorize("sa"), c.createWorkOrder);
router.get("/", authorize("sa", "mekanik", "kasir", "owner", "kepala_bengkel"), c.getWorkOrders);
router.get("/:id", authorize(...INTERNAL_ROLES), c.getWorkOrder);
router.patch("/:id/assign", authorize("kepala_bengkel"), c.assignMechanic);
router.post("/:id/dvi", authorize("sa"), c.saveDvi);
router.post("/:id/diagnosis", authorize("mekanik"), c.saveDiagnosis);
router.post("/:id/media", authorize("mekanik"), upload.array("files", 10), c.uploadMedia);
router.patch("/:id/status", authorize("mekanik", "sa"), c.updateStatus);
// QC
router.post("/:id/qc", authorize("kepala_bengkel"), c.submitQc);
router.patch("/:id/qc-approve", authorize("kepala_bengkel"), c.approveQc);
// Sparepart berbasis WO
router.post("/:id/spareparts", authorize("mekanik", "gudang"), c.manageSpareparts);

module.exports = router;
