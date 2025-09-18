import React, { useState, useEffect } from 'react';
import { FaChartLine, FaMoneyBillWave, FaPercent, FaReceipt, FaArrowUp, FaArrowDown, FaCalendarDay, FaCalendarWeek, FaCalendarAlt, FaDownload, FaFilter } from 'react-icons/fa';
import { Line, Pie, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const FinancialSummary = ({ rides = [], onRefresh, loading = false }) => {
  const [timeRange, setTimeRange] = useState('today');
  const [financialStats, setFinancialStats] = useState({
    totalRevenue: 0,
    driverEarnings: 0,
    platformRevenue: 0,
    totalCommission: 0,
    totalGST: 0,
    totalRides: 0,
    completedRides: 0,
    pendingCollections: 0,
    averageFare: 0
  });

  const [chartData, setChartData] = useState({
    revenue: null,
    paymentMethods: null,
    hourlyDistribution: null
  });

  const [comparison, setComparison] = useState({
    revenue: { current: 0, previous: 0, change: 0 },
    rides: { current: 0, previous: 0, change: 0 },
    average: { current: 0, previous: 0, change: 0 }
  });

  useEffect(() => {
    calculateFinancialStats();
    generateChartData();
    calculateComparison();
  }, [rides, timeRange]);

  const calculateFinancialStats = () => {
    let stats = {
      totalRevenue: 0,
      driverEarnings: 0,
      platformRevenue: 0,
      totalCommission: 0,
      totalGST: 0,
      totalRides: 0,
      completedRides: 0,
      pendingCollections: 0,
      averageFare: 0
    };

    const filteredRides = filterRidesByTimeRange(rides);

    filteredRides.forEach(ride => {
      const driverFare = ride.driverFare || ride.fare || 0;
      const customerFare = ride.customerFare || ride.estimatedFare || 0;
      const commission = ride.commissionAmount || Math.round(driverFare * 0.1);
      const gst = ride.gstAmount || Math.round((driverFare + commission) * 0.05);
      const nightCharge = ride.nightChargeAmount || 0;

      stats.totalRevenue += customerFare;
      stats.driverEarnings += driverFare;
      stats.platformRevenue += (commission + gst + nightCharge);
      stats.totalCommission += commission;
      stats.totalGST += gst;
      stats.totalRides += 1;

      if (ride.status === 'completed') {
        stats.completedRides += 1;
      }

      if (ride.paymentStatus !== 'collected') {
        stats.pendingCollections += customerFare;
      }
    });

    if (stats.totalRides > 0) {
      stats.averageFare = Math.round(stats.totalRevenue / stats.totalRides);
    }

    setFinancialStats(stats);
  };

  const filterRidesByTimeRange = (rides) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return rides.filter(ride => {
      const rideDate = new Date(ride.createdAt || ride.bookingTime);

      switch (timeRange) {
        case 'today':
          return rideDate >= today;
        case 'week':
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          return rideDate >= weekAgo;
        case 'month':
          const monthAgo = new Date(today);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          return rideDate >= monthAgo;
        default:
          return true;
      }
    });
  };

  const generateChartData = () => {
    const filteredRides = filterRidesByTimeRange(rides);

    // Revenue trend chart
    const revenueByDay = {};
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      last7Days.push(dateStr);
      revenueByDay[dateStr] = 0;
    }

    filteredRides.forEach(ride => {
      const date = new Date(ride.createdAt || ride.bookingTime);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (revenueByDay[dateStr] !== undefined) {
        revenueByDay[dateStr] += ride.customerFare || ride.estimatedFare || 0;
      }
    });

    const revenueChart = {
      labels: last7Days,
      datasets: [{
        label: 'Daily Revenue',
        data: last7Days.map(day => revenueByDay[day]),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.3
      }]
    };

    // Payment methods pie chart
    const paymentMethods = {};
    filteredRides.forEach(ride => {
      const method = ride.paymentMethod || 'cash';
      paymentMethods[method] = (paymentMethods[method] || 0) + 1;
    });

    const paymentChart = {
      labels: Object.keys(paymentMethods),
      datasets: [{
        data: Object.values(paymentMethods),
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(168, 85, 247, 0.8)',
          'rgba(251, 146, 60, 0.8)'
        ],
        borderWidth: 0
      }]
    };

    // Hourly distribution
    const hourlyData = new Array(24).fill(0);
    filteredRides.forEach(ride => {
      const hour = new Date(ride.createdAt || ride.bookingTime).getHours();
      hourlyData[hour]++;
    });

    const hourlyChart = {
      labels: Array.from({length: 24}, (_, i) => `${i}:00`),
      datasets: [{
        label: 'Rides per Hour',
        data: hourlyData,
        backgroundColor: 'rgba(34, 197, 94, 0.6)',
        borderColor: 'rgb(34, 197, 94)',
        borderWidth: 1
      }]
    };

    setChartData({
      revenue: revenueChart,
      paymentMethods: paymentChart,
      hourlyDistribution: hourlyChart
    });
  };

  const calculateComparison = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let currentPeriodRides = [];
    let previousPeriodRides = [];

    if (timeRange === 'today') {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      currentPeriodRides = rides.filter(r => new Date(r.createdAt) >= today);
      previousPeriodRides = rides.filter(r => {
        const rideDate = new Date(r.createdAt);
        return rideDate >= yesterday && rideDate < today;
      });
    } else if (timeRange === 'week') {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const twoWeeksAgo = new Date(today);
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      currentPeriodRides = rides.filter(r => new Date(r.createdAt) >= weekAgo);
      previousPeriodRides = rides.filter(r => {
        const rideDate = new Date(r.createdAt);
        return rideDate >= twoWeeksAgo && rideDate < weekAgo;
      });
    }

    const currentRevenue = currentPeriodRides.reduce((sum, r) => sum + (r.customerFare || r.estimatedFare || 0), 0);
    const previousRevenue = previousPeriodRides.reduce((sum, r) => sum + (r.customerFare || r.estimatedFare || 0), 0);

    const currentAvg = currentPeriodRides.length > 0 ? currentRevenue / currentPeriodRides.length : 0;
    const previousAvg = previousPeriodRides.length > 0 ? previousRevenue / previousPeriodRides.length : 0;

    setComparison({
      revenue: {
        current: currentRevenue,
        previous: previousRevenue,
        change: previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue * 100).toFixed(1) : 0
      },
      rides: {
        current: currentPeriodRides.length,
        previous: previousPeriodRides.length,
        change: previousPeriodRides.length > 0 ? ((currentPeriodRides.length - previousPeriodRides.length) / previousPeriodRides.length * 100).toFixed(1) : 0
      },
      average: {
        current: Math.round(currentAvg),
        previous: Math.round(previousAvg),
        change: previousAvg > 0 ? ((currentAvg - previousAvg) / previousAvg * 100).toFixed(1) : 0
      }
    });
  };

  const handleExport = () => {
    // Generate CSV data
    const csvContent = generateCSVReport();
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financial-report-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const generateCSVReport = () => {
    const filteredRides = filterRidesByTimeRange(rides);
    let csv = 'Ride ID,Date,Customer,Driver,Vehicle Type,Distance,Driver Fare,Commission,GST,Customer Total,Payment Status\n';

    filteredRides.forEach(ride => {
      const driverFare = ride.driverFare || ride.fare || 0;
      const commission = ride.commissionAmount || Math.round(driverFare * 0.1);
      const gst = ride.gstAmount || Math.round((driverFare + commission) * 0.05);
      const customerTotal = ride.customerFare || ride.estimatedFare || 0;

      csv += `${ride.rideId || ride._id},${new Date(ride.createdAt).toLocaleString()},${ride.userName || 'N/A'},${ride.driverName || 'N/A'},${ride.vehicleType || 'N/A'},${ride.distance || 0},${driverFare},${commission},${gst},${customerTotal},${ride.paymentStatus || 'pending'}\n`;
    });

    return csv;
  };

  return (
    <div className="space-y-6">
      {/* Header with Time Range Selector */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FaChartLine className="text-blue-600" />
            Financial Dashboard
          </h2>

          <div className="flex items-center gap-3">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setTimeRange('today')}
                className={`px-3 py-1.5 rounded flex items-center gap-1.5 text-sm font-medium transition-colors ${
                  timeRange === 'today' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <FaCalendarDay size={14} />
                Today
              </button>
              <button
                onClick={() => setTimeRange('week')}
                className={`px-3 py-1.5 rounded flex items-center gap-1.5 text-sm font-medium transition-colors ${
                  timeRange === 'week' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <FaCalendarWeek size={14} />
                This Week
              </button>
              <button
                onClick={() => setTimeRange('month')}
                className={`px-3 py-1.5 rounded flex items-center gap-1.5 text-sm font-medium transition-colors ${
                  timeRange === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <FaCalendarAlt size={14} />
                This Month
              </button>
            </div>

            <button
              onClick={handleExport}
              className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1.5 text-sm font-medium"
            >
              <FaDownload size={14} />
              Export
            </button>

            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={loading}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5 text-sm font-medium disabled:opacity-50"
              >
                <FaFilter size={14} />
                Refresh
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <FaMoneyBillWave className="text-green-600 text-xl" />
            </div>
            {comparison.revenue.change !== 0 && (
              <div className={`flex items-center gap-1 text-sm font-medium ${
                comparison.revenue.change > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {comparison.revenue.change > 0 ? <FaArrowUp size={12} /> : <FaArrowDown size={12} />}
                {Math.abs(comparison.revenue.change)}%
              </div>
            )}
          </div>
          <div className="text-2xl font-bold text-gray-800">₹{financialStats.totalRevenue.toLocaleString()}</div>
          <div className="text-sm text-gray-600 mt-1">Total Revenue</div>
          <div className="text-xs text-gray-500 mt-2">
            {financialStats.completedRides} completed rides
          </div>
        </div>

        {/* Platform Earnings Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FaPercent className="text-blue-600 text-xl" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-800">₹{financialStats.platformRevenue.toLocaleString()}</div>
          <div className="text-sm text-gray-600 mt-1">Platform Earnings</div>
          <div className="text-xs text-gray-500 mt-2">
            Commission + GST + Charges
          </div>
        </div>

        {/* Average Fare Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <FaReceipt className="text-purple-600 text-xl" />
            </div>
            {comparison.average.change !== 0 && (
              <div className={`flex items-center gap-1 text-sm font-medium ${
                comparison.average.change > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {comparison.average.change > 0 ? <FaArrowUp size={12} /> : <FaArrowDown size={12} />}
                {Math.abs(comparison.average.change)}%
              </div>
            )}
          </div>
          <div className="text-2xl font-bold text-gray-800">₹{financialStats.averageFare}</div>
          <div className="text-sm text-gray-600 mt-1">Average Fare</div>
          <div className="text-xs text-gray-500 mt-2">
            Per ride average
          </div>
        </div>

        {/* Pending Collections Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <FaMoneyBillWave className="text-yellow-600 text-xl" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-800">₹{financialStats.pendingCollections.toLocaleString()}</div>
          <div className="text-sm text-gray-600 mt-1">Pending Collections</div>
          <div className="text-xs text-gray-500 mt-2">
            Awaiting payment
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend Chart */}
        {chartData.revenue && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Revenue Trend</h3>
            <div className="h-64">
              <Line
                data={chartData.revenue}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        callback: (value) => `₹${value}`
                      }
                    }
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* Payment Methods Distribution */}
        {chartData.paymentMethods && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Payment Methods</h3>
            <div className="h-64">
              <Pie
                data={chartData.paymentMethods}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom'
                    }
                  }
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Hourly Distribution */}
      {chartData.hourlyDistribution && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Hourly Ride Distribution</h3>
          <div className="h-64">
            <Bar
              data={chartData.hourlyDistribution}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false }
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      stepSize: 1
                    }
                  }
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Detailed Breakdown */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Financial Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-700 uppercase">Earnings</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Driver Earnings</span>
                <span className="text-sm font-semibold">₹{financialStats.driverEarnings.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Platform Revenue</span>
                <span className="text-sm font-semibold">₹{financialStats.platformRevenue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-2 font-semibold">
                <span className="text-sm">Total Revenue</span>
                <span className="text-sm text-green-600">₹{financialStats.totalRevenue.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-700 uppercase">Platform Breakdown</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Commission (10%)</span>
                <span className="text-sm font-semibold">₹{financialStats.totalCommission.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">GST (5%)</span>
                <span className="text-sm font-semibold">₹{financialStats.totalGST.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-2 font-semibold">
                <span className="text-sm">Total Platform</span>
                <span className="text-sm text-blue-600">₹{financialStats.platformRevenue.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-700 uppercase">Ride Statistics</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Total Rides</span>
                <span className="text-sm font-semibold">{financialStats.totalRides}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Completed</span>
                <span className="text-sm font-semibold">{financialStats.completedRides}</span>
              </div>
              <div className="flex justify-between items-center py-2 font-semibold">
                <span className="text-sm">Completion Rate</span>
                <span className="text-sm text-green-600">
                  {financialStats.totalRides > 0
                    ? Math.round(financialStats.completedRides / financialStats.totalRides * 100)
                    : 0}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancialSummary;