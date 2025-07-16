import React, { useState, useEffect } from 'react';
import { users } from '../../services/api';
import SwipeableCard from './SwipeableCard';

const RideHistory = ({ className = '', isMobile = false, onViewChange }) => {
  const [rides, setRides] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [expandedRides, setExpandedRides] = useState(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);

  useEffect(() => {
    loadRideHistory();
  }, []);

  const loadRideHistory = async (pageNum = 1) => {
    try {
      setIsLoading(true);
      setError('');
      
      console.log(`[RideHistory] Loading page ${pageNum}`);
      const response = await users.getRideHistory(pageNum, 10);
      
      if (response.success && response.rides) {
        if (pageNum === 1) {
          setRides(response.rides);
        } else {
          setRides(prev => [...prev, ...response.rides]);
        }
        
        // Use pagination metadata if available, otherwise fallback to old logic
        if (response.pagination) {
          setHasMore(response.pagination.hasMore);
          console.log(`[RideHistory] Page ${pageNum}/${response.pagination.totalPages}, hasMore: ${response.pagination.hasMore}`);
        } else {
          setHasMore(response.rides.length === 10);
        }
        
        setPage(pageNum);
      } else {
        setError('No ride history found');
      }
    } catch (error) {
      console.error('Error loading ride history:', error);
      setError('Failed to load ride history. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMore = () => {
    if (!isLoading && hasMore) {
      loadRideHistory(page + 1);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadRideHistory(1);
    setIsRefreshing(false);
  };

  const handleBookAgain = (ride) => {
    console.log('Book again:', ride);
    // TODO: Implement book again functionality
  };

  const handleDownloadReceipt = (ride) => {
    console.log('Download receipt:', ride);
    // TODO: Implement download receipt functionality
  };

  // Pull-to-refresh functionality
  const handleTouchStart = (e) => {
    if (!isMobile) return;
    setIsPulling(true);
    setPullDistance(0);
  };

  const handleTouchMove = (e) => {
    if (!isMobile || !isPulling) return;
    
    const touch = e.touches[0];
    const container = e.currentTarget;
    const scrollTop = container.scrollTop;
    
    if (scrollTop === 0) {
      const distance = Math.max(0, touch.clientY - (touch.target.getBoundingClientRect().top + scrollTop));
      const maxPull = 80;
      const pullDist = Math.min(distance * 0.5, maxPull);
      setPullDistance(pullDist);
      
      if (pullDist > 0) {
        e.preventDefault();
      }
    }
  };

  const handleTouchEnd = () => {
    if (!isMobile || !isPulling) return;
    
    setIsPulling(false);
    
    if (pullDistance > 50 && !isRefreshing) {
      handleRefresh();
    }
    
    setPullDistance(0);
  };

  const toggleRideExpansion = (rideId) => {
    setExpandedRides(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rideId)) {
        newSet.delete(rideId);
      } else {
        newSet.add(rideId);
      }
      return newSet;
    });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getVehicleIcon = (vehicleType) => {
    switch (vehicleType) {
      case 'bike':
        return '🏍️';
      case 'auto':
        return '🛺';
      case 'car':
        return '🚗';
      default:
        return '🚗';
    }
  };

  if (isLoading && rides.length === 0) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="text-center">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          </div>
          <p className="text-gray-600 font-medium">Loading ride history...</p>
          <p className="text-gray-500 text-sm mt-1">This may take a moment</p>
        </div>
      </div>
    );
  }

  if (error && rides.length === 0) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="text-center max-w-sm mx-auto px-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to load rides</h3>
          <p className="text-gray-600 mb-4 text-sm">{error}</p>
          <button
            onClick={() => loadRideHistory(1)}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (rides.length === 0) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="text-center max-w-sm mx-auto px-4">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className={`${isMobile ? 'text-lg' : 'text-xl'} font-semibold text-gray-900 mb-2`}>No rides yet</h3>
          <p className="text-gray-600 text-sm mb-4">Your completed rides will appear here</p>
          <button 
            onClick={() => onViewChange && onViewChange('booking')}
            className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Book Your First Ride
          </button>
        </div>
      </div>
    );
  }

  const renderMobileCard = (ride) => {
    const isExpanded = expandedRides.has(ride._id || ride.rideId);
    
    return (
      <SwipeableCard
        key={ride._id || ride.rideId}
        leftAction={
          <div className="flex flex-col items-center">
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-xs font-medium">Book Again</span>
          </div>
        }
        rightAction={
          <div className="flex flex-col items-center">
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-xs font-medium">Receipt</span>
          </div>
        }
        onLeftSwipe={() => handleBookAgain(ride)}
        onRightSwipe={() => handleDownloadReceipt(ride)}
        className="mb-3"
      >
        <div
          className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100"
          onClick={() => toggleRideExpansion(ride._id || ride.rideId)}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                <span className="text-2xl">{getVehicleIcon(ride.vehicleType)}</span>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">
                  {formatDate(ride.timestamps?.completed || ride.createdAt)}
                </p>
                <p className="font-medium text-gray-900">
                  ₹{ride.actualFare || ride.estimatedFare || ride.fare}
                </p>
              </div>
            </div>
            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(ride.status)}`}>
              {ride.status}
            </span>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <p className="text-sm text-gray-700 truncate">
                {ride.pickupLocation?.boothName || 'Pickup Location'}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <p className="text-sm text-gray-700 truncate">
                {ride.dropLocation?.address || 'Drop Location'}
              </p>
            </div>
          </div>
          
          {isExpanded && (
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
              {ride.driverName && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Driver</span>
                  <span className="text-sm font-medium text-gray-900">
                    {ride.driverName}
                  </span>
                </div>
              )}
              
              {ride.distance && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Distance</span>
                  <span className="text-sm font-medium text-gray-900">{ride.distance} km</span>
                </div>
              )}
              
              {ride.journeyStats?.totalDuration && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Duration</span>
                  <span className="text-sm font-medium text-gray-900">
                    {ride.journeyStats.totalDuration} mins
                  </span>
                </div>
              )}
            </div>
          )}
          
          <div className="flex items-center justify-center mt-3">
            <svg
              className={`w-5 h-5 text-gray-400 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </SwipeableCard>
    );
  };

  const renderDesktopCard = (ride) => {
    const isExpanded = expandedRides.has(ride._id || ride.rideId);
    
    return (
      <div
        key={ride._id || ride.rideId}
        className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow mb-4"
      >
        <div
          className="p-4 cursor-pointer"
          onClick={() => toggleRideExpansion(ride._id || ride.rideId)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <span className="text-2xl">{getVehicleIcon(ride.vehicleType)}</span>
                <div>
                  <p className="text-sm text-gray-600">
                    {formatDate(ride.timestamps?.completed || ride.createdAt)}
                  </p>
                  <p className="text-xs text-gray-500">
                    Ride #{ride.boothRideNumber || ride.rideId}
                  </p>
                </div>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <p className="text-sm text-gray-700">
                    {ride.pickupLocation?.boothName || 'Pickup Location'}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <p className="text-sm text-gray-700">
                    {ride.dropLocation?.address || 'Drop Location'}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="text-right ml-4">
              <p className="text-lg font-semibold text-gray-900">
                ₹{ride.actualFare || ride.estimatedFare || ride.fare}
              </p>
              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(ride.status)}`}>
                {ride.status}
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-end mt-2">
            <svg
              className={`w-5 h-5 text-gray-400 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        
        {isExpanded && (
          <div className="px-4 pb-4 border-t border-gray-200">
            <div className="pt-4 space-y-3">
              {ride.driverName && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Driver</span>
                  <span className="text-sm font-medium text-gray-900">
                    {ride.driverName} ({ride.driverPhone || 'N/A'})
                  </span>
                </div>
              )}
              
              {ride.driverVehicleNo && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Vehicle Number</span>
                  <span className="text-sm font-medium text-gray-900">{ride.driverVehicleNo}</span>
                </div>
              )}
              
              {ride.distance && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Distance</span>
                  <span className="text-sm font-medium text-gray-900">{ride.distance} km</span>
                </div>
              )}
              
              <div className="pt-3 flex space-x-3">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBookAgain(ride);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Book Again
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadReceipt(ride);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  Download Receipt
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      className={`${className} ${isMobile ? 'pb-20' : ''} relative overflow-hidden`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: isMobile ? `translateY(${pullDistance}px)` : 'none',
        transition: isPulling ? 'none' : 'transform 0.3s ease-out'
      }}
    >
      {/* Pull-to-refresh indicator */}
      {isMobile && pullDistance > 0 && (
        <div 
          className="absolute top-0 left-0 right-0 flex items-center justify-center py-2 bg-blue-50"
          style={{
            transform: `translateY(${-60 + pullDistance}px)`,
            opacity: pullDistance / 50
          }}
        >
          {pullDistance > 50 ? (
            <svg className="w-5 h-5 text-blue-600 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7-7m0 0l-7 7m7-7v18" />
            </svg>
          )}
          <span className="ml-2 text-sm text-gray-600">
            {pullDistance > 50 ? 'Release to refresh' : 'Pull to refresh'}
          </span>
        </div>
      )}

      {/* Header */}
      <div className={`${isMobile ? 'p-4 pb-2' : 'p-6 pb-4'}`}>
        <div className="flex items-center justify-between">
          <h2 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-gray-900`}>
            Ride History
          </h2>
          {!isMobile && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <svg 
                className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
        </div>
        
        {isMobile && (
          <p className="text-sm text-gray-600 mt-1">Pull down to refresh • Swipe cards for actions</p>
        )}
      </div>
      
      {/* Rides List */}
      <div className={`${isMobile ? 'px-4' : 'px-6'}`}>
        {rides.map((ride) => (
          isMobile ? renderMobileCard(ride) : renderDesktopCard(ride)
        ))}
      </div>
      
      {/* Load More Button */}
      {hasMore && (
        <div className={`flex justify-center pt-6 ${isMobile ? 'px-4 pb-4' : 'px-6'}`}>
          <button
            onClick={loadMore}
            disabled={isLoading}
            className={`
              px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 
              transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
              ${isMobile ? 'w-full font-medium' : 'min-w-[120px]'}
            `}
          >
            {isLoading ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                <span>Loading...</span>
              </div>
            ) : (
              'Load More'
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default RideHistory;