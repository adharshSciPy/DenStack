import express from "express";

import {
  addLabInventory,
  getAllLabInventory,
  getLabInventoryByLab,
  patchLabInventory,
  deleteLabInventory,
  getLowStockProducts,
} from "../controller/LabInventoryController.js";

import {
  verifyAuthToken,
  authorizeRoles,
  allowLabAccess,
} from "../middleware/roleAuthMiddleware.js";

const labInventoryRouter = express.Router();

const SUPER_ADMIN = process.env.SUPERADMIN_ROLE;
const CLINIC_ROLE = process.env.CLINC_ROLE;

/*
|--------------------------------------------------------------------------
| LAB INVENTORY ROUTES
|--------------------------------------------------------------------------
| SUPER ADMIN (800) and CLINIC (700) can:
| - Add new inventory
| - Update inventory
| - Delete inventory
| - Get inventory lists
|--------------------------------------------------------------------------
*/

// ➤ Add new item OR increase quantity
labInventoryRouter.post(
  "/add",
  // verifyAuthToken,
  // authorizeRoles(SUPER_ADMIN, CLINIC_ROLE),
  addLabInventory
);

// ➤ Update single inventory item
labInventoryRouter.patch(
  "/update/:id",
  verifyAuthToken,
  authorizeRoles(SUPER_ADMIN, CLINIC_ROLE),
  allowLabAccess,
  patchLabInventory
);

// ➤ Delete an item
labInventoryRouter.delete(
  "/delete/:id",
  verifyAuthToken,
  authorizeRoles(SUPER_ADMIN, CLINIC_ROLE),
  deleteLabInventory
);

// ➤ Get all lab inventory
labInventoryRouter.get(
  "/getall",
  verifyAuthToken,
  authorizeRoles(SUPER_ADMIN, CLINIC_ROLE),
  getAllLabInventory
);

// ➤ Get low-stock items
labInventoryRouter.get(
  "/lowstock",
  verifyAuthToken,
  authorizeRoles(SUPER_ADMIN, CLINIC_ROLE),
  getLowStockProducts
);

// ➤ Get inventory by specific lab
labInventoryRouter.get(
  "/lab/:labId",
  verifyAuthToken,
  authorizeRoles(SUPER_ADMIN, CLINIC_ROLE),
  getLabInventoryByLab
);

export default labInventoryRouter;
