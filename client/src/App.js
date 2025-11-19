// client/src/App.js
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { LoadScript } from '@react-google-maps/api';
import LandingPage from './pages/LandingPage';
// Initialize app startup procedures (removed automatic import to prevent driver logout)
// State Management
import { DriverStateProvider } from './contexts/DriverStateContext';
import { AdminProvider, PERMISSIONS } from './contexts/AdminContext';
// Admin
import AdminLayout from './components/admin/AdminLayout';
import ProtectedAdminRoute from './components/admin/ProtectedAdminRoute';
import PermissionRoute from './components/admin/PermissionRoute';
import AdminDashboard from './pages/admin/Dashboard';
import AddUser from './pages/admin/AddUser';
import ViewUsers from './pages/admin/ViewUsers';
import ViewUserDetails from './pages/admin/ViewUserDetails';
import AddDriver from './pages/admin/AddDriver';
import AdminLogin from './pages/admin/AdminLogin';
import AllDrivers from './pages/admin/AllDrivers';
import RideManagement from './pages/admin/RideManagement';
import QueueManagement from './pages/admin/QueueManagement';
import BoothManagement from './pages/admin/BoothManagement';
import ManualBooking from './pages/admin/ManualBooking';
import FareManagement from './pages/admin/FareManagement';
// Driver
import ModernDriverDashboard from './components/driver/minimal/ModernDriverDashboard';
import DriverLogin from './pages/driver/Login';
import DriverSignup from './pages/driver/Signup';
import DriverProfile from './pages/driver/Profile';
import PendingApproval from './pages/driver/PendingApproval';
// User
import UserDashboard from './pages/user/Dashboard';
import NewUserDashboard from './pages/user/NewDashboard';
import UserLogin from './pages/user/Login';
import UserSignup from './pages/user/Signup';
import ForgotPassword from './pages/user/ForgotPassword';
// Test Pages
import UserBooking from './pages/test/UserBooking';
import DriverView from './pages/test/DriverView';

// Move these OUTSIDE the component to prevent recreation on each render
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
const libraries = ["places", "geometry", "routes"]; // Static array prevents LoadScript reload warnings

function App() {
  return (
    <AdminProvider>
      <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY} libraries={libraries} >
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={
            <ProtectedAdminRoute>
              <AdminLayout />
            </ProtectedAdminRoute>
          }>
            <Route index element={<AdminDashboard />} />
            <Route path="register-driver" element={
              <PermissionRoute requiredPermission={PERMISSIONS.DRIVERS_CREATE}>
                <AddDriver />
              </PermissionRoute>
            } />
            <Route path="add-user" element={
              <PermissionRoute requiredPermission={PERMISSIONS.USERS_CREATE}>
                <AddUser />
              </PermissionRoute>
            } />
            <Route path="drivers" element={<AllDrivers />} />
            <Route path="view-users" element={<ViewUsers />} />
            <Route path="rides" element={<RideManagement />} />
            <Route path="manual-booking" element={
              <PermissionRoute requiredPermission={PERMISSIONS.RIDES_MANUAL_BOOKING}>
                <ManualBooking />
              </PermissionRoute>
            } />
            <Route path="queue" element={<QueueManagement />} />
            <Route path="booths" element={<BoothManagement />} />
            <Route path="fare-management" element={
              <PermissionRoute requiredPermission={PERMISSIONS.FARE_VIEW}>
                <FareManagement />
              </PermissionRoute>
            } />
          </Route>
          <Route path="/admin/users/:id" element={
            <ProtectedAdminRoute>
              <ViewUserDetails />
            </ProtectedAdminRoute>
          } />
          <Route path="/admin/drivers" element={
            <ProtectedAdminRoute>
              <AllDrivers />
            </ProtectedAdminRoute>
          } />
          <Route path="/driver/signup" element={<DriverSignup />} />
          <Route path="/driver/login" element={<DriverLogin />} />
          <Route path="/user/signup" element={<UserSignup />} />
          <Route path="/user/login" element={<UserLogin />} />
          <Route path="/user/dashboard" element={<NewUserDashboard />} />
          <Route path="/user/dashboard-old" element={<UserDashboard />} />
          <Route path="/driver/dashboard" element={
            <DriverStateProvider>
              <ModernDriverDashboard />
            </DriverStateProvider>
          } />
          <Route path="/driver/minimal" element={
            <DriverStateProvider>
              <ModernDriverDashboard />
            </DriverStateProvider>
          } />
          <Route path="/driver/profile/:id" element={<DriverProfile />} />
          <Route path="/user/forgot-password" element={<ForgotPassword />} />
          <Route path="/driver/pending" element={<PendingApproval />} />
          {/* Test Routes */}
          <Route path="/test/user" element={<UserBooking />} />
          <Route path="/test/driver" element={<DriverView />} />
        </Routes>
      </LoadScript>
    </AdminProvider>
  );
}

export default App;