import express from "express";
import {
  distributeToDepartment,
  getDepartmentInventory,
} from "../controller/clinicDistributionController.js";

const clinicDistributionRouter = express.Router();

clinicDistributionRouter.post(
  "/distribute-to-department",
  distributeToDepartment
);
clinicDistributionRouter.get(
  "/department-inventory/:clinicId/:departmentId",
  getDepartmentInventory
);

export default clinicDistributionRouter;