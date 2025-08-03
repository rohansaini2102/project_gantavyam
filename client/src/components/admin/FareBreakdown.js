import React, { useState } from 'react';
import { FaEdit, FaCheck, FaTimes, FaRupeeSign, FaCar, FaMotorcycle, FaTaxi } from 'react-icons/fa';
import { useFare } from '../../contexts';

const FareBreakdown = ({ 
  selectedVehicleType, 
  onFareUpdate,
  showAllTypes = false,
  editable = true 
}) => {
  const { fareEstimates, fareBreakdown, actions } = useFare();
  const [editingFare, setEditingFare] = useState(null);
  const [customFareValue, setCustomFareValue] = useState('');
  const [fareReason, setFareReason] = useState('');

  const getVehicleIcon = (type) => {
    switch (type) {
      case 'bike': return <FaMotorcycle className="text-blue-500" />;
      case 'auto': return <FaTaxi className="text-yellow-500" />;
      case 'car': return <FaCar className="text-green-500" />;
      default: return <FaCar className="text-gray-500" />;
    }
  };

  const getVehicleLabel = (type) => {
    switch (type) {
      case 'bike': return 'Bike';
      case 'auto': return 'Auto';
      case 'car': return 'Car';
      default: return 'Vehicle';
    }
  };

  const handleEditFare = (vehicleType) => {
    const currentFare = actions.getFareForVehicle(vehicleType);
    setCustomFareValue(currentFare.toString());
    setEditingFare(vehicleType);
    setFareReason('');
  };

  const handleSaveFare = (vehicleType) => {
    const newFare = parseFloat(customFareValue);
    if (isNaN(newFare) || newFare <= 0) {
      alert('Please enter a valid fare amount');
      return;
    }

    const customFareData = actions.applyCustomFare(vehicleType, newFare, fareReason);
    
    if (onFareUpdate) {
      onFareUpdate(vehicleType, newFare, customFareData);
    }

    setEditingFare(null);
    setCustomFareValue('');
    setFareReason('');
  };

  const handleCancelEdit = () => {
    setEditingFare(null);
    setCustomFareValue('');
    setFareReason('');
  };

  const renderFareCard = (vehicleType) => {
    const currentFare = actions.getFareForVehicle(vehicleType);
    const isCustom = actions.isCustomFare(vehicleType);
    const breakdown = fareBreakdown?.[vehicleType];
    const isEditing = editingFare === vehicleType;

    return (
      <div 
        key={vehicleType}
        className={`bg-white border rounded-lg p-4 ${
          selectedVehicleType === vehicleType ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">
              {getVehicleIcon(vehicleType)}
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">
                {getVehicleLabel(vehicleType)}
              </h3>
              {isCustom && (
                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
                  Custom Fare
                </span>
              )}
            </div>
          </div>
          
          {editable && !isEditing && (
            <button
              onClick={() => handleEditFare(vehicleType)}
              className="text-gray-400 hover:text-blue-500 transition-colors"
            >
              <FaEdit size={16} />
            </button>
          )}
        </div>

        {/* Fare Display/Edit */}
        {isEditing ? (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Fare Amount
              </label>
              <div className="flex items-center">
                <FaRupeeSign className="text-gray-400 mr-2" />
                <input
                  type="number"
                  value={customFareValue}
                  onChange={(e) => setCustomFareValue(e.target.value)}
                  className="flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
                  placeholder="Enter amount"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason (Optional)
              </label>
              <input
                type="text"
                value={fareReason}
                onChange={(e) => setFareReason(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
                placeholder="e.g., Peak hour surge, Special discount"
              />
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => handleSaveFare(vehicleType)}
                className="flex items-center bg-green-500 text-white px-3 py-2 rounded hover:bg-green-600 transition-colors"
              >
                <FaCheck className="mr-1" size={14} />
                Save
              </button>
              <button
                onClick={handleCancelEdit}
                className="flex items-center bg-gray-500 text-white px-3 py-2 rounded hover:bg-gray-600 transition-colors"
              >
                <FaTimes className="mr-1" size={14} />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Total Fare */}
            <div className="text-center mb-3">
              <div className="text-3xl font-bold text-gray-800">
                ₹{currentFare || 0}
              </div>
              <div className="text-sm text-gray-600">Total Fare</div>
            </div>

            {/* Fare Breakdown */}
            {breakdown && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-700 mb-2">
                  Fare Breakdown:
                </div>
                
                {breakdown.breakdown?.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-gray-600">{item.label}</span>
                    <span className="text-gray-800">₹{item.amount}</span>
                  </div>
                ))}
                
                {breakdown.surgeMultiplier > 1 && (
                  <div className="flex justify-between text-sm text-orange-600">
                    <span>Surge ({breakdown.surgeMultiplier}x)</span>
                    <span>₹{breakdown.surgeFare}</span>
                  </div>
                )}
                
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span>₹{breakdown.totalFare}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (!fareEstimates) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <div className="text-gray-500">
          No fare estimates available. Please select pickup and drop locations.
        </div>
      </div>
    );
  }

  if (showAllTypes) {
    // Show all vehicle types
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">Fare Estimates</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['bike', 'auto', 'car'].map(vehicleType => renderFareCard(vehicleType))}
        </div>
      </div>
    );
  } else if (selectedVehicleType) {
    // Show only selected vehicle type
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">
          {getVehicleLabel(selectedVehicleType)} Fare
        </h3>
        {renderFareCard(selectedVehicleType)}
      </div>
    );
  }

  return null;
};

export default FareBreakdown;