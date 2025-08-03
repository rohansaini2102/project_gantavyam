import React from 'react';

const RideStatusTimeline = ({ ride, showTimestamps = true }) => {
  const statusSteps = [
    {
      key: 'pending',
      label: 'Booking Created',
      icon: '📝',
      description: 'Ride request submitted'
    },
    {
      key: 'driver_assigned',
      label: 'Driver Assigned',
      icon: '👨‍✈️',
      description: 'Driver automatically assigned'
    },
    {
      key: 'ride_started',
      label: 'Ride Started',
      icon: '🚗',
      description: 'Customer picked up'
    },
    {
      key: 'ride_ended',
      label: 'Ride Ended',
      icon: '🏁',
      description: 'Customer dropped off'
    },
    {
      key: 'completed',
      label: 'Completed',
      icon: '✅',
      description: 'Payment collected'
    }
  ];

  const getCurrentStepIndex = () => {
    if (!ride?.status) return 0;
    
    const statusIndex = statusSteps.findIndex(step => step.key === ride.status);
    return statusIndex !== -1 ? statusIndex : 0;
  };

  const currentStepIndex = getCurrentStepIndex();
  const isCancelled = ride?.status === 'cancelled';

  const getStepStatus = (stepIndex) => {
    if (isCancelled) {
      return stepIndex <= currentStepIndex ? 'completed' : 'cancelled';
    }
    
    if (stepIndex < currentStepIndex) return 'completed';
    if (stepIndex === currentStepIndex) return 'current';
    return 'pending';
  };

  const getStepColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-500 border-green-500 text-white';
      case 'current': return 'bg-blue-500 border-blue-500 text-white animate-pulse';
      case 'cancelled': return 'bg-red-200 border-red-300 text-red-600';
      default: return 'bg-gray-200 border-gray-300 text-gray-500';
    }
  };

  const getLineColor = (stepIndex) => {
    if (isCancelled && stepIndex >= currentStepIndex) return 'bg-red-200';
    if (stepIndex < currentStepIndex) return 'bg-green-500';
    return 'bg-gray-200';
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  };

  const getTimestampForStep = (stepKey) => {
    switch (stepKey) {
      case 'pending': return ride?.timestamp || ride?.createdAt;
      case 'driver_assigned': return ride?.assignedAt || ride?.acceptedAt;
      case 'ride_started': return ride?.rideStartedAt;
      case 'ride_ended': return ride?.rideEndedAt;
      case 'completed': return ride?.completedAt;
      default: return null;
    }
  };

  return (
    <div className="relative">
      {/* Cancelled Banner */}
      {isCancelled && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <span className="text-red-500 mr-2">❌</span>
            <div>
              <div className="font-medium text-red-800">Ride Cancelled</div>
              {ride.cancellationReason && (
                <div className="text-sm text-red-600">{ride.cancellationReason}</div>
              )}
              {ride.cancelledAt && showTimestamps && (
                <div className="text-xs text-red-500">
                  {formatTimestamp(ride.cancelledAt)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-4">
        {statusSteps.map((step, index) => {
          const stepStatus = getStepStatus(index);
          const timestamp = getTimestampForStep(step.key);
          const isLast = index === statusSteps.length - 1;

          return (
            <div key={step.key} className="relative flex items-start">
              {/* Vertical Line */}
              {!isLast && (
                <div className="absolute left-4 top-8 w-0.5 h-8 -ml-px">
                  <div className={`w-full h-full ${getLineColor(index)}`}></div>
                </div>
              )}

              {/* Step Circle */}
              <div className={`
                relative flex items-center justify-center w-8 h-8 rounded-full border-2 font-medium text-sm
                ${getStepColor(stepStatus)}
              `}>
                <span className="text-xs">{step.icon}</span>
              </div>

              {/* Step Content */}
              <div className="ml-4 flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className={`text-sm font-medium ${
                      stepStatus === 'current' ? 'text-blue-800' :
                      stepStatus === 'completed' ? 'text-green-800' :
                      stepStatus === 'cancelled' ? 'text-red-600' :
                      'text-gray-500'
                    }`}>
                      {step.label}
                    </h4>
                    <p className={`text-xs ${
                      stepStatus === 'cancelled' ? 'text-red-500' : 'text-gray-600'
                    }`}>
                      {step.description}
                    </p>
                  </div>
                  
                  {showTimestamps && timestamp && (
                    <div className={`text-xs ${
                      stepStatus === 'current' ? 'text-blue-600' :
                      stepStatus === 'completed' ? 'text-green-600' :
                      'text-gray-500'
                    }`}>
                      {formatTimestamp(timestamp)}
                    </div>
                  )}
                </div>

                {/* Additional Info for Current Step */}
                {stepStatus === 'current' && (
                  <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                    <div className="text-xs text-blue-700">
                      {step.key === 'driver_assigned' && ride.startOTP && (
                        <div>Start OTP: <span className="font-mono font-bold">{ride.startOTP}</span></div>
                      )}
                      {step.key === 'ride_started' && ride.endOTP && (
                        <div>End OTP: <span className="font-mono font-bold">{ride.endOTP}</span></div>
                      )}
                      {step.key === 'ride_ended' && (
                        <div>Awaiting payment collection...</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Additional Status Info */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-gray-500">Queue Number:</span>
            <span className="ml-1 font-medium">{ride.queueNumber || 'N/A'}</span>
          </div>
          <div>
            <span className="text-gray-500">Payment:</span>
            <span className={`ml-1 font-medium ${
              ride.paymentStatus === 'collected' ? 'text-green-600' : 'text-orange-600'
            }`}>
              {ride.paymentStatus || 'Pending'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RideStatusTimeline;