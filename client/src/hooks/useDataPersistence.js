import { useState, useEffect, useCallback, useRef } from 'react';
import debounce from 'lodash.debounce';
import toast from 'react-hot-toast';

/**
 * Custom hook for auto-saving form data to localStorage with debouncing
 * and step-wise persistence for driver registration
 */
export const useDataPersistence = (
  formId = 'driverRegistration',
  autosaveDelay = 2000,
  stepCount = 4
) => {
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [savedData, setSavedData] = useState({});
  const [stepCompletionStatus, setStepCompletionStatus] = useState({});
  const autoSaveTimeoutRef = useRef(null);

  // Storage keys
  const getStorageKey = (key) => `${formId}_${key}`;
  const FORM_DATA_KEY = getStorageKey('formData');
  const STEP_STATUS_KEY = getStorageKey('stepStatus');
  const TIMESTAMP_KEY = getStorageKey('timestamp');
  const FILES_KEY = getStorageKey('files');

  // Load persisted data on mount
  useEffect(() => {
    try {
      const savedFormData = localStorage.getItem(FORM_DATA_KEY);
      const savedStepStatus = localStorage.getItem(STEP_STATUS_KEY);
      const savedTimestamp = localStorage.getItem(TIMESTAMP_KEY);

      if (savedFormData) {
        const parsedData = JSON.parse(savedFormData);
        setSavedData(parsedData);
      }

      if (savedStepStatus) {
        const parsedStatus = JSON.parse(savedStepStatus);
        setStepCompletionStatus(parsedStatus);
      }

      if (savedTimestamp) {
        setLastSaved(new Date(savedTimestamp));
      }
    } catch (error) {
      console.error('Error loading persisted data:', error);
      // Clear corrupted data
      clearPersistedData();
    }
  }, [FORM_DATA_KEY, STEP_STATUS_KEY, TIMESTAMP_KEY]);

  // Debounced auto-save function
  const debouncedAutoSave = useCallback(
    debounce(async (data, stepIndex = null) => {
      setIsAutoSaving(true);

      try {
        const timestamp = new Date().toISOString();

        // Save form data
        localStorage.setItem(FORM_DATA_KEY, JSON.stringify(data));
        localStorage.setItem(TIMESTAMP_KEY, timestamp);

        // Update step completion if step index provided
        if (stepIndex !== null) {
          const newStepStatus = {
            ...stepCompletionStatus,
            [stepIndex]: {
              completed: true,
              timestamp,
              dataSnapshot: { ...data }
            }
          };
          setStepCompletionStatus(newStepStatus);
          localStorage.setItem(STEP_STATUS_KEY, JSON.stringify(newStepStatus));
        }

        setSavedData(data);
        setLastSaved(new Date(timestamp));

        // Show success indicator briefly
        setTimeout(() => {
          setIsAutoSaving(false);
        }, 500);

      } catch (error) {
        console.error('Auto-save failed:', error);
        setIsAutoSaving(false);
        toast.error('Failed to save progress automatically');
      }
    }, autosaveDelay),
    [FORM_DATA_KEY, STEP_STATUS_KEY, TIMESTAMP_KEY, stepCompletionStatus, autosaveDelay]
  );

  // Auto-save form data
  const autoSave = useCallback((data, stepIndex = null) => {
    // Cancel previous auto-save if still pending
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    debouncedAutoSave(data, stepIndex);
  }, [debouncedAutoSave]);

  // Manual save function
  const saveNow = useCallback(async (data, stepIndex = null) => {
    // Cancel any pending auto-save
    debouncedAutoSave.cancel();

    setIsAutoSaving(true);

    try {
      const timestamp = new Date().toISOString();

      localStorage.setItem(FORM_DATA_KEY, JSON.stringify(data));
      localStorage.setItem(TIMESTAMP_KEY, timestamp);

      if (stepIndex !== null) {
        const newStepStatus = {
          ...stepCompletionStatus,
          [stepIndex]: {
            completed: true,
            timestamp,
            dataSnapshot: { ...data }
          }
        };
        setStepCompletionStatus(newStepStatus);
        localStorage.setItem(STEP_STATUS_KEY, JSON.stringify(newStepStatus));
      }

      setSavedData(data);
      setLastSaved(new Date(timestamp));
      setIsAutoSaving(false);

      toast.success('Progress saved successfully!');

      return true;
    } catch (error) {
      console.error('Manual save failed:', error);
      setIsAutoSaving(false);
      toast.error('Failed to save progress');
      return false;
    }
  }, [FORM_DATA_KEY, STEP_STATUS_KEY, TIMESTAMP_KEY, stepCompletionStatus]);

  // Save file data separately (files can't be stored in localStorage)
  const saveFileData = useCallback((fileData) => {
    try {
      // Store file metadata only (name, size, type)
      const fileMetadata = {};
      Object.entries(fileData).forEach(([key, file]) => {
        if (file) {
          fileMetadata[key] = {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified
          };
        }
      });

      localStorage.setItem(FILES_KEY, JSON.stringify(fileMetadata));
      return true;
    } catch (error) {
      console.error('Error saving file metadata:', error);
      return false;
    }
  }, [FILES_KEY]);

  // Load file metadata
  const loadFileMetadata = useCallback(() => {
    try {
      const savedFiles = localStorage.getItem(FILES_KEY);
      return savedFiles ? JSON.parse(savedFiles) : {};
    } catch (error) {
      console.error('Error loading file metadata:', error);
      return {};
    }
  }, [FILES_KEY]);

  // Clear all persisted data
  const clearPersistedData = useCallback(() => {
    try {
      localStorage.removeItem(FORM_DATA_KEY);
      localStorage.removeItem(STEP_STATUS_KEY);
      localStorage.removeItem(TIMESTAMP_KEY);
      localStorage.removeItem(FILES_KEY);

      setSavedData({});
      setStepCompletionStatus({});
      setLastSaved(null);
      setIsAutoSaving(false);

      toast.success('Registration data cleared');
    } catch (error) {
      console.error('Error clearing persisted data:', error);
      toast.error('Failed to clear data');
    }
  }, [FORM_DATA_KEY, STEP_STATUS_KEY, TIMESTAMP_KEY, FILES_KEY]);

  // Check if data exists for resuming
  const hasPersistedData = useCallback(() => {
    try {
      const data = localStorage.getItem(FORM_DATA_KEY);
      return !!data && Object.keys(JSON.parse(data)).length > 0;
    } catch {
      return false;
    }
  }, [FORM_DATA_KEY]);

  // Get completion percentage
  const getCompletionPercentage = useCallback(() => {
    const completedSteps = Object.values(stepCompletionStatus).filter(
      status => status.completed
    ).length;
    return Math.round((completedSteps / stepCount) * 100);
  }, [stepCompletionStatus, stepCount]);

  // Get step completion status
  const isStepCompleted = useCallback((stepIndex) => {
    return stepCompletionStatus[stepIndex]?.completed || false;
  }, [stepCompletionStatus]);

  // Mark step as completed
  const markStepCompleted = useCallback((stepIndex, data) => {
    const timestamp = new Date().toISOString();
    const newStepStatus = {
      ...stepCompletionStatus,
      [stepIndex]: {
        completed: true,
        timestamp,
        dataSnapshot: { ...data }
      }
    };

    setStepCompletionStatus(newStepStatus);
    localStorage.setItem(STEP_STATUS_KEY, JSON.stringify(newStepStatus));
  }, [STEP_STATUS_KEY, stepCompletionStatus]);

  // Get next incomplete step
  const getNextIncompleteStep = useCallback(() => {
    for (let i = 0; i < stepCount; i++) {
      if (!isStepCompleted(i)) {
        return i;
      }
    }
    return stepCount - 1; // All steps completed, return last step
  }, [stepCount, isStepCompleted]);

  // Data expiry check (optional - remove old data after certain period)
  const isDataExpired = useCallback((expiryDays = 7) => {
    if (!lastSaved) return false;

    const expiryTime = new Date(lastSaved);
    expiryTime.setDate(expiryTime.getDate() + expiryDays);

    return new Date() > expiryTime;
  }, [lastSaved]);

  // Auto-cleanup expired data
  useEffect(() => {
    if (isDataExpired()) {
      console.log('Clearing expired registration data');
      clearPersistedData();
    }
  }, [isDataExpired, clearPersistedData]);

  // Format last saved time for display
  const getLastSavedText = useCallback(() => {
    if (!lastSaved) return null;

    const now = new Date();
    const diffMs = now - lastSaved;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Saved just now';
    if (diffMins < 60) return `Saved ${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `Saved ${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;

    return `Saved on ${lastSaved.toLocaleDateString()}`;
  }, [lastSaved]);

  // Export data for backup/sharing
  const exportData = useCallback(() => {
    try {
      const exportData = {
        formData: savedData,
        stepStatus: stepCompletionStatus,
        timestamp: lastSaved,
        fileMetadata: loadFileMetadata(),
        version: '1.0'
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `driver-registration-backup-${new Date().toISOString().split('T')[0]}.json`;
      link.click();

      URL.revokeObjectURL(url);
      toast.success('Registration data exported successfully');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export data');
    }
  }, [savedData, stepCompletionStatus, lastSaved, loadFileMetadata]);

  // Import data from backup
  const importData = useCallback((fileContent) => {
    try {
      const importedData = JSON.parse(fileContent);

      if (importedData.formData) {
        localStorage.setItem(FORM_DATA_KEY, JSON.stringify(importedData.formData));
        setSavedData(importedData.formData);
      }

      if (importedData.stepStatus) {
        localStorage.setItem(STEP_STATUS_KEY, JSON.stringify(importedData.stepStatus));
        setStepCompletionStatus(importedData.stepStatus);
      }

      if (importedData.timestamp) {
        localStorage.setItem(TIMESTAMP_KEY, importedData.timestamp);
        setLastSaved(new Date(importedData.timestamp));
      }

      if (importedData.fileMetadata) {
        localStorage.setItem(FILES_KEY, JSON.stringify(importedData.fileMetadata));
      }

      toast.success('Registration data imported successfully');
      return true;
    } catch (error) {
      console.error('Import failed:', error);
      toast.error('Failed to import data - invalid file format');
      return false;
    }
  }, [FORM_DATA_KEY, STEP_STATUS_KEY, TIMESTAMP_KEY, FILES_KEY]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      debouncedAutoSave.cancel();
    };
  }, [debouncedAutoSave]);

  return {
    // State
    isAutoSaving,
    lastSaved,
    savedData,
    stepCompletionStatus,

    // Core functions
    autoSave,
    saveNow,
    clearPersistedData,

    // File handling
    saveFileData,
    loadFileMetadata,

    // Step management
    isStepCompleted,
    markStepCompleted,
    getNextIncompleteStep,
    getCompletionPercentage,

    // Utility functions
    hasPersistedData,
    getLastSavedText,
    isDataExpired,
    exportData,
    importData
  };
};

export default useDataPersistence;