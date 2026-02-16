// services/financeAnalytics.service.js
import mongoose from "mongoose";
import Billing from "../Model/billingSchema.js";
import PettyCash from "../Model/pettyCashSchema.js";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

// Service URLs
const INVENTORY_SERVICE_BASE_URL = process.env.INVENTORY_SERVICE_BASE_URL;
const EXPENSE_SERVICE_BASE_URL = process.env.EXPENSE_SERVICE_BASE_URL || "http://localhost:8001";
const SALARY_SERVICE_BASE_URL = process.env.SALARY_SERVICE_BASE_URL || "http://localhost:8001";
const PATIENT_SERVICE_BASE_URL = process.env.PATIENT_SERVICE_BASE_URL || "http://localhost:8002/api/v1";

// Timeouts in milliseconds
const HTTP_TIMEOUTS = {
  patientService: 10000,
  inventoryService: 15000,
  salaryService: 8000,
  expenseService: 8000
};

// Helper: Calculate date ranges
const getDateRange = (view, month, year) => {
  const now = new Date();
  const targetMonth = month || now.getMonth() + 1;
  const targetYear = year || now.getFullYear();
  
  let startDate, endDate;
  
  if (view === 'yearly') {
    startDate = new Date(targetYear, 0, 1);
    endDate = new Date(targetYear, 11, 31, 23, 59, 59);
  } else {
    // Monthly view
    startDate = new Date(targetYear, targetMonth - 1, 1);
    endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);
  }
  
  return { startDate, endDate, targetMonth, targetYear };
};

// Helper: Safe axios call with error handling
const safeAxiosCall = async (config, serviceName) => {
  try {
    const response = await axios(config);
    return response.data?.data || response.data || null;
  } catch (error) {
    console.error(`⚠️ ${serviceName} service error:`, error.message);
    // Return null instead of throwing to prevent dashboard failure
    return null;
  }
};

// Helper: Calculate petty cash
const calculatePettyCash = async (clinicId, startDate, endDate) => {
  try {
    const pettyRecords = await PettyCash.find({
      clinicId,
      createdAt: { $gte: startDate, $lte: endDate }
    }).lean();

    return pettyRecords.reduce((sum, record) => {
      const amount = record.amount || 0;
      const type = record.type?.toLowerCase();
      
      if (type === 'income' || type === 'in') {
        return sum + amount;
      } else if (type === 'expense' || type === 'out') {
        return sum - amount;
      }
      return sum;
    }, 0);
  } catch (error) {
    console.error("⚠️ Petty cash calculation error:", error.message);
    return 0;
  }
};

// Main financial dashboard function
export const financialDashboard = async (req, res) => {
  try {
    const { clinicId } = req.params;
    const { view = "monthly", month, year } = req.query;

    console.log("📊 Financial Dashboard Request:", { clinicId, view, month, year });

    // 1. Calculate date range
    const { startDate, endDate, targetMonth, targetYear } = getDateRange(view, parseInt(month), parseInt(year));

    console.log(`📅 ${view.toUpperCase()} View:`, { 
      startDate: startDate.toISOString(), 
      endDate: endDate.toISOString(),
      month: targetMonth,
      year: targetYear
    });

    // 2. Parallel data fetching
    const [
      billingData,
      patientServiceData,
      inventoryData,
      salaryData,
      expenseData,
      pettyCashAmount
    ] = await Promise.all([
      // Get billing data from MongoDB
      Billing.find({
        clinicId,
        billDate: { $gte: startDate, $lte: endDate },
        paymentStatus: { $ne: "cancelled" }
      }).lean(),

      // Get appointment income from patient service
      safeAxiosCall({
        method: 'GET',
        url: `${PATIENT_SERVICE_BASE_URL}/patient-service/appointment/clinic/financial-summary/${clinicId}`,
        params: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        },
        timeout: HTTP_TIMEOUTS.patientService
      }, 'Patient'),

      // Get inventory orders
      safeAxiosCall({
        method: 'GET',
        url: `${INVENTORY_SERVICE_BASE_URL}/orders/clinic/${clinicId}`,
        params: view === 'monthly' ? { month: targetMonth, year: targetYear } : { year: targetYear },
        timeout: HTTP_TIMEOUTS.inventoryService
      }, 'Inventory'),

      // Get salary data
      safeAxiosCall({
        method: 'GET',
        url: `${SALARY_SERVICE_BASE_URL}/api/v1/salary/monthly`,
        params: { clinicId },
        headers: {
          Authorization: req.headers.authorization || '',
          Cookie: req.headers.cookie || ''
        },
        timeout: HTTP_TIMEOUTS.salaryService
      }, 'Salary'),

      // Get expense data
      safeAxiosCall({
        method: 'GET',
        url: `${EXPENSE_SERVICE_BASE_URL}/api/v1/expense/monthly`,
        params: { clinicId },
        headers: {
          Authorization: req.headers.authorization || '',
          Cookie: req.headers.cookie || ''
        },
        timeout: HTTP_TIMEOUTS.expenseService
      }, 'Expense'),

      // Calculate petty cash
      calculatePettyCash(clinicId, startDate, endDate)
    ]);

    console.log(`💰 Found ${billingData.length} bills for this period`);

    // 3. Calculate INCOME (CORRECTED BASED ON YOUR REQUIREMENT)
    // total income = totalAmount from ALL bills (not just paid)
    const billingTotalIncome = billingData.reduce((sum, bill) => {
      return sum + (bill.totalAmount || 0);
    }, 0);

    const appointmentIncome = parseFloat(patientServiceData?.appointmentIncome || 0);
    const totalIncome = billingTotalIncome + appointmentIncome;

    console.log("💵 Income Calculation:", {
      billingTotalIncome,
      appointmentIncome,
      totalIncome
    });

    // 4. Calculate OUTSTANDING DUES (CORRECTED)
    // Outstanding Dues = pendingAmount from bills + appointment due
    const billingOutstanding = billingData
      .filter(bill => ['pending', 'partial'].includes(bill.paymentStatus))
      .reduce((sum, bill) => sum + (bill.pendingAmount || 0), 0);

    const appointmentDue = parseFloat(patientServiceData?.appointmentDue || 0);
    const outstandingDues = billingOutstanding + appointmentDue;

    console.log("📌 Outstanding Dues:", {
      billingOutstanding,
      appointmentDue,
      totalOutstanding: outstandingDues
    });

    // 5. Calculate EXPENSES (CORRECTED)
    // Total Expenses = salary + expenses + orders
    let salaryExpenses = 0;
    let otherExpenses = 0;
    let inventoryExpenses = 0;

    // Calculate salary expenses
    if (salaryData && Array.isArray(salaryData)) {
      if (view === 'monthly') {
        const monthKey = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
        const salaryRecord = salaryData.find(r => r.month === monthKey);
        salaryExpenses = parseFloat(salaryRecord?.totalSalary || 0);
      } else {
        salaryExpenses = salaryData
          .filter(r => String(r.month).startsWith(String(targetYear)))
          .reduce((sum, r) => sum + parseFloat(r.totalSalary || 0), 0);
      }
    }

    // Calculate other expenses
    if (expenseData && Array.isArray(expenseData)) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      if (view === 'monthly') {
        const monthLabel = monthNames[targetMonth - 1];
        const expenseRecord = expenseData.find(r => r.year === targetYear && r.month === monthLabel);
        otherExpenses = parseFloat(expenseRecord?.totalExpense || 0);
      } else {
        otherExpenses = expenseData
          .filter(r => r.year === targetYear)
          .reduce((sum, r) => sum + parseFloat(r.totalExpense || 0), 0);
      }
    }

    // Calculate inventory expenses
    if (inventoryData && Array.isArray(inventoryData)) {
      inventoryExpenses = inventoryData
        .filter(order => order.paymentStatus === 'PAID' || order.orderStatus === 'DELIVERED')
        .reduce((sum, order) => sum + parseFloat(order.totalAmount || 0), 0);
    }

    const totalExpenses = salaryExpenses + otherExpenses + inventoryExpenses;

    console.log("💸 Expense Breakdown:", {
      salaryExpenses,
      otherExpenses,
      inventoryExpenses,
      totalExpenses
    });

    // 6. Calculate NET PROFIT
    const netProfit = totalIncome - totalExpenses;
    const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

    console.log("📈 Profit Calculation:", {
      totalIncome,
      totalExpenses,
      netProfit,
      profitMargin: profitMargin.toFixed(2) + '%'
    });

    // 7. Generate charts data
    const revenueTrend = generateRevenueTrend(billingData, view, targetMonth, targetYear);
    const expenseBreakdown = generateExpenseBreakdown(inventoryData, otherExpenses, salaryExpenses);
    const billingSummary = generateBillingSummary(billingData);

    // 8. Prepare final response
    const response = {
      success: true,
      message: "Financial dashboard loaded successfully",
      view,
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        ...(view === 'monthly' ? { month: targetMonth, year: targetYear } : { year: targetYear })
      },
      summary: {
        // INCOME: totalAmount from all bills + appointment income
        totalIncome: {
          amount: totalIncome,
          breakdown: {
            billingIncome: billingTotalIncome,
            appointmentIncome: appointmentIncome
          }
        },
        
        // OUTSTANDING: pendingAmount from bills + appointment due
        outstandingDues: {
          amount: outstandingDues,
          breakdown: {
            billingOutstanding: billingOutstanding,
            appointmentDue: appointmentDue
          }
        },
        
        // EXPENSES: salary + expenses + orders
        totalExpenses: {
          amount: totalExpenses,
          breakdown: {
            salaryExpenses,
            otherExpenses,
            inventoryExpenses
          }
        },
        
        // PROFIT
        netProfit,
        profitMargin: profitMargin.toFixed(2),
        
        // OTHER
        pettyCash: pettyCashAmount
      },
      billingSummary,
      charts: {
        revenueTrend,
        expenseBreakdown
      }
    };

    res.status(200).json(response);

  } catch (error) {
    console.error("❌ Financial dashboard error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load financial dashboard",
      error: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
};

// Helper: Generate revenue trend chart data
function generateRevenueTrend(billingData, view, month, year) {
  const trend = {};
  
  if (view === 'yearly') {
    // Group by month
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    billingData.forEach(bill => {
      if (bill.paymentStatus !== 'cancelled') {
        const billMonth = new Date(bill.billDate).getMonth();
        const monthName = monthNames[billMonth];
        trend[monthName] = (trend[monthName] || 0) + (bill.totalAmount || 0);
      }
    });
    
    // Fill missing months
    monthNames.forEach(month => {
      if (!trend[month]) trend[month] = 0;
    });
  } else {
    // Group by day
    const daysInMonth = new Date(year, month, 0).getDate();
    
    billingData.forEach(bill => {
      if (bill.paymentStatus !== 'cancelled') {
        const day = new Date(bill.billDate).getDate();
        trend[day] = (trend[day] || 0) + (bill.totalAmount || 0);
      }
    });
    
    // Fill missing days
    for (let day = 1; day <= daysInMonth; day++) {
      if (!trend[day]) trend[day] = 0;
    }
  }
  
  return trend;
}

// Helper: Generate expense breakdown for donut chart
function generateExpenseBreakdown(inventoryData, otherExpenses, salaryExpenses) {
  const breakdown = {
    staffSalaries: salaryExpenses,
    medicines: 0,
    equipment: 0,
    consumables: 0,
    others: otherExpenses  // Start with other expenses
  };

  if (!inventoryData || !Array.isArray(inventoryData)) {
    return breakdown;
  }

  inventoryData.forEach(order => {
    if (order.paymentStatus !== 'PAID' && order.orderStatus !== 'DELIVERED') {
      return;
    }

    const amount = parseFloat(order.totalAmount || 0);
    
    if (order.items && order.items.length > 0) {
      order.items.forEach(item => {
        const category = (item.category || item.itemId?.category || '').toLowerCase();
        
        if (category.includes('medicine') || category.includes('drug')) {
          breakdown.medicines += amount / order.items.length;
        } else if (category.includes('equipment') || category.includes('device')) {
          breakdown.equipment += amount / order.items.length;
        } else if (category.includes('consumable') || category.includes('supply')) {
          breakdown.consumables += amount / order.items.length;
        } else {
          breakdown.others += amount / order.items.length;
        }
      });
    } else {
      breakdown.others += amount;
    }
  });

  return breakdown;
}

// Helper: Generate billing summary
function generateBillingSummary(billingData) {
  const totalBills = billingData.length;
  const paidBills = billingData.filter(b => b.paymentStatus === 'paid').length;
  const pendingBills = billingData.filter(b => b.paymentStatus === 'pending').length;
  const partialBills = billingData.filter(b => b.paymentStatus === 'partial').length;
  const cancelledBills = billingData.filter(b => b.paymentStatus === 'cancelled').length;

  return {
    totalBills,
    paidBills,
    pendingBills,
    partialBills,
    cancelledBills,
    paymentRate: totalBills > 0 ? ((paidBills + partialBills) / totalBills * 100).toFixed(2) + '%' : '0%'
  };
}

// Additional function to get detailed analytics
export const getDetailedAnalytics = async (req, res) => {
  try {
    const { clinicId } = req.params;
    const { startDate, endDate } = req.query;

    // Parse dates or use defaults
    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
    const end = endDate ? new Date(endDate) : new Date();

    const billingData = await Billing.find({
      clinicId,
      billDate: { $gte: start, $lte: end }
    }).lean();

    // Calculate metrics based on your formulas
    const metrics = {
      // TOTAL INCOME: sum of totalAmount from all bills
      totalIncome: billingData.reduce((sum, bill) => sum + (bill.totalAmount || 0), 0),
      
      // OUTSTANDING DUES: sum of pendingAmount from bills
      outstandingDues: billingData
        .filter(bill => ['pending', 'partial'].includes(bill.paymentStatus))
        .reduce((sum, bill) => sum + (bill.pendingAmount || 0), 0),
      
      // Payment statistics
      totalPaid: billingData
        .filter(bill => bill.paymentStatus === 'paid')
        .reduce((sum, bill) => sum + (bill.paidAmount || 0), 0),
      
      // Bill type breakdown
      billTypeBreakdown: billingData.reduce((acc, bill) => {
        const type = bill.billType || 'other';
        acc[type] = (acc[type] || 0) + (bill.totalAmount || 0);
        return acc;
      }, {})
    };

    res.status(200).json({
      success: true,
      data: {
        period: { startDate: start.toISOString(), endDate: end.toISOString() },
        metrics,
        totalBills: billingData.length
      }
    });

  } catch (error) {
    console.error("❌ Detailed analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load detailed analytics",
      error: error.message
    });
  }
};