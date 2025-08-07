import React, { useState, useEffect } from 'react';
import { FaSave, FaSync, FaHistory, FaTrash, FaPlus, FaChevronDown, FaCar, FaMotorcycle, FaTaxi, FaClock, FaChartLine, FaCalculator, FaTimes, FaCheck } from 'react-icons/fa';
import { admin } from '../../services/api';

const FareManagement = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentTab, setCurrentTab] = useState('vehicle');
  const [config, setConfig] = useState(null);
  const [simulationData, setSimulationData] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [alert, setAlert] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [expandedSurge, setExpandedSurge] = useState({});

  // Simulation form state
  const [simulation, setSimulation] = useState({
    vehicleType: 'auto',
    distance: 10,
    waitingTime: 0,
    pickupStation: ''
  });

  useEffect(() => {
    fetchFareConfig();
  }, []);

  const fetchFareConfig = async () => {
    try {
      setLoading(true);
      const response = await admin.getFareConfig();
      if (response.success) {
        setConfig(response.config);
      }
    } catch (error) {
      showAlert('error', 'Failed to fetch fare configuration');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await admin.getFareHistory();
      if (response.success) {
        setHistory(response.history);
        setShowHistory(true);
      }
    } catch (error) {
      showAlert('error', 'Failed to fetch history');
    }
  };

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleVehicleConfigChange = (vehicleType, field, value) => {
    setConfig(prev => ({
      ...prev,
      vehicleConfigs: {
        ...prev.vehicleConfigs,
        [vehicleType]: {
          ...prev.vehicleConfigs[vehicleType],
          [field]: parseFloat(value) || 0
        }
      }
    }));
  };

  const handleSurgeTimeChange = (index, field, value) => {
    setConfig(prev => {
      const newSurgeTimes = [...prev.surgeTimes];
      newSurgeTimes[index] = {
        ...newSurgeTimes[index],
        [field]: field === 'isActive' ? value : (field === 'factor' ? parseFloat(value) : parseInt(value))
      };
      return { ...prev, surgeTimes: newSurgeTimes };
    });
  };

  const handleDynamicPricingChange = (index, field, value) => {
    setConfig(prev => {
      const newDynamicPricing = [...prev.dynamicPricing];
      newDynamicPricing[index] = {
        ...newDynamicPricing[index],
        [field]: field === 'name' || field === 'description' ? value : parseFloat(value)
      };
      return { ...prev, dynamicPricing: newDynamicPricing };
    });
  };

  const addSurgeTime = () => {
    setConfig(prev => ({
      ...prev,
      surgeTimes: [
        ...prev.surgeTimes,
        {
          name: 'New Period',
          startHour: 0,
          endHour: 1,
          factor: 1.0,
          isActive: false
        }
      ]
    }));
  };

  const removeSurgeTime = (index) => {
    setConfig(prev => ({
      ...prev,
      surgeTimes: prev.surgeTimes.filter((_, i) => i !== index)
    }));
  };

  const saveVehicleConfig = async (vehicleType) => {
    setConfirmDialog({
      title: 'Update Vehicle Pricing',
      message: `Are you sure you want to update ${vehicleType} pricing? This will affect all new bookings.`,
      onConfirm: async () => {
        try {
          setSaving(true);
          const response = await admin.updateVehicleFare(
            vehicleType,
            config.vehicleConfigs[vehicleType]
          );
          if (response.success) {
            showAlert('success', `${vehicleType} pricing updated successfully`);
            fetchFareConfig();
          }
        } catch (error) {
          showAlert('error', 'Failed to update vehicle pricing');
        } finally {
          setSaving(false);
          setConfirmDialog(null);
        }
      }
    });
  };

  const saveAllVehicleConfigs = async () => {
    setConfirmDialog({
      title: 'Update All Vehicle Pricing',
      message: 'Are you sure you want to update pricing for all vehicles? This will affect all new bookings.',
      onConfirm: async () => {
        try {
          setSaving(true);
          const response = await admin.updateAllVehicleFares({
            vehicleConfigs: config.vehicleConfigs
          });
          if (response.success) {
            showAlert('success', 'All vehicle pricing updated successfully');
            fetchFareConfig();
          }
        } catch (error) {
          showAlert('error', 'Failed to update vehicle pricing');
        } finally {
          setSaving(false);
          setConfirmDialog(null);
        }
      }
    });
  };

  const saveSurgeConfig = async () => {
    setConfirmDialog({
      title: 'Update Surge Pricing',
      message: 'Are you sure you want to update surge pricing rules?',
      onConfirm: async () => {
        try {
          setSaving(true);
          const response = await admin.updateSurgePricing({
            surgeTimes: config.surgeTimes
          });
          if (response.success) {
            showAlert('success', 'Surge pricing updated successfully');
            fetchFareConfig();
          }
        } catch (error) {
          showAlert('error', 'Failed to update surge pricing');
        } finally {
          setSaving(false);
          setConfirmDialog(null);
        }
      }
    });
  };

  const saveDynamicPricing = async () => {
    setConfirmDialog({
      title: 'Update Dynamic Pricing',
      message: 'Are you sure you want to update dynamic pricing thresholds?',
      onConfirm: async () => {
        try {
          setSaving(true);
          const response = await admin.updateDynamicPricing({
            dynamicPricing: config.dynamicPricing
          });
          if (response.success) {
            showAlert('success', 'Dynamic pricing updated successfully');
            fetchFareConfig();
          }
        } catch (error) {
          showAlert('error', 'Failed to update dynamic pricing');
        } finally {
          setSaving(false);
          setConfirmDialog(null);
        }
      }
    });
  };

  const runSimulation = async () => {
    try {
      const response = await admin.simulateFare(simulation);
      if (response.success) {
        setSimulationData(response.simulation);
      }
    } catch (error) {
      showAlert('error', 'Failed to run simulation');
    }
  };

  const restoreConfig = async (configId) => {
    setConfirmDialog({
      title: 'Restore Configuration',
      message: 'Are you sure you want to restore this configuration? Current configuration will be replaced.',
      onConfirm: async () => {
        try {
          setSaving(true);
          const response = await admin.restoreFareConfig(configId);
          if (response.success) {
            showAlert('success', 'Configuration restored successfully');
            fetchFareConfig();
            setShowHistory(false);
          }
        } catch (error) {
          showAlert('error', 'Failed to restore configuration');
        } finally {
          setSaving(false);
          setConfirmDialog(null);
        }
      }
    });
  };

  const getVehicleIcon = (type) => {
    switch(type) {
      case 'bike': return <FaMotorcycle className="text-xl" />;
      case 'auto': return <FaTaxi className="text-xl" />;
      case 'car': return <FaCar className="text-xl" />;
      default: return null;
    }
  };

  const tabs = [
    { id: 'vehicle', label: 'Vehicle Pricing', icon: <FaCar /> },
    { id: 'surge', label: 'Surge Pricing', icon: <FaClock /> },
    { id: 'dynamic', label: 'Dynamic Pricing', icon: <FaChartLine /> },
    { id: 'simulator', label: 'Fare Simulator', icon: <FaCalculator /> }
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg">
        Failed to load fare configuration
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-white rounded-xl shadow-lg">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-800">Fare Management</h1>
            <div className="flex gap-2">
              <button
                onClick={fetchFareConfig}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                title="Refresh"
              >
                <FaSync className="text-gray-600" />
              </button>
              <button
                onClick={fetchHistory}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                <FaHistory />
                View History
              </button>
            </div>
          </div>
        </div>

        {/* Alert */}
        {alert && (
          <div className={`mx-6 mt-4 p-4 rounded-lg ${
            alert.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {alert.message}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              className={`px-4 py-3 font-medium flex items-center gap-2 border-b-2 transition-colors ${
                currentTab === tab.id
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Vehicle Pricing Tab */}
          {currentTab === 'vehicle' && (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {Object.entries(config.vehicleConfigs).map(([type, vehicleConfig]) => (
                  <div key={type} className="bg-gray-50 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-4">
                      {getVehicleIcon(type)}
                      <h3 className="text-xl font-semibold capitalize">{type}</h3>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Base Fare (₹)
                        </label>
                        <input
                          type="number"
                          value={vehicleConfig.baseFare}
                          onChange={(e) => handleVehicleConfigChange(type, 'baseFare', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min="0"
                          step="1"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Per KM Rate (₹)
                        </label>
                        <input
                          type="number"
                          value={vehicleConfig.perKmRate}
                          onChange={(e) => handleVehicleConfigChange(type, 'perKmRate', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min="0"
                          step="0.5"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Minimum Fare (₹)
                        </label>
                        <input
                          type="number"
                          value={vehicleConfig.minimumFare}
                          onChange={(e) => handleVehicleConfigChange(type, 'minimumFare', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min="0"
                          step="1"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Waiting Charge/Min (₹)
                        </label>
                        <input
                          type="number"
                          value={vehicleConfig.waitingChargePerMin}
                          onChange={(e) => handleVehicleConfigChange(type, 'waitingChargePerMin', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min="0"
                          step="0.5"
                        />
                      </div>
                      
                      <button
                        onClick={() => saveVehicleConfig(type)}
                        disabled={saving}
                        className="w-full mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center justify-center gap-2 transition-colors disabled:bg-gray-400"
                      >
                        <FaSave />
                        Save {type}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              <button
                onClick={saveAllVehicleConfigs}
                disabled={saving}
                className="mt-6 px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg flex items-center gap-2 transition-colors disabled:bg-gray-400"
              >
                <FaSave />
                Save All Vehicle Pricing
              </button>
            </div>
          )}

          {/* Surge Pricing Tab */}
          {currentTab === 'surge' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Time-based Surge Pricing</h3>
                <button
                  onClick={addSurgeTime}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center gap-2 transition-colors"
                >
                  <FaPlus />
                  Add Time Period
                </button>
              </div>
              
              <div className="space-y-4">
                {config.surgeTimes.map((surge, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg">
                    <div
                      className="p-4 flex items-center justify-between cursor-pointer"
                      onClick={() => setExpandedSurge(prev => ({...prev, [index]: !prev[index]}))}
                    >
                      <div className="flex items-center gap-4">
                        <FaChevronDown className={`transition-transform ${expandedSurge[index] ? 'rotate-180' : ''}`} />
                        <span className="font-medium">{surge.name}</span>
                        <span className="text-gray-600">({surge.startHour}:00 - {surge.endHour}:00)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          surge.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'
                        }`}>
                          {surge.factor}x
                        </span>
                      </div>
                    </div>
                    
                    {expandedSurge[index] && (
                      <div className="p-4 border-t border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Period Name
                            </label>
                            <input
                              type="text"
                              value={surge.name}
                              onChange={(e) => handleSurgeTimeChange(index, 'name', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Start Hour
                            </label>
                            <input
                              type="number"
                              value={surge.startHour}
                              onChange={(e) => handleSurgeTimeChange(index, 'startHour', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              min="0"
                              max="23"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              End Hour
                            </label>
                            <input
                              type="number"
                              value={surge.endHour}
                              onChange={(e) => handleSurgeTimeChange(index, 'endHour', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              min="0"
                              max="23"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Surge Factor
                            </label>
                            <input
                              type="number"
                              value={surge.factor}
                              onChange={(e) => handleSurgeTimeChange(index, 'factor', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              min="1.0"
                              max="3.0"
                              step="0.1"
                            />
                          </div>
                          
                          <div className="flex items-end gap-2">
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={surge.isActive}
                                onChange={(e) => handleSurgeTimeChange(index, 'isActive', e.target.checked)}
                                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                              />
                              <span className="text-sm font-medium text-gray-700">Active</span>
                            </label>
                            
                            <button
                              onClick={() => removeSurgeTime(index)}
                              className="ml-auto p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Remove"
                            >
                              <FaTrash />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              <button
                onClick={saveSurgeConfig}
                disabled={saving}
                className="mt-6 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center gap-2 transition-colors disabled:bg-gray-400"
              >
                <FaSave />
                Save Surge Pricing
              </button>
            </div>
          )}

          {/* Dynamic Pricing Tab */}
          {currentTab === 'dynamic' && (
            <div>
              <h3 className="text-xl font-semibold mb-4">Demand-Supply Based Dynamic Pricing</h3>
              
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-200 px-4 py-2 text-left">Condition</th>
                      <th className="border border-gray-200 px-4 py-2 text-left">Min Ratio</th>
                      <th className="border border-gray-200 px-4 py-2 text-left">Max Ratio</th>
                      <th className="border border-gray-200 px-4 py-2 text-left">Multiplier</th>
                      <th className="border border-gray-200 px-4 py-2 text-left">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {config.dynamicPricing.map((pricing, index) => (
                      <tr key={index}>
                        <td className="border border-gray-200 px-4 py-2">
                          <input
                            type="text"
                            value={pricing.name}
                            onChange={(e) => handleDynamicPricingChange(index, 'name', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="border border-gray-200 px-4 py-2">
                          <input
                            type="number"
                            value={pricing.minRatio}
                            onChange={(e) => handleDynamicPricingChange(index, 'minRatio', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            min="0"
                            step="0.5"
                          />
                        </td>
                        <td className="border border-gray-200 px-4 py-2">
                          <input
                            type="text"
                            value={pricing.maxRatio || '∞'}
                            onChange={(e) => handleDynamicPricingChange(index, 'maxRatio', e.target.value === '∞' ? null : e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="border border-gray-200 px-4 py-2">
                          <input
                            type="number"
                            value={pricing.factor}
                            onChange={(e) => handleDynamicPricingChange(index, 'factor', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            min="1.0"
                            max="3.0"
                            step="0.1"
                          />
                        </td>
                        <td className="border border-gray-200 px-4 py-2">
                          <input
                            type="text"
                            value={pricing.description}
                            onChange={(e) => handleDynamicPricingChange(index, 'description', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <button
                onClick={saveDynamicPricing}
                disabled={saving}
                className="mt-6 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center gap-2 transition-colors disabled:bg-gray-400"
              >
                <FaSave />
                Save Dynamic Pricing
              </button>
            </div>
          )}

          {/* Fare Simulator Tab */}
          {currentTab === 'simulator' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-4">Fare Simulator</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vehicle Type
                    </label>
                    <select
                      value={simulation.vehicleType}
                      onChange={(e) => setSimulation({...simulation, vehicleType: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="bike">Bike</option>
                      <option value="auto">Auto</option>
                      <option value="car">Car</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Distance (KM)
                    </label>
                    <input
                      type="number"
                      value={simulation.distance}
                      onChange={(e) => setSimulation({...simulation, distance: parseFloat(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="0.1"
                      step="0.5"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Waiting Time (Minutes)
                    </label>
                    <input
                      type="number"
                      value={simulation.waitingTime}
                      onChange={(e) => setSimulation({...simulation, waitingTime: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="0"
                      step="1"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Pickup Station (Optional)
                    </label>
                    <input
                      type="text"
                      value={simulation.pickupStation}
                      onChange={(e) => setSimulation({...simulation, pickupStation: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter station name for dynamic pricing"
                    />
                  </div>
                  
                  <button
                    onClick={runSimulation}
                    className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                  >
                    Calculate Fare
                  </button>
                </div>
              </div>
              
              {simulationData && (
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-4">Simulation Result</h3>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600">Vehicle Type</span>
                      <span className="font-medium capitalize">{simulationData.vehicleType}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600">Distance</span>
                      <span className="font-medium">{simulationData.distance} KM</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600">Base Fare</span>
                      <span className="font-medium">₹{simulationData.baseFare}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600">Distance Fare</span>
                      <span className="font-medium">₹{simulationData.distanceFare}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600">Waiting Charges</span>
                      <span className="font-medium">₹{simulationData.waitingCharges}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600">Minimum Fare</span>
                      <span className="font-medium">₹{simulationData.minimumFare}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600">Surge Factor</span>
                      <span className={`font-medium px-2 py-1 rounded ${
                        simulationData.surgeFactor > 1 ? 'bg-orange-100 text-orange-800' : 'bg-gray-100'
                      }`}>
                        {simulationData.surgeFactor}x
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600">Dynamic Factor</span>
                      <span className={`font-medium px-2 py-1 rounded ${
                        simulationData.dynamicFactor > 1 ? 'bg-orange-100 text-orange-800' : 'bg-gray-100'
                      }`}>
                        {simulationData.dynamicFactor}x
                      </span>
                    </div>
                    <div className="flex justify-between py-3 border-t-2 border-gray-300">
                      <span className="text-lg font-semibold">Total Fare</span>
                      <span className="text-2xl font-bold text-blue-600">₹{simulationData.totalFare}</span>
                    </div>
                  </div>
                  
                  <div className="mt-4 p-3 bg-gray-100 rounded-lg">
                    <p className="text-sm text-gray-600 font-medium mb-1">Breakdown:</p>
                    <p className="text-sm text-gray-600">Before Surge: ₹{simulationData.breakdown.beforeSurge}</p>
                    <p className="text-sm text-gray-600">After Surge: ₹{simulationData.breakdown.afterSurge}</p>
                    <p className="text-sm text-gray-600">Final (with Dynamic): ₹{simulationData.breakdown.final}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-2xl font-bold">Fare Configuration History</h2>
              <button
                onClick={() => setShowHistory(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FaTimes className="text-gray-600" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left">Version</th>
                    <th className="px-4 py-2 text-left">Updated By</th>
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-left">Notes</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={item._id} className="border-b border-gray-200">
                      <td className="px-4 py-2">{item.version}</td>
                      <td className="px-4 py-2">{item.updatedByName || 'System'}</td>
                      <td className="px-4 py-2">
                        {new Date(item.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-2">{item.notes || '-'}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 rounded-full text-sm font-medium ${
                          item.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {item.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        {!item.isActive && (
                          <button
                            onClick={() => restoreConfig(item._id)}
                            className="text-blue-500 hover:text-blue-700 text-sm font-medium"
                          >
                            Restore
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-2">{confirmDialog.title}</h3>
            <p className="text-gray-600 mb-6">{confirmDialog.message}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                disabled={saving}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:bg-gray-400"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FareManagement;