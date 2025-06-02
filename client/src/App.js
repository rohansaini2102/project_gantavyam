// client/src/App.js
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { LoadScript } from '@react-google-maps/api';
import LandingPage from './pages/LandingPage';
// Admin
import AdminLayout from './components/admin/AdminLayout';
import AdminDashboard from './pages/admin/Dashboard';
import AddUser from './pages/admin/AddUser';
import ViewUsers from './pages/admin/ViewUsers';
import ViewUserDetails from './pages/admin/ViewUserDetails';
import AddDriver from './pages/admin/AddDriver';
import AdminLogin from './pages/admin/AdminLogin';
import AllDrivers from './pages/admin/AllDrivers';
// Driver
import DriverDashboard from './pages/driver/Dashboard';
import DriverLogin from './pages/driver/Login';
import DriverSignup from './pages/driver/Signup';
import DriverProfile from './pages/driver/Profile';
import PendingApproval from './pages/driver/PendingApproval';
// User
import UserDashboard from './pages/user/Dashboard';
import UserLogin from './pages/user/Login';
import UserSignup from './pages/user/Signup';
import ForgotPassword from './pages/user/ForgotPassword';

const GOOGLE_MAPS_API_KEY = "AIzaSyDFbjmVJoi2wDzwJNR2rrowpSEtSes1jw4";
const libraries = ["places", "geometry"];

function App() {
  return (
    <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY} libraries={libraries} >
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="register-driver" element={<AddDriver />} />
          <Route path="add-user" element={<AddUser />} />
          <Route path="drivers" element={<AllDrivers />} />
          <Route path="view-users" element={<ViewUsers />} />
        </Route>
        <Route path="/admin/users/:id" element={<ViewUserDetails />} />
        <Route path="/admin/drivers" element={<AllDrivers />} />
        <Route path="/driver/signup" element={<DriverSignup />} />
        <Route path="/driver/login" element={<DriverLogin />} />
        <Route path="/user/signup" element={<UserSignup />} />
        <Route path="/user/login" element={<UserLogin />} />
        <Route path="/user/dashboard" element={<UserDashboard />} />
        <Route path="/driver/dashboard" element={<DriverDashboard />} />
        <Route path="/driver/profile/:id" element={<DriverProfile />} />
        <Route path="/user/forgot-password" element={<ForgotPassword />} />
        <Route path="/driver/pending" element={<PendingApproval />} />
      </Routes>
    </LoadScript>
  );
}

export default App;