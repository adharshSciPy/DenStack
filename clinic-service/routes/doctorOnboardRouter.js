import { Router } from "express";
import { addDoctorAvailability, clinicDoctorLogin, getAllActiveDoctorsOnClinic, getAvailability, getDoctorsBasedOnDepartment, onboardDoctor, } from "../controller/doctorOnboardingController.js";
const doctorOnboard=Router();
doctorOnboard.route('/onboard-doctor').post(onboardDoctor)
doctorOnboard.route('/availability-doctor/:id').post(addDoctorAvailability)
doctorOnboard.route('/availability').get(getAvailability)
doctorOnboard.route('/clinic-doctor/login').post(clinicDoctorLogin)
doctorOnboard.route('/department-based').get(getDoctorsBasedOnDepartment)
doctorOnboard.route('/active-doctors').get(getAllActiveDoctorsOnClinic)// to fetch all active doctors inside the clinic





export default doctorOnboard