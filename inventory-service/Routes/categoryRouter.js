import { Router } from "express"
import { createCategory, categoryDetails, deleteCategory } from "../Controller/categoryController.js"
const categoryRoute = Router()

categoryRoute.route("/createCategory").post(createCategory)
categoryRoute.route("/categoryDetails").get(categoryDetails)
categoryRoute.route("/deleteCategory/:id").delete(deleteCategory)

export default categoryRoute;
