import { Router } from "express"
import { createCategory, categoryDetails, deleteCategory } from "../Controller/categoryController.js"
import { verifyAuthToken, authorizeRoles } from "../middlewares/authmiddleware.js"
const SUPER_ADMIN = process.env.SUPERADMIN_ROLE

const categoryRoute = Router()

categoryRoute.post("/createCategory", verifyAuthToken, authorizeRoles(SUPER_ADMIN), createCategory)
categoryRoute.get("/categoryDetails", verifyAuthToken, authorizeRoles(SUPER_ADMIN), categoryDetails)
categoryRoute.delete("/deleteCategory/:id", verifyAuthToken, authorizeRoles(SUPER_ADMIN), deleteCategory)

export default categoryRoute;
