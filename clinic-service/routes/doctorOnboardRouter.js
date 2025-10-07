import { Router } from "express";
import { addDoctorAvailability, getAvailability, onboardDoctor } from "../controller/doctorOnboardingController.js";
const doctorOnboard=Router();
doctorOnboard.route('/onboard-doctor').post(onboardDoctor)
doctorOnboard.route('/availability-doctor/:id').post(addDoctorAvailability)
doctorOnboard.route('/availability').get(getAvailability)


export default doctorOnboard