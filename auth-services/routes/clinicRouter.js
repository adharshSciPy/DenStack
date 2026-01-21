import { Router } from "express";
import {
  editTheme,
  getTheme,
  loginClinic,
  registerClinic,
  viewAllClinics,
  viewClinicById,
  editClinic,
  getClinicStaffs,
  subscribeClinic,
  getClinicDashboardDetails,
  addShiftToStaff,
  removeStaffFromClinic,
  getClinicStaffCounts,
  registerSubClinic,
  assignClinicLab,
  clicnicCount,
  allClinicsStatus,
  getSubscriptionStats,
  toggleClinicAccess,
  upgradeSubscription,
  uploadClinicLogo,
  getSubClinics,
  deleteLogo,
  updateSubClinic,
  loginSubClinic
} from "../controller/clinicController.js";
import clinicAuth from "../middleware/clinicAuth.js"
import upload from "../middleware/upload.js";
import clinicSubscriptionCheck from "../middleware/clinicSubscriptionCheck.js"
const clinicAuthRoutes = Router();
clinicAuthRoutes.route("/register").post(registerClinic);
clinicAuthRoutes.route("/login").post(loginClinic);
clinicAuthRoutes.route("/allclinics").get(viewAllClinics);
clinicAuthRoutes.route("/view-clinic/:id").get(viewClinicById);
clinicAuthRoutes.route("/editClinic/:id").put(editClinic);
clinicAuthRoutes.route("/all-staffs/:id").get(getClinicStaffs);

clinicAuthRoutes.route("/gettheme/:clinicId").get(getTheme);
clinicAuthRoutes.route("/updateTheme/:clinicId").patch(editTheme);
clinicAuthRoutes.route("/subscribe/:id").post(subscribeClinic); //id:clinicId
clinicAuthRoutes.route("/dashboard/:id").get(getClinicDashboardDetails); //id:clinicId this api is used to fetch dashboard details like total staffs,total patients,total appointments,todays appointments
clinicAuthRoutes.route("/staff/add-shift/:id").patch(addShiftToStaff); //need to pass staff id and role like nurse for Nurse and pharmacist for Pharmacist in req body
clinicAuthRoutes.route("/staff/remove/:id").delete(removeStaffFromClinic); //{id:clinicId}need to pass staff id and role like nurse for Nurse and pharmacist for Pharmacist in req body
clinicAuthRoutes.route("/getStaff/:id").get(getClinicStaffCounts); //to get staff details
// clinicAuthRoutes.route("/register-subclinic/:id").post(registerSubClinic);
clinicAuthRoutes.route("/add-ownlabs/:id").patch(assignClinicLab);
clinicAuthRoutes.route("/clicnicCount").get(clicnicCount);
clinicAuthRoutes.route("/allClinicsStatus").get(allClinicsStatus);
clinicAuthRoutes.route("/clinicSubscriptionCount").get(getSubscriptionStats);
clinicAuthRoutes
  .route("/toggleClinicAccess/:clinicId")
  .patch(toggleClinicAccess);
clinicAuthRoutes.post("/upgrade", clinicAuth, upgradeSubscription);
clinicAuthRoutes.post(
  "/upload-logo",
  clinicAuth,
  upload.single("logo"),
  uploadClinicLogo
);

clinicAuthRoutes.get(
  "/:parentClinicId/sub-clinic",
  clinicAuth,
  getSubClinics
);

clinicAuthRoutes.patch(
  "/sub-clinic/:subClinicId",
  clinicAuth,
  updateSubClinic
);

clinicAuthRoutes.post(
  "/register-subclinic/:id",
  clinicSubscriptionCheck,
  registerSubClinic
);

clinicAuthRoutes.post(
  "/login-subclinic/:id",
  clinicAuth,
  loginSubClinic
);
clinicAuthRoutes.route("/delete-logo").delete(clinicAuth,deleteLogo)
export default clinicAuthRoutes;
