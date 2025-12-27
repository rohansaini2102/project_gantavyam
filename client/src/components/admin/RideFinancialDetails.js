import React, { useState, useEffect } from 'react';
import { FaRupeeSign, FaChartLine, FaCar, FaUser, FaBuilding, FaReceipt, FaMoneyBillWave, FaPercent, FaMoon, FaBolt, FaCheckCircle, FaTimesCircle, FaClock } from 'react-icons/fa';

const RideFinancialDetails = ({ ride, showSummary = true }) => {
  const [financialData, setFinancialData] = useState({
    driverEarnings: 0,
    platformRevenue: 0,
    customerTotal: 0,
    commission: 0,
    gst: 0,
    nightCharge: 0,
    surgeAmount: 0
  });

  useEffect(() => {
    if (ride) {
      calculateFinancials();
    }
  }, [ride]);

  const calculateFinancials = () => {
    if (!ride) return;

    // Get available fare data
    let driverFare = ride.driverFare || ride.fare || 0;
    let customerFare = ride.customerFare || ride.estimatedFare || 0;
    let commissionAmount = ride.commissionAmount || 0;
    let gstAmount = ride.gstAmount || 0;
    let nightChargeAmount = ride.nightChargeAmount || 0;

    // Handle different ride data scenarios
    if (driverFare > 0 && commissionAmount > 0 && gstAmount > 0) {
      // Complete fare breakdown available (new rides)
      customerFare = customerFare || (driverFare + commissionAmount + gstAmount + nightChargeAmount);
    } else if (customerFare > 0 && driverFare === 0) {
      // Only customer fare available (legacy rides) - reverse engineer
      // Reverse calculation: customerTotal = driverFare + commission(10%) + gst(5% of driver+commission) + nightCharge
      // Let x = driverFare, then: customerTotal = x + 0.1x + 0.05(x + 0.1x) + nightCharge
      // customerTotal = x + 0.1x + 0.055x + nightCharge = 1.155x + nightCharge
      // Therefore: x = (customerTotal - nightCharge) / 1.155

      const totalWithoutNightCharge = customerFare - nightChargeAmount;
      driverFare = Math.round(totalWithoutNightCharge / 1.155);
      commissionAmount = Math.round(driverFare * 0.1);
      gstAmount = Math.round((driverFare + commissionAmount) * 0.05);

      // Verify calculation adds up correctly
      const calculatedTotal = driverFare + commissionAmount + gstAmount + nightChargeAmount;
      if (Math.abs(calculatedTotal - customerFare) > 2) {
        // If calculation doesn't match (due to rounding), adjust driver fare
        driverFare = customerFare - commissionAmount - gstAmount - nightChargeAmount;
        driverFare = Math.max(0, driverFare);
      }
    } else if (driverFare > 0 && customerFare === 0) {
      // Only driver fare available - calculate forward
      commissionAmount = commissionAmount || Math.round(driverFare * 0.1);
      gstAmount = gstAmount || Math.round((driverFare + commissionAmount) * 0.05);
      customerFare = driverFare + commissionAmount + gstAmount + nightChargeAmount;
    } else if (customerFare === 0 && driverFare === 0) {
      // No fare data available
      console.warn('No fare data available for ride:', ride.rideId);
    }

    // Calculate surge amount if applicable
    let surgeAmount = 0;
    if (ride.surgeFactor && ride.surgeFactor > 1) {
      surgeAmount = Math.round(driverFare * (ride.surgeFactor - 1));
    }

    // Calculate platform revenue (includes commission + GST + night charge + surge)
    const platformRevenue = customerFare - driverFare; // This automatically includes all platform earnings including surge

    setFinancialData({
      driverEarnings: Math.max(0, driverFare),
      platformRevenue: Math.max(0, platformRevenue),
      customerTotal: Math.max(0, customerFare),
      commission: Math.max(0, commissionAmount),
      gst: Math.max(0, gstAmount),
      nightCharge: Math.max(0, nightChargeAmount),
      surgeAmount: Math.max(0, surgeAmount)
    });
  };

  const getPaymentStatusIcon = () => {
    if (!ride?.paymentStatus) return <FaClock className="text-yellow-500" />;

    switch (ride.paymentStatus) {
      case 'collected':
        return <FaCheckCircle className="text-green-500" />;
      case 'pending':
        return <FaClock className="text-yellow-500" />;
      case 'failed':
        return <FaTimesCircle className="text-red-500" />;
      default:
        return <FaClock className="text-gray-500" />;
    }
  };

  const getPaymentStatusColor = () => {
    if (!ride?.paymentStatus) return 'bg-yellow-100 text-yellow-800';

    switch (ride.paymentStatus) {
      case 'collected':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!ride) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <p className="text-gray-500">No ride selected</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Financial Overview Cards */}
      {showSummary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Driver Earnings Card */}
          <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <FaCar className="text-green-600" />
                  <span className="text-sm font-medium text-gray-700">Driver Earnings</span>
                </div>
                <div className="text-2xl font-bold text-green-700">
                  ₹{financialData.driverEarnings}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  Base fare (excl. GST & commission)
                </div>
              </div>
              <FaMoneyBillWave className="text-green-300 text-3xl" />
            </div>
          </div>

          {/* Platform Revenue Card */}
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <FaBuilding className="text-blue-600" />
                  <span className="text-sm font-medium text-gray-700">Platform Revenue</span>
                </div>
                <div className="text-2xl font-bold text-blue-700">
                  ₹{financialData.platformRevenue}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  Commission + GST + Charges
                </div>
              </div>
              <FaChartLine className="text-blue-300 text-3xl" />
            </div>
          </div>

          {/* Customer Total Card */}
          <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <FaUser className="text-purple-600" />
                  <span className="text-sm font-medium text-gray-700">Customer Total</span>
                </div>
                <div className="text-2xl font-bold text-purple-700">
                  ₹{financialData.customerTotal}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  Total amount paid by customer
                </div>
              </div>
              <FaRupeeSign className="text-purple-300 text-3xl" />
            </div>
          </div>
        </div>
      )}

      {/* Detailed Fare Breakdown */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <FaReceipt className="text-gray-600" />
            Complete Fare Breakdown
          </h3>
        </div>

        <div className="p-6 space-y-4">
          {/* Base Fare Section */}
          <div className="space-y-3">
            <div className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Base Calculations</div>

            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <FaCar className="text-green-600" />
                  <span className="font-medium text-gray-800">Driver Base Fare</span>
                </div>
                <span className="text-lg font-bold text-green-700">₹{financialData.driverEarnings}</span>
              </div>
              <div className="text-xs text-gray-600 mt-2">
                {ride.distance ? `${ride.distance} km @ ₹${Math.round(financialData.driverEarnings / ride.distance)}/km` : 'Distance-based calculation'}
              </div>
            </div>

            {/* Surge Pricing */}
            {ride.surgeFactor && ride.surgeFactor > 1 && (
              <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <FaBolt className="text-orange-600" />
                    <span className="font-medium text-gray-800">Surge Pricing ({ride.surgeFactor}x)</span>
                  </div>
                  <span className="text-lg font-semibold text-orange-700">
                    {financialData.surgeAmount > 0 ? `+₹${financialData.surgeAmount}` : 'Included'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Platform Charges Section */}
          <div className="space-y-3">
            <div className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Platform Charges</div>

            {/* Commission */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <FaPercent className="text-blue-600" />
                  <span className="font-medium text-gray-800">Platform Commission (10%)</span>
                </div>
                <span className="text-lg font-semibold text-blue-700">₹{financialData.commission}</span>
              </div>
              <div className="text-xs text-gray-600 mt-2">
                10% of base fare (₹{financialData.driverEarnings} × 0.10)
              </div>
            </div>

            {/* GST */}
            <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <FaReceipt className="text-indigo-600" />
                  <span className="font-medium text-gray-800">GST (5%)</span>
                </div>
                <span className="text-lg font-semibold text-indigo-700">₹{financialData.gst}</span>
              </div>
              <div className="text-xs text-gray-600 mt-2">
                5% on (base + commission) = ₹{financialData.driverEarnings + financialData.commission} × 0.05
              </div>
            </div>

            {/* Night Charge */}
            {financialData.nightCharge > 0 && (
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <FaMoon className="text-purple-600" />
                    <span className="font-medium text-gray-800">Night Charge (20%)</span>
                  </div>
                  <span className="text-lg font-semibold text-purple-700">₹{financialData.nightCharge}</span>
                </div>
                <div className="text-xs text-gray-600 mt-2">
                  Late night surcharge (11 PM - 5 AM)
                </div>
              </div>
            )}
          </div>

          {/* Summary Section */}
          <div className="border-t-2 border-gray-200 pt-4 space-y-3">
            <div className="flex justify-between items-center text-lg">
              <span className="font-semibold text-gray-800">Customer Total</span>
              <span className="font-bold text-blue-700">₹{financialData.customerTotal}</span>
            </div>

            <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-semibold text-gray-800">Platform Earnings</div>
                  <div className="text-xs text-gray-600 mt-1">
                    Commission + GST + Night Charge
                  </div>
                </div>
                <span className="text-xl font-bold text-yellow-700">₹{financialData.platformRevenue}</span>
              </div>
            </div>
          </div>

          {/* Payment Status */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getPaymentStatusIcon()}
                <span className="font-medium text-gray-700">Payment Status</span>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPaymentStatusColor()}`}>
                {ride.paymentStatus || 'Pending'}
              </span>
            </div>
            {ride.paymentMethod && (
              <div className="mt-2 text-sm text-gray-600">
                Payment Method: <span className="font-medium">
                  {ride.paymentMethod === 'cash' ? '💵 CASH' :
                   ride.paymentMethod === 'upi' ? '📱 UPI' :
                   ride.paymentMethod === 'online' ? '🌐 ONLINE' :
                   ride.paymentMethod.toUpperCase()}
                </span>
              </div>
            )}
            {ride.paymentCollectedAt && (
              <div className="mt-1 text-sm text-gray-600">
                Collected at: <span className="font-medium">{new Date(ride.paymentCollectedAt).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RideFinancialDetails;