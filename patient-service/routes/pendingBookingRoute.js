import { Router } from "express";
import { autoProcessBooking, getPendingBookings, rejectBooking, submitBookingRequest } from "../controller/pendingBookingController.js";

const pendingBookingRouter = Router();
pendingBookingRouter.route("/public/booking/submit/:clinicId").post(submitBookingRequest);
pendingBookingRouter.route('/pending-bookings/:clinicId').get(getPendingBookings);
pendingBookingRouter.route("/pending-bookings/process/:bookingId").post(autoProcessBooking);
pendingBookingRouter.route("/pending-bookings/reject/:bookingId").post(rejectBooking);
export default pendingBookingRouter;