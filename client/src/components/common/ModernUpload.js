import React, { useRef } from 'react';
import { FiUploadCloud, FiCheckCircle, FiImage } from 'react-icons/fi';

const ModernUpload = ({ label, name, file, onChange, accept = 'image/*', required = false, isUploaded = false }) => {
  const inputRef = useRef();

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onChange({ target: { name, files: [e.dataTransfer.files[0]] } });
    }
  };

  const handleClick = () => {
    inputRef.current.click();
  };

  return (
    <div className="w-full">
      <label className="block text-gray-700 font-medium mb-1">{label}</label>
      <div
        className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-4 cursor-pointer transition ${isUploaded ? 'bg-green-50 border-green-400' : file ? 'bg-gray-50 hover:bg-sky-50 border-sky-400' : 'bg-gray-50 hover:bg-sky-50 border-gray-300'}`}
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        tabIndex={0}
        role="button"
        aria-label={`Upload ${label}`}
      >
        {file ? (
          <>
            {file.type && file.type.startsWith('image') ? (
              <img
                src={URL.createObjectURL(file)}
                alt="preview"
                className="w-16 h-16 object-cover rounded mb-2 border border-sky-400"
              />
            ) : (
              <FiImage className="text-4xl text-sky-400 mb-2" />
            )}
            <div className={`flex items-center gap-2 font-medium ${isUploaded ? 'text-green-600' : 'text-sky-600'}`}>
              <FiCheckCircle className={`text-xl ${isUploaded ? 'text-green-600' : ''}`} />
              {file.name}
            </div>
            {isUploaded && <span className="text-green-600 text-sm mt-1">✓ Uploaded</span>}
          </>
        ) : (
          <>
            <FiUploadCloud className="text-4xl text-sky-400 mb-2" />
            <span className="text-gray-500 text-sm">Drag & drop or click to upload</span>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          name={name}
          accept={accept}
          required={required}
          className="hidden"
          onChange={onChange}
        />
      </div>
    </div>
  );
};

export default ModernUpload; 