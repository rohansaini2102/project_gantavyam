import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { admin } from '../services/api';
import { getIO } from '../services/socket';

// Initial state
const initialState = {
  activeBookings: [],
  recentBookings: [],
  currentBooking: null,
  loading: false,
  error: null,
  bookingStats: {
    total: 0,
    pending: 0,
    assigned: 0,
    completed: 0
  }
};

// Action types
const BOOKING_ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  SET_ACTIVE_BOOKINGS: 'SET_ACTIVE_BOOKINGS',
  SET_RECENT_BOOKINGS: 'SET_RECENT_BOOKINGS',
  SET_CURRENT_BOOKING: 'SET_CURRENT_BOOKING',
  SET_ERROR: 'SET_ERROR',
  UPDATE_BOOKING: 'UPDATE_BOOKING',
  ADD_BOOKING: 'ADD_BOOKING',
  REMOVE_BOOKING: 'REMOVE_BOOKING',
  SET_BOOKING_STATS: 'SET_BOOKING_STATS',
  CLEAR_ERROR: 'CLEAR_ERROR',
  CLEAR_CURRENT_BOOKING: 'CLEAR_CURRENT_BOOKING'
};

// Reducer
const bookingReducer = (state, action) => {
  switch (action.type) {
    case BOOKING_ACTIONS.SET_LOADING:
      return {
        ...state,
        loading: action.payload
      };
    
    case BOOKING_ACTIONS.SET_ACTIVE_BOOKINGS:
      return {
        ...state,
        activeBookings: action.payload,
        loading: false,
        error: null
      };
    
    case BOOKING_ACTIONS.SET_RECENT_BOOKINGS:
      return {
        ...state,
        recentBookings: action.payload,
        loading: false,
        error: null
      };
    
    case BOOKING_ACTIONS.SET_CURRENT_BOOKING:
      return {
        ...state,
        currentBooking: action.payload,
        error: null
      };
    
    case BOOKING_ACTIONS.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        loading: false
      };
    
    case BOOKING_ACTIONS.UPDATE_BOOKING:
      const updatedBooking = action.payload;
      return {
        ...state,
        activeBookings: state.activeBookings.map(booking =>
          booking._id === updatedBooking._id ? { ...booking, ...updatedBooking } : booking
        ),
        recentBookings: state.recentBookings.map(booking =>
          booking._id === updatedBooking._id ? { ...booking, ...updatedBooking } : booking
        ),
        currentBooking: state.currentBooking?._id === updatedBooking._id 
          ? { ...state.currentBooking, ...updatedBooking } 
          : state.currentBooking
      };
    
    case BOOKING_ACTIONS.ADD_BOOKING:
      return {
        ...state,
        activeBookings: [action.payload, ...state.activeBookings],
        recentBookings: [action.payload, ...state.recentBookings.slice(0, 9)] // Keep only 10 recent
      };
    
    case BOOKING_ACTIONS.REMOVE_BOOKING:
      return {
        ...state,
        activeBookings: state.activeBookings.filter(booking => booking._id !== action.payload)
      };
    
    case BOOKING_ACTIONS.SET_BOOKING_STATS:
      return {
        ...state,
        bookingStats: action.payload
      };
    
    case BOOKING_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null
      };
    
    case BOOKING_ACTIONS.CLEAR_CURRENT_BOOKING:
      return {
        ...state,
        currentBooking: null
      };
    
    default:
      return state;
  }
};

// Create context
const BookingContext = createContext();

// Provider component
export const BookingProvider = ({ children }) => {
  const [state, dispatch] = useReducer(bookingReducer, initialState);

  // Actions
  const setLoading = (loading) => {
    dispatch({ type: BOOKING_ACTIONS.SET_LOADING, payload: loading });
  };

  const setActiveBookings = (bookings) => {
    dispatch({ type: BOOKING_ACTIONS.SET_ACTIVE_BOOKINGS, payload: bookings });
  };

  const setRecentBookings = (bookings) => {
    dispatch({ type: BOOKING_ACTIONS.SET_RECENT_BOOKINGS, payload: bookings });
  };

  const setCurrentBooking = (booking) => {
    dispatch({ type: BOOKING_ACTIONS.SET_CURRENT_BOOKING, payload: booking });
  };

  const setError = (error) => {
    dispatch({ type: BOOKING_ACTIONS.SET_ERROR, payload: error });
  };

  const clearError = () => {
    dispatch({ type: BOOKING_ACTIONS.CLEAR_ERROR });
  };

  const clearCurrentBooking = () => {
    dispatch({ type: BOOKING_ACTIONS.CLEAR_CURRENT_BOOKING });
  };

  const updateBooking = (booking) => {
    dispatch({ type: BOOKING_ACTIONS.UPDATE_BOOKING, payload: booking });
  };

  const addBooking = (booking) => {
    dispatch({ type: BOOKING_ACTIONS.ADD_BOOKING, payload: booking });
  };

  const removeBooking = (bookingId) => {
    dispatch({ type: BOOKING_ACTIONS.REMOVE_BOOKING, payload: bookingId });
  };

  const setBookingStats = (stats) => {
    dispatch({ type: BOOKING_ACTIONS.SET_BOOKING_STATS, payload: stats });
  };

  // Fetch active bookings
  const fetchActiveBookings = async () => {
    setLoading(true);
    clearError();
    
    try {
      const response = await admin.getActiveBookings();
      if (response.success) {
        setActiveBookings(response.bookings || response.rides || []);
      } else {
        setError('Failed to fetch active bookings');
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Error fetching active bookings');
      console.error('Error fetching active bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch recent bookings
  const fetchRecentBookings = async (limit = 10) => {
    setLoading(true);
    clearError();
    
    try {
      const response = await admin.getRecentBookings(limit);
      if (response.success) {
        setRecentBookings(response.bookings || response.rides || []);
      } else {
        setError('Failed to fetch recent bookings');
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Error fetching recent bookings');
      console.error('Error fetching recent bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch booking by ID
  const fetchBookingById = async (bookingId) => {
    setLoading(true);
    clearError();
    
    try {
      const response = await admin.getBookingById(bookingId);
      if (response.success) {
        setCurrentBooking(response.booking);
        return response.booking;
      } else {
        setError('Failed to fetch booking details');
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Error fetching booking details');
      console.error('Error fetching booking details:', error);
    } finally {
      setLoading(false);
    }
  };

  // Create manual booking
  const createManualBooking = async (bookingData) => {
    setLoading(true);
    clearError();
    
    try {
      const response = await admin.createManualBooking(bookingData);
      if (response.success) {
        addBooking(response.booking);
        setCurrentBooking(response.booking);
        return response.booking;
      } else {
        setError('Failed to create booking');
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Error creating booking');
      console.error('Error creating booking:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Socket event handlers
  useEffect(() => {
    const socket = getIO();
    
    if (socket) {
      // Listen for booking updates
      socket.on('bookingStatusUpdate', (data) => {
        updateBooking(data.booking);
      });

      // Listen for new manual bookings
      socket.on('manualBookingCreated', (data) => {
        addBooking(data);
      });

      // Listen for booking assignments
      socket.on('bookingAssigned', (data) => {
        updateBooking(data.booking);
      });

      // Listen for booking completion
      socket.on('bookingCompleted', (data) => {
        updateBooking(data.booking);
        removeBooking(data.booking._id);
      });

      return () => {
        socket.off('bookingStatusUpdate');
        socket.off('manualBookingCreated');
        socket.off('bookingAssigned');
        socket.off('bookingCompleted');
      };
    }
  }, []);

  // Auto-refresh active bookings
  useEffect(() => {
    const interval = setInterval(() => {
      fetchActiveBookings();
    }, 60000); // Refresh every minute

    return () => clearInterval(interval);
  }, []);

  const value = {
    ...state,
    actions: {
      fetchActiveBookings,
      fetchRecentBookings,
      fetchBookingById,
      createManualBooking,
      updateBooking,
      addBooking,
      removeBooking,
      setCurrentBooking,
      clearCurrentBooking,
      clearError
    }
  };

  return (
    <BookingContext.Provider value={value}>
      {children}
    </BookingContext.Provider>
  );
};

// Custom hook to use booking context
export const useBooking = () => {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error('useBooking must be used within a BookingProvider');
  }
  return context;
};

export default BookingContext;