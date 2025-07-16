import React, { useState, useRef, useEffect } from 'react';

const SwipeableCard = ({ 
  children, 
  leftAction, 
  rightAction, 
  onLeftSwipe, 
  onRightSwipe,
  className = '',
  threshold = 80 
}) => {
  const [isSwipingLeft, setIsSwipingLeft] = useState(false);
  const [isSwipingRight, setIsSwipingRight] = useState(false);
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  const cardRef = useRef(null);
  const startX = useRef(0);
  const currentX = useRef(0);

  // Handle touch start
  const handleTouchStart = (e) => {
    startX.current = e.touches[0].clientX;
    setIsDragging(true);
  };

  // Handle touch move
  const handleTouchMove = (e) => {
    if (!isDragging) return;
    
    currentX.current = e.touches[0].clientX;
    const diffX = currentX.current - startX.current;
    
    // Limit swipe distance
    const maxSwipe = 120;
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
    if (!isDragging) return;
    
    const diffX = currentX.current - startX.current;
    
    // Execute actions if threshold is met
    if (diffX > threshold && onRightSwipe) {
      onRightSwipe();
    } else if (diffX < -threshold && onLeftSwipe) {
      onLeftSwipe();
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
    startX.current = e.clientX;
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    
    currentX.current = e.clientX;
    const diffX = currentX.current - startX.current;
    
    const maxSwipe = 120;
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
    if (!isDragging) return;
    
    const diffX = currentX.current - startX.current;
    
    if (diffX > threshold && onRightSwipe) {
      onRightSwipe();
    } else if (diffX < -threshold && onLeftSwipe) {
      onLeftSwipe();
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
    <div className={`relative overflow-hidden ${className}`}>
      {/* Left Action (shown when swiping right) */}
      {leftAction && (
        <div className={`
          absolute left-0 top-0 bottom-0 flex items-center justify-center
          transition-all duration-200 ease-out
          ${isSwipingRight 
            ? 'bg-green-500 text-white px-4' 
            : 'bg-green-400 text-white px-2 opacity-50'
          }
        `}>
          {leftAction}
        </div>
      )}

      {/* Right Action (shown when swiping left) */}
      {rightAction && (
        <div className={`
          absolute right-0 top-0 bottom-0 flex items-center justify-center
          transition-all duration-200 ease-out
          ${isSwipingLeft 
            ? 'bg-blue-500 text-white px-4' 
            : 'bg-blue-400 text-white px-2 opacity-50'
          }
        `}>
          {rightAction}
        </div>
      )}

      {/* Main Card Content */}
      <div
        ref={cardRef}
        className={`
          relative bg-white transition-transform duration-200 ease-out select-none
          ${isDragging ? 'transition-none' : ''}
        `}
        style={{
          transform: `translateX(${translateX}px)`
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
      >
        {children}
      </div>

      {/* Swipe Hint Overlay */}
      {(isSwipingLeft || isSwipingRight) && (
        <div className="absolute inset-0 pointer-events-none">
          <div className={`
            absolute top-1/2 transform -translate-y-1/2 px-4 py-2 rounded-full
            text-sm font-medium transition-all duration-200
            ${isSwipingRight 
              ? 'left-4 bg-green-500 text-white' 
              : 'right-4 bg-blue-500 text-white'
            }
          `}>
            {isSwipingRight ? 'Book Again' : 'Download'}
          </div>
        </div>
      )}
    </div>
  );
};

export default SwipeableCard;