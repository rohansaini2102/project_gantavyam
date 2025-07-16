import React from 'react';
import { FiInbox, FiWifi, FiWifiOff } from 'react-icons/fi';
import RideRequestCard from './RideRequestCard';

const RideRequestsList = ({
  rideRequests = [],
  selectedRequest = null,
  socketConnected = false,
  acceptingRideId = null,
  onSelectRequest,
  onAcceptRide,
  onDeclineRide,
  className = ''
}) => {
  return (
    <div className={`bg-white rounded-xl shadow-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FiInbox className="w-6 h-6 text-sky-500" />
            <h3 className="text-lg font-semibold text-gray-900">
              Ride Requests ({rideRequests.length})
            </h3>
          </div>
          
          {/* Connection Status Indicator */}
          <div className="flex items-center gap-2">
            {socketConnected ? (
              <FiWifi className="w-4 h-4 text-green-500" />
            ) : (
              <FiWifiOff className="w-4 h-4 text-red-500" />
            )}
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
              socketConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {socketConnected ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {rideRequests.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiInbox className="w-8 h-8 text-gray-400" />
            </div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">No Ride Requests</h4>
            <p className="text-gray-600 max-w-sm mx-auto">
              {socketConnected 
                ? 'Waiting for ride requests from passengers...' 
                : 'Socket connection required to receive ride requests'
              }
            </p>
            
            {!socketConnected && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                ⚠️ Please check your internet connection and try refreshing the page
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {rideRequests.map(request => (
              <RideRequestCard
                key={request._id}
                request={request}
                isSelected={selectedRequest?._id === request._id}
                isAccepting={acceptingRideId === request._id}
                onSelect={onSelectRequest}
                onAccept={onAcceptRide}
                onDecline={onDeclineRide}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RideRequestsList;