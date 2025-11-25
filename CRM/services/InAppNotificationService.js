import InAppNotification from "../model/inAppNotificationModel.js";
import { emitToUser } from "../utils/socket.js";

class InAppNotificationService {
  
  async createNotification({ userId, userRole, type, title, message, appointmentId, patientId, clinicId, metadata }) {
    try {
      const notification = new InAppNotification({
        userId,
        userRole,
        type,
        title,
        message,
        appointmentId,
        patientId,
        clinicId,
        metadata,
        isRead: false
      });
      
      await notification.save();
      console.log(`✅ In-app notification created for user ${userId}`);
      
      const emitted = emitToUser(userId, "new_notification", {
        id: notification._id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        appointmentId: notification.appointmentId,
        patientId: notification.patientId,
        clinicId: notification.clinicId,
        metadata: notification.metadata,
        createdAt: notification.createdAt,
        isRead: false
      });
      
      if (emitted) {
        console.log(`🔔 Real-time notification sent to user ${userId}`);
      } else {
        console.log(`📫 User ${userId} offline - notification saved`);
      }
      
      return notification;
      
    } catch (error) {
      console.error("❌ Error creating in-app notification:", error);
      throw error;
    }
  }
  
  async getNotifications(userId, { limit = 20, skip = 0, unreadOnly = false }) {
    try {
      const query = { userId };
      if (unreadOnly) {
        query.isRead = false;
      }
      
      const notifications = await InAppNotification.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean();
      
      const unreadCount = await InAppNotification.countDocuments({ 
        userId, 
        isRead: false 
      });
      
      return { notifications, unreadCount };
      
    } catch (error) {
      console.error("❌ Error fetching notifications:", error);
      throw error;
    }
  }
  
  async markAsRead(notificationId, userId) {
    try {
      const notification = await InAppNotification.findOneAndUpdate(
        { _id: notificationId, userId },
        { isRead: true, readAt: new Date() },
        { new: true }
      );
      
      return notification;
      
    } catch (error) {
      console.error("❌ Error marking notification as read:", error);
      throw error;
    }
  }
  
  async markAllAsRead(userId) {
    try {
      const result = await InAppNotification.updateMany(
        { userId, isRead: false },
        { isRead: true, readAt: new Date() }
      );
      
      console.log(`✅ Marked ${result.modifiedCount} notifications as read`);
      return result;
      
    } catch (error) {
      console.error("❌ Error marking all as read:", error);
      throw error;
    }
  }
}

export default new InAppNotificationService();