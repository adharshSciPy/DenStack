import SubscriptionModel from "../models/subscriptionSchema.js";

export const getAdminDashboard = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Fetch all subscriptions (non-deleted)
    const subscriptions = await SubscriptionModel.find({
      isDeleted: false,
      "subscription.startDate": { $exists: true },
    });

    let monthlyRevenue = 0;
    let activeSubscriptions = 0;
    let pendingRenewals = 0;
    let churnedCount = 0;

    const revenueByMonth = {};
    const subsByMonth = {};
    const churnByMonth = {};
    const planPerformance = {};

    subscriptions.forEach((subscription) => {
      const sub = subscription.subscription;

      if (!sub || !sub.startDate || !sub.price) return;

      const start = new Date(sub.startDate);
      const end = new Date(sub.endDate);

      const startMonthKey = `${start.getFullYear()}-${String(
        start.getMonth() + 1
      ).padStart(2, "0")}`;
      const endMonthKey = `${end.getFullYear()}-${String(
        end.getMonth() + 1
      ).padStart(2, "0")}`;

      // =============== MONTHLY REVENUE =============== //
      if (start >= startOfMonth && start <= now) {
        monthlyRevenue += sub.price;
      }

      // =============== ACTIVE SUBSCRIPTIONS =============== //
      if (sub.isActive === true) {
        activeSubscriptions++;
      }

      // =============== PENDING RENEWALS (within 7 days) =============== //
      const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 7 && daysLeft >= 0) pendingRenewals++;

      // =============== CHURN =============== //
      if (sub.isActive === false) {
        churnedCount++;
      }

      // =============== Revenue Trend =============== //
      revenueByMonth[startMonthKey] =
        (revenueByMonth[startMonthKey] || 0) + sub.price;

      // =============== Subscription Health =============== //
      subsByMonth[startMonthKey] = (subsByMonth[startMonthKey] || 0) + 1;

      if (sub.isActive === false) {
        churnByMonth[endMonthKey] = (churnByMonth[endMonthKey] || 0) + 1;
      }

      // =============== Plan Performance =============== //
      const plan = sub.package;
      planPerformance[plan] = planPerformance[plan] || {
        total: 0,
        active: 0,
        churned: 0,
        revenue: 0,
      };

      planPerformance[plan].total++;
      planPerformance[plan].revenue += sub.price;
      if (sub.isActive) planPerformance[plan].active++;
      else planPerformance[plan].churned++;
    });

    // =============== CHART FORMAT =============== //
    const revenueTrend = Object.keys(revenueByMonth)
      .sort()
      .map((month) => ({
        month,
        total: revenueByMonth[month],
      }));

    const subscriptionHealth = Object.keys(subsByMonth)
      .sort()
      .map((month) => ({
        month,
        new: subsByMonth[month],
        churned: churnByMonth[month] || 0,
      }));

    const churnTrend = Object.keys(churnByMonth)
      .sort()
      .map((month) => ({
        month,
        churned: churnByMonth[month],
      }));

    const churnRate =
      activeSubscriptions + churnedCount > 0
        ? Number(
            (
              (churnedCount / (activeSubscriptions + churnedCount)) *
              100
            ).toFixed(2)
          )
        : 0;

    // ===== UPCOMING RENEWALS (NEXT 30 DAYS) =====
    const upcomingRenewals = [];

    subscriptions.forEach((subscription) => {
      const sub = subscription.subscription;
      if (!sub || !sub.endDate) return;

      const endDate = new Date(sub.endDate);
      const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

      if (daysLeft >= 0 && daysLeft <= 30) {
        upcomingRenewals.push({
          clinicId: subscription.clinicId,
          clinicName: subscription.clinicName,
          plan: sub.package,
          price: sub.price,
          endDate,
          daysLeft,
          status: sub.isActive ? "active" : "expired",
        });
      }
    });

    // Sort by days left (ascending)
    upcomingRenewals.sort((a, b) => a.daysLeft - b.daysLeft);

    // =============== SEND RESPONSE =============== //
    res.json({
      monthlyRevenue,
      activeSubscriptions,
      churnRate,
      pendingRenewals,
      revenueTrend,
      subscriptionHealth,
      churnTrend,
      planPerformance,
      upcomingRenewals,
    });
  } catch (error) {
    console.error("Admin Dashboard Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
export const getMonthlySummary = async (req, res) => {
  try {
    const subscriptions = await SubscriptionModel.find({
      isDeleted: false,
      "subscription.startDate": { $exists: true },
    });

    // Group by month
    const monthlyData = {};

    subscriptions.forEach((subscription) => {
      const sub = subscription.subscription;
      if (!sub || !sub.startDate || !sub.price) return;

      const startDate = new Date(sub.startDate);
      const monthKey = startDate.toLocaleString("en-US", { month: "short" });

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthKey,
          totalRevenue: 0,
          totalSubscriptions: 0,
        };
      }

      monthlyData[monthKey].totalRevenue += sub.price;
      monthlyData[monthKey].totalSubscriptions += 1;
    });

    // Convert to array and sort by month order
    const monthOrder = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const data = Object.values(monthlyData).sort(
      (a, b) => monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month)
    );

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Get Monthly Summary Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// NEW: Get Clinic Count
export const getClinicCount = async (req, res) => {
  try {
    const totalClinics = await SubscriptionModel.countDocuments({
      isDeleted: false,
    });

    const activeClinics = await SubscriptionModel.countDocuments({
      isDeleted: false,
      "subscription.isActive": true,
    });

    const expiredClinics = await SubscriptionModel.countDocuments({
      isDeleted: false,
      "subscription.isActive": false,
    });

    res.json({
      success: true,
      data: {
        totalClinics,
        activeClinics,
        expiredClinics,
      },
    });
  } catch (error) {
    console.error("Get Clinic Count Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
export const createTestSubscription = async (req, res) => {
  try {
    const {
      clinicId,
      clinicName,
      clinicEmail,
      clinicType = "clinic",
      packageName = "growth",
      price = 5000,
      startDate,
      endDate,
      isActive = true,
    } = req.body;

    // Basic validation
    if (!clinicId || !clinicName || !clinicEmail || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    const subscription = await SubscriptionModel.create({
      clinicId,
      clinicName,
      clinicEmail,
      clinicType,
      subscription: {
        package: packageName,
        type: "annual",
        price,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive,
      },
      isDeleted: false,
    });

    res.status(201).json({
      success: true,
      message: "Test subscription created successfully",
      data: subscription,
    });
  } catch (error) {
    console.error("Create Test Subscription Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
