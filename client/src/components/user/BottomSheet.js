import React, { useState, useEffect, useRef } from 'react';

const BottomSheet = ({ 
  isOpen, 
  onClose, 
  children, 
  height = 'auto',
  maxHeight = '80vh',
  snapPoints = ['25%', '50%', '80%'],
  initialSnap = 0,
  persistent = false
}) => {
  const [currentSnap, setCurrentSnap] = useState(initialSnap);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartSnap, setDragStartSnap] = useState(0);
  const sheetRef = useRef(null);

  const handleTouchStart = (e) => {
    setIsDragging(true);
    setDragStartY(e.touches[0].clientY);
    setDragStartSnap(currentSnap);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - dragStartY;
    const windowHeight = window.innerHeight;
    
    // Calculate new snap point based on drag
    const dragPercent = deltaY / windowHeight;
    let newSnap = dragStartSnap;
    
    if (dragPercent > 0.1 && currentSnap > 0) {
      newSnap = Math.max(0, currentSnap - 1);
    } else if (dragPercent < -0.1 && currentSnap < snapPoints.length - 1) {
      newSnap = Math.min(snapPoints.length - 1, currentSnap + 1);
    }
    
    setCurrentSnap(newSnap);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    
    // If dragged to closed position and not persistent, close
    if (currentSnap === 0 && !persistent) {
      onClose();
    }
  };

  const getSnapHeight = (snapIndex) => {
    const point = snapPoints[snapIndex];
    if (typeof point === 'string' && point.includes('%')) {
      return point;
    }
    return `${point}px`;
  };

  if (!isOpen && !persistent) return null;

  return (
    <>
      {/* Overlay */}
      {isOpen && currentSnap > 0 && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-30 z-40 transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className={`
          fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50
          transform transition-transform duration-300 ease-out
          ${isDragging ? 'transition-none' : ''}
        `}
        style={{
          height: persistent ? getSnapHeight(currentSnap) : (isOpen ? getSnapHeight(currentSnap) : '0px'),
          transform: `translateY(${isOpen ? '0%' : '100%'})`
        }}
      >
        {/* Handle */}
        <div 
          className="flex justify-center py-3 cursor-pointer touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-12 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Content */}
        <div 
          className="px-4 pb-4 overflow-y-auto"
          style={{ 
            maxHeight: `calc(${getSnapHeight(currentSnap)} - 3rem)` 
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
};

export default BottomSheet;