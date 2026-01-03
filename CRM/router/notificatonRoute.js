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
  createTemplate,
  triggerBirthdayWishes,
  sendTestBirthdayWish,
  getUpcomingBirthdays,
} from "../controller/notificationController.js";
import 
  InAppNotificationService
 from "../services/InAppNotificationService.js"

const notificationRoutes = Router();

// Send notifications
notificationRoutes.route('/send-confirmation').post(sendAppointmentConfirmation);
notificationRoutes.route('/send-reminder').post(sendAppointmentReminder);
notificationRoutes.route('/send-token-ready').post(sendTokenReadyNotification);

// Get logs and templates
notificationRoutes.route('/logs/:clinicId').get(getNotificationLogs);
notificationRoutes.route('/templates/:clinicId').get(getTemplates);
notificationRoutes.route('/templates').post(createTemplate);
notificationRoutes.route('/in-app/:userId').get(async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, skip = 0, unreadOnly = false } = req.query;
    
    const result = await InAppNotificationService.getNotifications(userId, {
      limit: parseInt(limit),
      skip: parseInt(skip),
      unreadOnly: unreadOnly === 'true'
    });
    
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Mark as read
notificationRoutes.route('/in-app/:notificationId/read').patch(async (req, res) => {
  try {
    const { notificationId } = req.params;
    const { userId } = req.body;
    
    const notification = await InAppNotificationService.markAsRead(notificationId, userId);
    
    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }
    
    return res.status(200).json({ success: true, notification });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Mark all as read
notificationRoutes.route('/in-app/:userId/read-all').patch(async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await InAppNotificationService.markAllAsRead(userId);
    
    return res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      count: result.modifiedCount
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Birthday routes
notificationRoutes.route('/birthday/trigger').post(triggerBirthdayWishes);
notificationRoutes.route('/birthday/test').post(sendTestBirthdayWish);
notificationRoutes.route('/birthday/upcoming/:clinicId').get(getUpcomingBirthdays);


export default notificationRoutes;