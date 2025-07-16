// client/src/pages/DriverSignup.js
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { driverSignup } from '../../services/api';
import ModernUpload from '../../components/common/ModernUpload';
import CameraCapture from '../../components/common/CameraCapture';
import { FiUser, FiCreditCard, FiClipboard, FiLock, FiCheckCircle } from 'react-icons/fi';
import { compressMultipleImages, validateImageFile, getReadableFileSize } from '../../utils/imageCompression';

const steps = [
  { key: 'personal', label: 'Personal Info', icon: <FiUser /> },
  { key: 'bank', label: 'Bank Details', icon: <FiCreditCard /> },
  { key: 'license', label: 'Licenses', icon: <FiClipboard /> },
  { key: 'security', label: 'Security', icon: <FiLock /> },
];

const DriverSignup = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '',
    mobileNo: '',
    aadhaarNo: '',
    vehicleNo: '',
    // Bank Details
    bankName: '',
    ifscCode: '',
    accountNumber: '',
    accountHolderName: '',
    // License and Certificates
    drivingLicenseNo: '',
    permitNo: '',
    fitnessCertificateNo: '',
    insurancePolicyNo: '',
    password: '',
    confirmPassword: ''
  });
  
  const [files, setFiles] = useState({
    aadhaarPhotoFront: null,
    aadhaarPhotoBack: null,
    driverSelfie: null,
    registrationCertificatePhoto: null,
    drivingLicensePhoto: null,
    permitPhoto: null,
    fitnessCertificatePhoto: null,
    insurancePolicyPhoto: null
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState('personal');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState({});
  const [compressing, setCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(''); // Track current processing step

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Mobile number validation - only allow digits and max 10
    if (name === 'mobileNo') {
      const numbersOnly = value.replace(/[^0-9]/g, '');
      if (numbersOnly.length <= 10) {
        setFormData({ ...formData, [name]: numbersOnly });
      }
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    const fieldName = e.target.name;
    
    // Validate file
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }
    
    setFiles({ ...files, [fieldName]: file });
    
    // Mark as uploaded (pre-upload)
    setUploadedFiles(prev => ({ ...prev, [fieldName]: false }));
    
    // Show file size
    console.log(`[File Upload] ${fieldName}: ${getReadableFileSize(file.size)}`);
  };

  const handleCameraCapture = (file) => {
    // Validate file
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }
    
    setFiles({ ...files, driverSelfie: file });
    setUploadedFiles(prev => ({ ...prev, driverSelfie: false }));
    console.log(`[Camera Capture] driverSelfie: ${getReadableFileSize(file.size)}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate mobile number
    if (formData.mobileNo.length !== 10) {
      setError('Mobile number must be exactly 10 digits');
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    // Check if required files are selected
    const requiredFiles = ['aadhaarPhotoFront', 'aadhaarPhotoBack', 'driverSelfie', 'registrationCertificatePhoto', 'drivingLicensePhoto'];
    const missingFiles = requiredFiles.filter(field => !files[field]);
    if (missingFiles.length > 0) {
      setError(`Please upload all required files: ${missingFiles.join(', ')}`);
      return;
    }
    
    setLoading(true);
    setError(null);
    setCompressing(true);
    setCompressionProgress(0);
    setUploadProgress(0);
    setCurrentStep('Preparing files for upload...');
    
    try {
      // Compress images before upload
      console.log('[Registration] Starting image compression...');
      setCurrentStep('Compressing images...');
      
      const compressedFiles = await compressMultipleImages(files, (progress) => {
        setCompressionProgress(progress);
        console.log(`[Compression Progress] ${progress}%`);
      });
      
      console.log('[Registration] Image compression complete');
      setCompressing(false);
      setCurrentStep('Uploading files to server...');
      
      // Create form data with compressed images
      const submitData = new FormData();
      submitData.append('fullName', formData.fullName);
      submitData.append('mobileNo', formData.mobileNo);
      submitData.append('aadhaarNo', formData.aadhaarNo);
      submitData.append('vehicleNo', formData.vehicleNo);
      const bankDetails = {
        bankName: formData.bankName,
        ifscCode: formData.ifscCode,
        accountNumber: formData.accountNumber,
        accountHolderName: formData.accountHolderName
      };
      submitData.append('bankDetails', JSON.stringify(bankDetails));
      submitData.append('drivingLicenseNo', formData.drivingLicenseNo);
      submitData.append('permitNo', formData.permitNo);
      submitData.append('fitnessCertificateNo', formData.fitnessCertificateNo);
      submitData.append('insurancePolicyNo', formData.insurancePolicyNo);
      submitData.append('password', formData.password);
      
      // Add compressed files
      let totalCompressedSize = 0;
      Object.keys(compressedFiles).forEach(key => {
        if (compressedFiles[key] && compressedFiles[key][0]) {
          const file = compressedFiles[key][0];
          submitData.append(key, file);
          totalCompressedSize += file.size;
          console.log(`[Form Data] Adding ${key}: ${getReadableFileSize(file.size)}`);
        }
      });
      
      console.log(`[Form Data] Total compressed size: ${getReadableFileSize(totalCompressedSize)}`);
      
      // Submit with progress tracking
      await driverSignup(submitData, (progress) => {
        setUploadProgress(progress);
        
        // Update current step based on progress
        if (progress < 50) {
          setCurrentStep('Uploading files to server...');
        } else if (progress < 90) {
          setCurrentStep('Processing documents...');
        } else {
          setCurrentStep('Finalizing registration...');
        }
        
        // Mark files as uploaded based on progress
        if (progress > 0) {
          const filesCount = Object.keys(compressedFiles).length;
          const uploadedCount = Math.floor((progress / 100) * filesCount);
          const fileKeys = Object.keys(compressedFiles);
          
          const newUploadedFiles = {};
          fileKeys.forEach((key, index) => {
            newUploadedFiles[key] = index < uploadedCount;
          });
          setUploadedFiles(newUploadedFiles);
        }
      });
      
      // Mark all files as uploaded on success
      const allUploaded = {};
      Object.keys(files).forEach(key => {
        if (files[key]) allUploaded[key] = true;
      });
      setUploadedFiles(allUploaded);
      
      setCurrentStep('Registration complete!');
      setLoading(false);
      alert('Registration successful! Your account is pending admin approval.');
      navigate('/driver/login');
    } catch (err) {
      console.error('[Registration] Error:', err);
      setError(err.error || 'Failed to register. Please try again.');
      setLoading(false);
      setCompressing(false);
      setCurrentStep('');
    }
  };

  const changeSection = (section) => {
    setActiveSection(section);
  };

  return (
    <div className="min-h-screen bg-gray-100 md:flex md:flex-col md:items-center md:justify-center">
      {/* Mobile: Full width with safe padding, Desktop: Centered */}
      <div className="w-full md:max-w-2xl bg-white md:rounded-lg md:shadow-lg md:mb-4">
        <div className="p-4 md:p-8 pb-safe-area-inset-bottom">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-700 mb-2">Welcome to GANTAVYAM</h1>
          <h2 className="text-xl font-semibold text-orange-500">Driver Signup</h2>
          <p className="mt-2 text-blue-600 font-semibold">
            <Link to="/driver/login" className="hover:underline">Already registered? Login</Link>
          </p>
        </div>
        {/* Stepper */}
        <div className="flex justify-between items-center mb-6 md:mb-8 overflow-x-auto">
          {steps.map((step, idx) => (
            <div key={step.key} className="flex-1 flex flex-col items-center min-w-0 px-1">
              <div className={`flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full text-lg md:text-2xl mb-1 border-2 ${activeSection === step.key ? 'bg-sky-400 text-white border-sky-400' : 'bg-gray-200 text-gray-400 border-gray-300'}`}>{step.icon}</div>
              <span className={`text-xs font-semibold text-center ${activeSection === step.key ? 'text-sky-600' : 'text-gray-400'}`}>{step.label}</span>
              {idx < steps.length - 1 && <div className="hidden md:block w-full h-1 bg-gray-200 mt-2" />}
            </div>
          ))}
        </div>
        {error && <div className="bg-red-100 text-red-700 px-4 py-2 rounded mb-4 border-l-4 border-red-500 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="mt-4">
          {/* Personal Information Section */}
          <div className={activeSection === 'personal' ? '' : 'hidden'}>
            <h3 className="text-lg font-semibold text-blue-700 mb-4">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-700 font-medium mb-1">Full Name</label>
                <input type="text" name="fullName" value={formData.fullName} onChange={handleChange} required placeholder="Enter your full name" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-lg" />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-1">Mobile Number</label>
                <input 
                  type="tel" 
                  name="mobileNo" 
                  value={formData.mobileNo} 
                  onChange={handleChange} 
                  required 
                  placeholder="Enter 10-digit mobile number" 
                  pattern="[0-9]{10}"
                  maxLength="10"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-lg" 
                />
                <p className="text-sm text-gray-500 mt-1">Must be exactly 10 digits</p>
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-1">Aadhaar Number</label>
                <input type="text" name="aadhaarNo" value={formData.aadhaarNo} onChange={handleChange} required placeholder="Enter your 12-digit Aadhaar number" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-lg" />
              </div>
              <ModernUpload
                label="Aadhaar Photo (Front)"
                name="aadhaarPhotoFront"
                file={files.aadhaarPhotoFront}
                onChange={handleFileChange}
                isUploaded={uploadedFiles.aadhaarPhotoFront}
                required
              />
              <ModernUpload
                label="Aadhaar Photo (Back)"
                name="aadhaarPhotoBack"
                file={files.aadhaarPhotoBack}
                onChange={handleFileChange}
                isUploaded={uploadedFiles.aadhaarPhotoBack}
                required
              />
              <CameraCapture
                label="Live Photo (Selfie)"
                onCapture={handleCameraCapture}
                required
              />
              <div>
                <label className="block text-gray-700 font-medium mb-1">Vehicle Number</label>
                <input type="text" name="vehicleNo" value={formData.vehicleNo} onChange={handleChange} required placeholder="Enter your vehicle number" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-lg" />
              </div>
              <ModernUpload
                label="Registration Certificate Photo"
                name="registrationCertificatePhoto"
                file={files.registrationCertificatePhoto}
                onChange={handleFileChange}
                isUploaded={uploadedFiles.registrationCertificatePhoto}
                required
              />
            </div>
            <div className="flex justify-center gap-4 mt-6">
              <button type="button" onClick={() => changeSection('bank')} className="w-full md:w-auto px-8 py-3 bg-sky-400 text-black rounded-lg hover:bg-black hover:text-white font-semibold text-lg transition">Next</button>
            </div>
          </div>
          {/* Bank Details Section */}
          <div className={activeSection === 'bank' ? '' : 'hidden'}>
            <h3 className="text-lg font-semibold text-blue-700 mb-4">Bank Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-700 font-medium mb-1">Bank Name</label>
                <input type="text" name="bankName" value={formData.bankName} onChange={handleChange} required placeholder="Enter your bank name" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-lg" />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-1">IFSC Code</label>
                <input type="text" name="ifscCode" value={formData.ifscCode} onChange={handleChange} required placeholder="Enter IFSC code" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-lg" />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-1">Account Number</label>
                <input type="text" name="accountNumber" value={formData.accountNumber} onChange={handleChange} required placeholder="Enter account number" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-lg" />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-1">Account Holder Name</label>
                <input type="text" name="accountHolderName" value={formData.accountHolderName} onChange={handleChange} required placeholder="Enter account holder name" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-lg" />
              </div>
            </div>
            <div className="flex flex-col md:flex-row justify-center gap-4 mt-6">
              <button type="button" onClick={() => changeSection('personal')} className="w-full md:w-auto px-8 py-3 bg-sky-400 text-black rounded-lg hover:bg-black hover:text-white font-semibold text-lg transition">Back</button>
              <button type="button" onClick={() => changeSection('license')} className="w-full md:w-auto px-8 py-3 bg-black text-white rounded-lg hover:bg-sky-400 hover:text-black font-semibold text-lg transition">Next</button>
            </div>
          </div>
          {/* License and Certificates Section */}
          <div className={activeSection === 'license' ? '' : 'hidden'}>
            <h3 className="text-lg font-semibold text-blue-700 mb-4">License and Certificates</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-700 font-medium mb-1">Driving License Number</label>
                <input type="text" name="drivingLicenseNo" value={formData.drivingLicenseNo} onChange={handleChange} required placeholder="Enter driving license number" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-lg" />
              </div>
              <ModernUpload
                label="Driving License Photo"
                name="drivingLicensePhoto"
                file={files.drivingLicensePhoto}
                onChange={handleFileChange}
                isUploaded={uploadedFiles.drivingLicensePhoto}
                required
              />
              <div>
                <label className="block text-gray-700 font-medium mb-1">Permit Number <span className="text-gray-500">(Optional)</span></label>
                <input type="text" name="permitNo" value={formData.permitNo} onChange={handleChange} placeholder="Enter permit number" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-lg" />
              </div>
              <ModernUpload
                label="Permit Photo (Optional)"
                name="permitPhoto"
                file={files.permitPhoto}
                onChange={handleFileChange}
                isUploaded={uploadedFiles.permitPhoto}
                required={false}
              />
              <div>
                <label className="block text-gray-700 font-medium mb-1">Fitness Certificate Number <span className="text-gray-500">(Optional)</span></label>
                <input type="text" name="fitnessCertificateNo" value={formData.fitnessCertificateNo} onChange={handleChange} placeholder="Enter fitness certificate number" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-lg" />
              </div>
              <ModernUpload
                label="Fitness Certificate Photo (Optional)"
                name="fitnessCertificatePhoto"
                file={files.fitnessCertificatePhoto}
                onChange={handleFileChange}
                isUploaded={uploadedFiles.fitnessCertificatePhoto}
                required={false}
              />
              <div>
                <label className="block text-gray-700 font-medium mb-1">Insurance Policy Number <span className="text-gray-500">(Optional)</span></label>
                <input type="text" name="insurancePolicyNo" value={formData.insurancePolicyNo} onChange={handleChange} placeholder="Enter insurance policy number" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-lg" />
              </div>
              <ModernUpload
                label="Insurance Policy Photo (Optional)"
                name="insurancePolicyPhoto"
                file={files.insurancePolicyPhoto}
                isUploaded={uploadedFiles.insurancePolicyPhoto}
                onChange={handleFileChange}
                required={false}
              />
            </div>
            <div className="flex flex-col md:flex-row justify-center gap-4 mt-6">
              <button type="button" onClick={() => changeSection('bank')} className="w-full md:w-auto px-8 py-3 bg-sky-400 text-black rounded-lg hover:bg-black hover:text-white font-semibold text-lg transition">Back</button>
              <button type="button" onClick={() => changeSection('security')} className="w-full md:w-auto px-8 py-3 bg-black text-white rounded-lg hover:bg-sky-400 hover:text-black font-semibold text-lg transition">Next</button>
            </div>
          </div>
          {/* Security Section */}
          <div className={activeSection === 'security' ? '' : 'hidden'}>
            <h3 className="text-lg font-semibold text-blue-700 mb-4">Security</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="relative">
                <label className="block text-gray-700 font-medium mb-1">Password</label>
                <input type="password" name="password" value={formData.password} onChange={handleChange} required minLength="6" placeholder="Create a password (min. 6 characters)" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-lg pr-10" />
                {/* Password show/hide and strength meter can be added here */}
              </div>
              <div className="relative">
                <label className="block text-gray-700 font-medium mb-1">Confirm Password</label>
                <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required minLength="6" placeholder="Confirm your password" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-lg pr-10" />
              </div>
            </div>
            {(compressing || loading) && (
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-4">
                <div className="text-center">
                  {compressing && (
                    <>
                      <div className="text-blue-700 font-medium mb-2">🗜️ Compressing images...</div>
                      {compressionProgress > 0 && (
                        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                          <div 
                            className="bg-green-600 h-2 rounded-full transition-all duration-300" 
                            style={{ width: `${compressionProgress}%` }}
                          ></div>
                        </div>
                      )}
                      <div className="text-sm text-blue-600">{compressionProgress}% compressed</div>
                    </>
                  )}
                  {loading && !compressing && (
                    <>
                      <div className="text-blue-700 font-medium mb-2">📤 {currentStep}</div>
                      {uploadProgress > 0 && (
                        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                            style={{ width: `${uploadProgress}%` }}
                          ></div>
                        </div>
                      )}
                      <div className="text-sm text-blue-600">{uploadProgress}% complete</div>
                      {uploadProgress > 0 && uploadProgress < 100 && (
                        <div className="text-xs text-gray-500 mt-1">
                          Please wait while we process your documents...
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
            <div className="flex flex-col md:flex-row justify-center gap-4 mt-6">
              <button type="button" onClick={() => changeSection('license')} className="w-full md:w-auto px-8 py-3 bg-sky-400 text-black rounded-lg hover:bg-black hover:text-white font-semibold text-lg transition">Back</button>
              <button type="submit" disabled={loading || compressing} className="w-full md:w-auto px-8 py-3 bg-black text-white rounded-lg hover:bg-sky-400 hover:text-black font-semibold text-lg transition disabled:bg-gray-400 disabled:cursor-not-allowed">
                {compressing ? `Compressing... (${compressionProgress}%)` : loading ? `Uploading... (${uploadProgress}%)` : 'Sign Up'}
              </button>
            </div>
          </div>
        </form>
        </div>
      </div>
      <div className="text-center text-gray-500 text-xs p-4 md:mt-2">&copy; 2025 GANTAVYAM. All rights reserved.</div>
    </div>
  );
};

export default DriverSignup;