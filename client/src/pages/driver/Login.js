// client/src/pages/DriverLogin.js
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FaCar, FaGoogle, FaApple } from 'react-icons/fa';
import { auth } from '../../services/api';

const DriverLogin = () => {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState(1); // 1: phone/email, 2: password
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleContinue = (e) => {
    e.preventDefault();
    setError(null);
    if (!input) {
      setError('Please enter your phone number or email.');
      return;
    }
    setStep(2);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    if (!password) {
      setLoading(false);
      setError('Please enter your password.');
      return;
    }
    try {
      // Call backend login API
      const res = await auth.driverLogin({ mobileNo: input, password });
      setLoading(false);
      if (res.driver && res.driver.isVerified === false) {
        navigate('/driver/pending');
      } else if (res.driver && res.driver.isVerified === true) {
        navigate('/driver/dashboard');
      } else {
        setError('Unexpected response from server.');
      }
    } catch (err) {
      setLoading(false);
      setError(err.error || 'Login failed.');
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Navbar */}
      <nav className="w-full bg-black py-4 px-6 flex items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-sky-400 rounded-full flex items-center justify-center font-bold text-black text-xl">G</div>
          <span className="text-sky-400 text-2xl font-bold tracking-wide ml-2">GANTAVYAM</span>
        </div>
      </nav>
      {/* Centered Login Card */}
      <div className="flex-1 flex items-center justify-center py-8 px-2">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center">
          <div className="flex items-center gap-2 mb-4">
            <FaCar className="text-sky-400 text-2xl" />
            <h2 className="text-2xl font-bold text-gray-900">Driver Login</h2>
          </div>
          {step === 1 && (
            <form onSubmit={handleContinue} className="w-full flex flex-col gap-4">
              <label htmlFor="driver-login-input" className="text-gray-700 font-medium">What's your phone number or email?</label>
              <input
                id="driver-login-input"
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Enter phone number or email"
                className="w-full px-4 py-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-sky-400 text-lg"
                autoComplete="username"
                aria-label="Phone number or email"
              />
              {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
              <button
                type="submit"
                className="w-full bg-black text-white font-semibold py-3 rounded-lg hover:bg-sky-400 hover:text-black transition text-lg mt-2"
                disabled={loading}
              >
                Continue
              </button>
            </form>
          )}
          {step === 2 && (
            <form onSubmit={handleLogin} className="w-full flex flex-col gap-4 animate-fadeIn">
              <label htmlFor="driver-password-input" className="text-gray-700 font-medium">Enter your password</label>
              <input
                id="driver-password-input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-4 py-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-sky-400 text-lg"
                autoComplete="current-password"
                aria-label="Password"
              />
              {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
              <button
                type="submit"
                className="w-full bg-black text-white font-semibold py-3 rounded-lg hover:bg-sky-400 hover:text-black transition text-lg mt-2"
                disabled={loading}
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
              <button
                type="button"
                className="text-sky-400 hover:underline text-sm mt-2"
                onClick={() => setStep(1)}
              >
                Back
              </button>
            </form>
          )}
          <div className="flex items-center w-full my-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="mx-3 text-gray-400">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          <button className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-3 rounded-lg mb-2 transition">
            <FaGoogle className="text-lg" /> Continue with Google
          </button>
          <button className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-3 rounded-lg mb-2 transition">
            <FaApple className="text-lg" /> Continue with Apple
          </button>
          <div className="text-xs text-gray-400 text-center mt-4">
            By proceeding, you consent to get calls, WhatsApp or SMS/RCS messages, including by automated means, from Gantavyam and its affiliates to the number provided.
          </div>
          <div className="mt-6 text-center w-full">
            <span className="text-gray-600">New driver? </span>
            <Link to="/driver/signup" className="text-sky-400 font-semibold hover:underline">Create Account</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverLogin;