import { Router } from "express"
import { createCategory, getmainCategory, getSubCategory, getAllCategory, deleteCategory, categoryProducts, getCategoryDashboard } from "../Controller/categoryController.js"
import { verifyAuthToken, authorizeRoles } from "../middlewares/authmiddleware.js"
const SUPER_ADMIN = process.env.SUPERADMIN_ROLE
const CLINIC_ROLE = process.env.CLINIC_ROLE

const categoryRoute = Router()

categoryRoute.post("/createCategory", verifyAuthToken, authorizeRoles(SUPER_ADMIN, CLINIC_ROLE), createCategory)
categoryRoute.get("/getAllCategory", verifyAuthToken, authorizeRoles(SUPER_ADMIN, CLINIC_ROLE), getAllCategory)
categoryRoute.get("/maincategories", verifyAuthToken, authorizeRoles(SUPER_ADMIN, CLINIC_ROLE), getmainCategory)
categoryRoute.get("/getSubCategories/:id", verifyAuthToken, authorizeRoles(SUPER_ADMIN, CLINIC_ROLE), getSubCategory)
categoryRoute.delete("/deleteCategory/:id", verifyAuthToken, authorizeRoles(SUPER_ADMIN, CLINIC_ROLE), deleteCategory)
categoryRoute.get("/categoryProducts", verifyAuthToken, authorizeRoles(SUPER_ADMIN), categoryProducts)
categoryRoute.get("/categoryDashboard", verifyAuthToken, authorizeRoles(SUPER_ADMIN), getCategoryDashboard)

export default categoryRoute;
