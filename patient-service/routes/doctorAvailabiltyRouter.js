import { Router } from "express";
import { addDoctorAvailability } from "../controller/doctorAvailabiltyController.js";
const avilabiltyRouter=Router();
avilabiltyRouter.route('/add-availabilty/:id').post(addDoctorAvailability)
export default avilabiltyRouter;