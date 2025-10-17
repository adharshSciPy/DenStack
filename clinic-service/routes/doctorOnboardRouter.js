import { Router } from "express";
import { addDoctorAvailability, clinicDoctorLogin, getAllActiveDoctorsOnClinic, getAvailability, getDoctorsBasedOnDepartment, getDoctorsWithAvailability, onboardDoctor, removeDoctorFromClinic, } from "../controller/doctorOnboardingController.js";
const doctorOnboard=Router();
doctorOnboard.route('/onboard-doctor').post(onboardDoctor)
doctorOnboard.route('/availability-doctor/:id').post(addDoctorAvailability)
doctorOnboard.route('/availability').get(getAvailability)
doctorOnboard.route('/department-based/availability').get(getDoctorsWithAvailability)
doctorOnboard.route('/clinic-doctor/login').post(clinicDoctorLogin)
doctorOnboard.route('/department-based').get(getDoctorsBasedOnDepartment)
doctorOnboard.route('/active-doctors').get(getAllActiveDoctorsOnClinic)// to fetch all active doctors inside the clinic
doctorOnboard.route('/remove/doctor-from-clinic').delete(removeDoctorFromClinic);// to remove doctor from clinic
export default doctorOnboard