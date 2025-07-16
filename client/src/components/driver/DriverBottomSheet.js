import React, { useState, useRef, useEffect } from 'react';

const DriverBottomSheet = ({ 
  isOpen = false,
  onClose,
  children,
  title,
  minHeight = 200,
  maxHeight = null,
  className = '',
  showHandle = true,
  closeOnOverlayClick = true
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [sheetHeight, setSheetHeight] = useState(minHeight);
  const [isVisible, setIsVisible] = useState(isOpen);
  
  const sheetRef = useRef(null);
  const overlayRef = useRef(null);

  // Calculate max height based on viewport
  const calculatedMaxHeight = maxHeight || window.innerHeight * 0.85;

  // Handle drag start
  const handleDragStart = (e) => {
    const touch = e.touches ? e.touches[0] : e;
    setStartY(touch.clientY);
    setCurrentY(touch.clientY);
    setIsDragging(true);
    
    // Add haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  };

  // Handle drag move
  const handleDragMove = (e) => {
    if (!isDragging || !sheetRef.current) return;
    
    e.preventDefault();
    
    const touch = e.touches ? e.touches[0] : e;
    const deltaY = startY - touch.clientY;
    const currentHeight = sheetRef.current.offsetHeight;
    const newHeight = Math.max(200, Math.min(calculatedMaxHeight, currentHeight + deltaY));
    
    setSheetHeight(newHeight);
    setStartY(touch.clientY);
  };

  // Handle drag end
  const handleDragEnd = () => {
    setIsDragging(false);
    
    // Snap to close if dragged below threshold
    if (sheetHeight < minHeight + 50) {
      onClose();
    }
  };

  // Handle overlay click
  const handleOverlayClick = (e) => {
    if (closeOnOverlayClick && e.target === overlayRef.current) {
      onClose();
    }
  };

  // Add event listeners for drag
  useEffect(() => {
    if (isDragging) {
      const handleMove = (e) => handleDragMove(e);
      const handleEnd = () => handleDragEnd();
      
      document.addEventListener('touchmove', handleMove, { passive: false });
      document.addEventListener('touchend', handleEnd);
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleEnd);
      
      return () => {
        document.removeEventListener('touchmove', handleMove);
        document.removeEventListener('touchend', handleEnd);
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleEnd);
      };
    }
  }, [isDragging, sheetHeight]);

  // Handle open/close animation
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setSheetHeight(minHeight);
    } else {
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, minHeight]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isVisible) return null;

  return (
    <div 
      ref={overlayRef}
      className={`
        fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 
        ${isOpen ? 'driver-bottom-sheet-enter-active' : 'driver-bottom-sheet-exit-active'}
        ${className}
      `}
      onClick={handleOverlayClick}
      style={{
        opacity: isOpen ? 1 : 0,
        transition: 'opacity 0.3s ease-out'
      }}
    >
      <div 
        ref={sheetRef}
        className={`
          absolute bottom-0 left-0 right-0 bg-white
          rounded-t-3xl shadow-2xl border-t border-gray-200
          transition-transform duration-300 ease-out
          ${isDragging ? 'transition-none' : ''}
          driver-mobile-panel
        `}
        style={{
          height: `${sheetHeight}px`,
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
          willChange: 'transform',
          WebkitBackfaceVisibility: 'hidden',
          backfaceVisibility: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        {showHandle && (
          <div
            className="driver-panel-handle cursor-grab active:cursor-grabbing"
            onTouchStart={handleDragStart}
            onMouseDown={handleDragStart}
            style={{ touchAction: 'none' }}
          >
            <div className={`
              w-12 h-1.5 bg-gray-300 hover:bg-gray-400 rounded-full mx-auto 
              transition-colors duration-200
              ${isDragging ? 'bg-gray-400' : ''}
            `} />
          </div>
        )}

        {/* Title */}
        {title && (
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto driver-scroll-container">
          <div className="px-6 py-4">
            {children}
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Resize Indicator */}
        {isDragging && (
          <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-20 text-white text-xs px-2 py-1 rounded">
            {Math.round(sheetHeight)}px
          </div>
        )}
      </div>
    </div>
  );
};

export default DriverBottomSheet;