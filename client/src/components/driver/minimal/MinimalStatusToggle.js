import React from 'react';
import { FaPowerOff, FaWifi, FaExclamationTriangle } from 'react-icons/fa';

const MinimalStatusToggle = ({ 
  isOnline, 
  isLoading, 
  onToggle, 
  queuePosition,
  socketConnected 
}) => {
  return (
    <div className="w-full px-4 py-3">
      {/* Connection Status */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          {socketConnected ? (
            <>
              <FaWifi className="text-green-500 text-sm" />
              <span className="text-xs text-gray-600">Connected</span>
            </>
          ) : (
            <>
              <FaExclamationTriangle className="text-red-500 text-sm" />
              <span className="text-xs text-gray-600">Disconnected</span>
            </>
          )}
        </div>
        
        {/* Queue Position Badge */}
        {isOnline && queuePosition !== null && (
          <div className={`minimal-queue-badge ${queuePosition === 1 ? 'next' : ''}`}>
            {queuePosition === 1 ? (
              <>🚀 Next in line!</>
            ) : (
              <>Queue: #{queuePosition}</>
            )}
          </div>
        )}
      </div>

      {/* Main Toggle Button */}
      <button
        onClick={onToggle}
        disabled={isLoading || !socketConnected}
        className={`minimal-status-toggle ${isOnline ? 'online' : 'offline'}`}
      >
        <FaPowerOff className="text-xl" />
        {isLoading ? (
          <span>Loading...</span>
        ) : isOnline ? (
          <span>ONLINE</span>
        ) : (
          <span>GO ONLINE</span>
        )}
      </button>

      {/* Status Message */}
      {!socketConnected && (
        <p className="text-center text-red-500 text-sm mt-2">
          Connection required to change status
        </p>
      )}
    </div>
  );
};

export default MinimalStatusToggle;