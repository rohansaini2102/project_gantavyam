import React, { useState } from 'react';
import { 
  FaMapMarkerAlt, 
  FaUser, 
  FaPhone, 
  FaRoute,
  FaClock,
  FaCheckCircle,
  FaPlayCircle,
  FaStopCircle
} from 'react-icons/fa';

const MinimalActiveRide = ({ 
  ride, 
  stage = 'assigned', // 'assigned', 'started', 'completed'
  onStartRide,
  onCompleteRide,
  onVerifyOTP,
  isLoading = false
}) => {
  const [otpInput, setOtpInput] = useState('');
  const [showOTPInput, setShowOTPInput] = useState(false);

  // Handle OTP verification
  const handleOTPSubmit = () => {
    if (otpInput.length === 4 || otpInput.length === 6) {
      onVerifyOTP(otpInput, stage === 'assigned' ? 'start' : 'end');
      setOtpInput('');
      setShowOTPInput(false);
    }
  };

  // Get stage icon and color
  const getStageInfo = () => {
    switch(stage) {
      case 'assigned':
        return {
          icon: <FaPlayCircle />,
          color: 'text-blue-500',
          bgColor: 'bg-blue-500',
          text: 'Ready to Start',
          action: 'Start Ride'
        };
      case 'started':
        return {
          icon: <FaRoute />,
          color: 'text-green-500',
          bgColor: 'bg-green-500',
          text: 'Ride in Progress',
          action: 'Complete Ride'
        };
      case 'completed':
        return {
          icon: <FaCheckCircle />,
          color: 'text-gray-500',
          bgColor: 'bg-gray-500',
          text: 'Ride Completed',
          action: null
        };
      default:
        return {
          icon: <FaClock />,
          color: 'text-gray-500',
          bgColor: 'bg-gray-500',
          text: 'Waiting',
          action: null
        };
    }
  };

  const stageInfo = getStageInfo();

  // Format phone number for calling
  const handleCall = (phone) => {
    if (phone) {
      window.location.href = `tel:${phone}`;
    }
  };

  return (
    <div className="minimal-active-ride">
      {/* Stage Indicator */}
      <div className="minimal-active-ride-stage">
        <div className="flex items-center gap-2">
          <span className={stageInfo.color}>{stageInfo.icon}</span>
          {stageInfo.text}
        </div>
      </div>

      {/* Ride ID */}
      {ride._id && (
        <div className="text-xs opacity-75 mb-3">
          Ride ID: {ride._id.slice(-6).toUpperCase()}
        </div>
      )}

      {/* Customer Info */}
      <div className="minimal-active-ride-info">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FaUser className="text-sm" />
            <span>{ride.userName || ride.customerName || 'Customer'}</span>
          </div>
          
          {ride.userPhone && (
            <button
              onClick={() => handleCall(ride.userPhone)}
              className="flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full"
            >
              <FaPhone className="text-xs" />
              <span className="text-sm">Call</span>
            </button>
          )}
        </div>

        {/* Fare Display */}
        <div className="text-2xl font-bold mb-4">
          ₹{ride.estimatedFare || ride.fare || '0'}
        </div>

        {/* Locations */}
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <FaMapMarkerAlt className="text-green-400 mt-1 flex-shrink-0" />
            <div>
              <div className="text-xs opacity-75">Pickup</div>
              <div className="text-sm">
                {ride.pickupLocation?.boothName || 
                 ride.pickupStation?.name || 
                 ride.pickupLocation || 
                 'Pickup location'}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <FaMapMarkerAlt className="text-red-400 mt-1 flex-shrink-0" />
            <div>
              <div className="text-xs opacity-75">Drop</div>
              <div className="text-sm">
                {ride.dropLocation?.address || 
                 ride.dropoffStation?.name || 
                 ride.dropLocation || 
                 'Drop location'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* OTP Input Section */}
      {showOTPInput && (
        <div className="mt-4 space-y-3">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength="6"
            value={otpInput}
            onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
            placeholder="Enter OTP"
            className="minimal-otp-input"
            autoFocus
          />
          
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleOTPSubmit}
              disabled={otpInput.length < 4 || isLoading}
              className="minimal-btn-primary opacity-90"
            >
              Verify
            </button>
            <button
              onClick={() => {
                setShowOTPInput(false);
                setOtpInput('');
              }}
              className="minimal-btn-primary opacity-70"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action Button */}
      {!showOTPInput && stageInfo.action && (
        <button
          onClick={() => {
            if (stage === 'assigned') {
              if (ride.startOTP) {
                setShowOTPInput(true);
              } else {
                onStartRide();
              }
            } else if (stage === 'started') {
              if (ride.endOTP) {
                setShowOTPInput(true);
              } else {
                onCompleteRide();
              }
            }
          }}
          disabled={isLoading}
          className="minimal-btn-primary mt-4"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="minimal-spinner w-5 h-5 border-2"></div>
              Processing...
            </span>
          ) : (
            <>
              {stage === 'assigned' && <FaPlayCircle className="text-lg" />}
              {stage === 'started' && <FaStopCircle className="text-lg" />}
              {stageInfo.action}
            </>
          )}
        </button>
      )}

      {/* OTP Hint */}
      {((stage === 'assigned' && ride.startOTP) || (stage === 'started' && ride.endOTP)) && !showOTPInput && (
        <div className="text-center text-xs opacity-75 mt-2">
          OTP required to {stage === 'assigned' ? 'start' : 'complete'} ride
        </div>
      )}

      {/* Distance and Duration (if available) */}
      {(ride.distance || ride.duration) && (
        <div className="flex justify-around mt-4 pt-4 border-t border-white/20">
          {ride.distance && (
            <div className="text-center">
              <div className="text-xs opacity-75">Distance</div>
              <div className="font-semibold">{ride.distance} km</div>
            </div>
          )}
          
          {ride.duration && (
            <div className="text-center">
              <div className="text-xs opacity-75">Duration</div>
              <div className="font-semibold">{ride.duration} min</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MinimalActiveRide;