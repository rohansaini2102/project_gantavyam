// Combined provider component for easy integration
import React from 'react';
import { DriverProvider } from './DriverContext';
import { BookingProvider } from './BookingContext';
import { FareProvider } from './FareContext';
import { DriverStateProvider } from './DriverStateContext';

// Export all contexts and providers
export { DriverProvider, useDriver } from './DriverContext';
export { BookingProvider, useBooking } from './BookingContext';
export { FareProvider, useFare } from './FareContext';
export { DriverStateProvider, useDriverState } from './DriverStateContext';

export const AdminContextProviders = ({ children }) => {
  return (
    <DriverProvider>
      <BookingProvider>
        <FareProvider>
          {children}
        </FareProvider>
      </BookingProvider>
    </DriverProvider>
  );
};

export default AdminContextProviders;