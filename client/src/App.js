// client/src/App.js
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { LoadScript } from '@react-google-maps/api';
import LandingPage from './pages/LandingPage';
// Admin
import AdminLayout from './components/admin/AdminLayout';
import ProtectedAdminRoute from './components/admin/ProtectedAdminRoute';
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
// Driver
import DriverDashboard from './pages/driver/Dashboard';
import NewDriverDashboard from './pages/driver/NewDashboard';
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

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
const libraries = ["places", "geometry"];

function App() {
  return (
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
          <Route path="register-driver" element={<AddDriver />} />
          <Route path="add-user" element={<AddUser />} />
          <Route path="drivers" element={<AllDrivers />} />
          <Route path="view-users" element={<ViewUsers />} />
          <Route path="rides" element={<RideManagement />} />
          <Route path="manual-booking" element={<ManualBooking />} />
          <Route path="queue" element={<QueueManagement />} />
          <Route path="booths" element={<BoothManagement />} />
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
        <Route path="/driver/dashboard" element={<NewDriverDashboard />} />
        <Route path="/driver/dashboard-old" element={<DriverDashboard />} />
        <Route path="/driver/profile/:id" element={<DriverProfile />} />
        <Route path="/user/forgot-password" element={<ForgotPassword />} />
        <Route path="/driver/pending" element={<PendingApproval />} />
        {/* Test Routes */}
        <Route path="/test/user" element={<UserBooking />} />
        <Route path="/test/driver" element={<DriverView />} />
      </Routes>
    </LoadScript>
  );
}

export default App;