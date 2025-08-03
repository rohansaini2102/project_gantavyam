import React, { useState, useEffect } from 'react';
import { FaTimes, FaCar, FaMotorcycle, FaTaxi, FaClock, FaStar, FaCheck } from 'react-icons/fa';
import { useDriver } from '../../contexts';

const DriverSelectionModal = ({ 
  isOpen, 
  onClose, 
  boothName, 
  vehicleType, 
  onDriverSelect,
  autoAssign = false 
}) => {
  const { drivers, loading, error, actions } = useDriver();
  const [selectedDriver, setSelectedDriver] = useState(null);

  useEffect(() => {
    if (isOpen && boothName) {
      actions.fetchAvailableDrivers(boothName);
    }
  }, [isOpen, boothName]);

  // Filter drivers by vehicle type if specified
  const filteredDrivers = vehicleType 
    ? drivers.filter(driver => driver.vehicleType === vehicleType)
    : drivers;

  const getVehicleIcon = (type) => {
    switch (type) {
      case 'bike': return <FaMotorcycle className="text-blue-500" />;
      case 'auto': return <FaTaxi className="text-yellow-500" />;
      case 'car': return <FaCar className="text-green-500" />;
      default: return <FaCar className="text-gray-500" />;
    }
  };

  const handleDriverSelect = (driver) => {
    setSelectedDriver(driver);
  };

  const handleConfirmSelection = () => {
    if (selectedDriver) {
      onDriverSelect(selectedDriver);
      onClose();
    }
  };

  const handleAutoAssign = () => {
    onDriverSelect(null); // null indicates auto assignment
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-800">
            Select Driver - {boothName}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FaTimes size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Auto Assign Option */}
          <div className="mb-6">
            <button
              onClick={handleAutoAssign}
              className="w-full p-4 border-2 border-dashed border-blue-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-blue-600 font-medium"
            >
              Auto Assign (Queue Position #1)
            </button>
          </div>

          <div className="mb-4">
            <h3 className="text-lg font-medium text-gray-700 mb-3">
              Available Drivers ({filteredDrivers.length})
            </h3>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-3 text-gray-600">Loading drivers...</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="text-red-600 text-center py-4">
              {error}
            </div>
          )}

          {/* Drivers List */}
          {!loading && !error && (
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {filteredDrivers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No available drivers found for this booth
                </div>
              ) : (
                filteredDrivers.map((driver) => (
                  <div
                    key={driver._id}
                    onClick={() => handleDriverSelect(driver)}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      selectedDriver?._id === driver._id
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        {/* Vehicle Icon */}
                        <div className="text-2xl">
                          {getVehicleIcon(driver.vehicleType)}
                        </div>

                        {/* Driver Info */}
                        <div>
                          <h4 className="font-medium text-gray-800">
                            {driver.fullName}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {driver.vehicleNo} • {driver.vehicleType.toUpperCase()}
                          </p>
                          <p className="text-sm text-gray-500">
                            {driver.mobileNo}
                          </p>
                        </div>
                      </div>

                      {/* Driver Stats */}
                      <div className="text-right">
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <div className="flex items-center">
                            <span className="font-semibold text-blue-600">
                              #{driver.queuePosition}
                            </span>
                            <span className="ml-1">Queue</span>
                          </div>
                          
                          <div className="flex items-center">
                            <FaClock className="mr-1" />
                            <span>{driver.waitTime}m</span>
                          </div>
                          
                          <div className="flex items-center">
                            <FaStar className="mr-1 text-yellow-500" />
                            <span>{driver.rating || 0}</span>
                          </div>
                        </div>
                        
                        <div className="text-xs text-gray-500 mt-1">
                          {driver.totalRides} rides completed
                        </div>
                      </div>

                      {/* Selection Indicator */}
                      {selectedDriver?._id === driver._id && (
                        <div className="ml-4">
                          <FaCheck className="text-blue-500 text-lg" />
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmSelection}
            disabled={!selectedDriver}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              selectedDriver
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Assign Driver
          </button>
        </div>
      </div>
    </div>
  );
};

export default DriverSelectionModal;