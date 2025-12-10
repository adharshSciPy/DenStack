import Notification from "../Model/NotificationSchema.js";

export const getVendorNotifications = async (req, res) => {
    try {
        const { vendorId } = req.params;

        const notifications = await Notification.find({ vendorId })
            .sort({ createdAt: -1 });

        res.status(200).json({
            message: "Notifications fetched",
            data: notifications
        });

    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

export const markNotificationRead = async (req, res) => {
    try {
        const { id } = req.params;

        await Notification.findByIdAndUpdate(id, {
            isRead: true
        });

        res.status(200).json({
            message: "Notification marked as read"
        });

    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};