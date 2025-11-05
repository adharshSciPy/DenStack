// ================================
// routes/notificationRoutes.js
// ================================
import { Router } from "express";
import {
  sendAppointmentConfirmation,
  sendAppointmentReminder,
  sendTokenReadyNotification,
  getNotificationLogs,
  getTemplates,
  createTemplate
} from "../controller/notificationController.js";

const notificationRoutes = Router();

// Send notifications
notificationRoutes.route('/send-confirmation').post(sendAppointmentConfirmation);
notificationRoutes.route('/send-reminder').post(sendAppointmentReminder);
notificationRoutes.route('/send-token-ready').post(sendTokenReadyNotification);

// Get logs and templates
notificationRoutes.route('/logs/:clinicId').get(getNotificationLogs);
notificationRoutes.route('/templates/:clinicId').get(getTemplates);
notificationRoutes.route('/templates').post(createTemplate);

export default notificationRoutes;