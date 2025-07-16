import React, { useState, useRef, useEffect } from 'react';

const SwipeableRideCard = ({ 
  children, 
  onAccept, 
  onDecline,
  isAccepting = false,
  className = '',
  threshold = 80,
  disabled = false 
}) => {
  const [isSwipingLeft, setIsSwipingLeft] = useState(false);
  const [isSwipingRight, setIsSwipingRight] = useState(false);
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  const cardRef = useRef(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);

  // Handle touch start
  const handleTouchStart = (e) => {
    if (disabled || isAccepting) return;
    
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    setIsDragging(true);
    
    // Add haptic feedback on iOS
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  };

  // Handle touch move
  const handleTouchMove = (e) => {
    if (!isDragging || disabled || isAccepting) return;
    
    currentX.current = e.touches[0].clientX;
    const diffX = currentX.current - startX.current;
    const diffY = e.touches[0].clientY - startY.current;
    
    // Only prevent scrolling if it's a clear horizontal swipe
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 10) {
      e.preventDefault(); // Prevent scrolling only for horizontal swipes
    }
    
    // Limit swipe distance
    const maxSwipe = 140;
    const limitedDiff = Math.max(-maxSwipe, Math.min(maxSwipe, diffX));
    
    setTranslateX(limitedDiff);
    
    // Show action hints
    if (limitedDiff > threshold) {
      setIsSwipingRight(true);
      setIsSwipingLeft(false);
    } else if (limitedDiff < -threshold) {
      setIsSwipingLeft(true);
      setIsSwipingRight(false);
    } else {
      setIsSwipingLeft(false);
      setIsSwipingRight(false);
    }
  };

  // Handle touch end
  const handleTouchEnd = () => {
    if (!isDragging || disabled || isAccepting) return;
    
    const diffX = currentX.current - startX.current;
    
    // Execute actions if threshold is met
    if (diffX > threshold && onAccept) {
      onAccept();
      // Add success haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate([50, 100, 50]);
      }
    } else if (diffX < -threshold && onDecline) {
      onDecline();
      // Add decline haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
    }
    
    // Reset state
    setTranslateX(0);
    setIsDragging(false);
    setIsSwipingLeft(false);
    setIsSwipingRight(false);
    startX.current = 0;
    currentX.current = 0;
  };

  // Handle mouse events for desktop testing
  const handleMouseDown = (e) => {
    if (disabled || isAccepting) return;
    
    startX.current = e.clientX;
    setIsDragging(true);
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (!isDragging || disabled || isAccepting) return;
    
    currentX.current = e.clientX;
    const diffX = currentX.current - startX.current;
    
    const maxSwipe = 140;
    const limitedDiff = Math.max(-maxSwipe, Math.min(maxSwipe, diffX));
    
    setTranslateX(limitedDiff);
    
    if (limitedDiff > threshold) {
      setIsSwipingRight(true);
      setIsSwipingLeft(false);
    } else if (limitedDiff < -threshold) {
      setIsSwipingLeft(true);
      setIsSwipingRight(false);
    } else {
      setIsSwipingLeft(false);
      setIsSwipingRight(false);
    }
  };

  const handleMouseUp = () => {
    if (!isDragging || disabled || isAccepting) return;
    
    const diffX = currentX.current - startX.current;
    
    if (diffX > threshold && onAccept) {
      onAccept();
    } else if (diffX < -threshold && onDecline) {
      onDecline();
    }
    
    setTranslateX(0);
    setIsDragging(false);
    setIsSwipingLeft(false);
    setIsSwipingRight(false);
    startX.current = 0;
    currentX.current = 0;
  };

  // Add mouse move and up listeners to document when dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  return (
    <div className={`driver-swipeable relative overflow-hidden ${className}`}>
      {/* Left Action (Accept - shown when swiping right) */}
      <div className={`
        driver-swipe-action accept
        transition-all duration-200 ease-out
        ${isSwipingRight 
          ? 'w-32 opacity-100' 
          : 'w-16 opacity-60'
        }
      `}>
        <div className="flex items-center space-x-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {isSwipingRight && <span className="text-sm font-semibold">Accept</span>}
        </div>
      </div>

      {/* Right Action (Decline - shown when swiping left) */}
      <div className={`
        driver-swipe-action decline
        transition-all duration-200 ease-out
        ${isSwipingLeft 
          ? 'w-32 opacity-100' 
          : 'w-16 opacity-60'
        }
      `}>
        <div className="flex items-center space-x-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          {isSwipingLeft && <span className="text-sm font-semibold">Decline</span>}
        </div>
      </div>

      {/* Main Card Content */}
      <div
        ref={cardRef}
        className={`
          driver-ride-card relative bg-white transition-transform duration-200 ease-out select-none
          ${isDragging ? 'transition-none' : ''}
          ${disabled || isAccepting ? 'opacity-50 cursor-not-allowed' : 'cursor-grab'}
          ${isDragging ? 'cursor-grabbing' : ''}
        `}
        style={{
          transform: `translateX(${translateX}px)`,
          touchAction: disabled || isAccepting ? 'auto' : 'pan-y'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
      >
        {children}
      </div>

      {/* Swipe Instruction Overlay */}
      {!isDragging && !disabled && !isAccepting && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-2 right-2 text-xs text-gray-400 bg-white bg-opacity-80 px-2 py-1 rounded">
            ← Swipe →
          </div>
        </div>
      )}

      {/* Swipe Hint Overlay */}
      {(isSwipingLeft || isSwipingRight) && (
        <div className="absolute inset-0 pointer-events-none">
          <div className={`
            absolute top-1/2 transform -translate-y-1/2 px-4 py-2 rounded-full
            text-sm font-bold transition-all duration-200 shadow-lg
            ${isSwipingRight 
              ? 'left-4 bg-green-500 text-white animate-pulse' 
              : 'right-4 bg-red-500 text-white animate-pulse'
            }
          `}>
            {isSwipingRight ? '✓ Accept Ride' : '✗ Decline Ride'}
          </div>
        </div>
      )}

      {/* Loading State Overlay */}
      {isAccepting && (
        <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500"></div>
            <span className="text-sm font-medium text-gray-600">Accepting ride...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SwipeableRideCard;