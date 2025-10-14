import express from "express";
import {createMedicine, getMedicines, updateMedicine, deleteMedicine} from "../controller/medicineController.js";

const  medicineRouter = express.Router();

medicineRouter.route("/register-medicine").post(createMedicine);
medicineRouter.route("/allmedicines").get(getMedicines);
medicineRouter.route("/medicines/update/:id").patch(updateMedicine);
medicineRouter.route("/medicines/delete/:id").delete(deleteMedicine);

export default medicineRouter;