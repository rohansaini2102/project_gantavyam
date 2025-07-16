import React from 'react';
import { 
  FiTrendingUp, 
  FiDollarSign, 
  FiClock, 
  FiCheckCircle,
  FiTarget,
  FiStar
} from 'react-icons/fi';

const DriverStatsCards = ({
  driverStats = null,
  className = ''
}) => {
  if (!driverStats) {
    return null;
  }

  const stats = [
    {
      title: 'Total Rides',
      value: driverStats.totalRides || 0,
      icon: <FiTrendingUp className="w-5 h-5" />,
      color: 'bg-blue-500',
      textColor: 'text-blue-600'
    },
    {
      title: 'Total Earnings',
      value: `₹${driverStats.totalEarnings || 0}`,
      icon: <FiDollarSign className="w-5 h-5" />,
      color: 'bg-green-500',
      textColor: 'text-green-600'
    },
    {
      title: 'Completed Rides',
      value: driverStats.completedRides || 0,
      icon: <FiCheckCircle className="w-5 h-5" />,
      color: 'bg-emerald-500',
      textColor: 'text-emerald-600'
    },
    {
      title: 'Average Rating',
      value: driverStats.averageRating ? `${driverStats.averageRating.toFixed(1)} ⭐` : 'N/A',
      icon: <FiStar className="w-5 h-5" />,
      color: 'bg-yellow-500',
      textColor: 'text-yellow-600'
    },
    {
      title: 'Hours Online',
      value: `${driverStats.hoursOnline || 0}h`,
      icon: <FiClock className="w-5 h-5" />,
      color: 'bg-purple-500',
      textColor: 'text-purple-600'
    },
    {
      title: 'Completion Rate',
      value: `${driverStats.completionRate || 0}%`,
      icon: <FiTarget className="w-5 h-5" />,
      color: 'bg-indigo-500',
      textColor: 'text-indigo-600'
    }
  ];

  return (
    <div className={`grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4 ${className}`}>
      {stats.map((stat, index) => (
        <div key={index} className="bg-white rounded-2xl shadow-lg border border-gray-200 p-4">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className={`w-10 h-10 sm:w-12 sm:h-12 ${stat.color} rounded-xl flex items-center justify-center text-white`}>
              {stat.icon}
            </div>
            <div className="flex-1">
              <h4 className="text-xs sm:text-sm font-semibold text-gray-600 mb-1">{stat.title}</h4>
              <p className={`text-lg sm:text-xl font-bold ${stat.textColor} truncate`}>{stat.value}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DriverStatsCards;