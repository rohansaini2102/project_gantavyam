import React from 'react';
import { FiNavigation, FiMap } from 'react-icons/fi';

/**
 * MapButton Component
 * Reusable button for triggering map/navigation actions
 * Responsive and touch-optimized
 */
function MapButton({
  onClick,
  variant = 'primary',
  size = 'medium',
  isLoading = false,
  disabled = false,
  iconOnly = false,
  className = '',
  children,
}) {
  // Variant styles
  const variantStyles = {
    primary: 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white shadow-md hover:shadow-lg',
    secondary: 'bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-700 border-2 border-gray-300 shadow-sm',
    outline: 'bg-transparent hover:bg-blue-50 active:bg-blue-100 text-blue-600 border-2 border-blue-500',
  };

  // Size styles
  const sizeStyles = {
    small: iconOnly ? 'min-h-[40px] min-w-[40px] p-2' : 'min-h-[40px] py-2 px-3 text-sm',
    medium: iconOnly ? 'min-h-[48px] min-w-[48px] p-3' : 'min-h-[48px] py-3 px-4 text-base',
    large: iconOnly ? 'min-h-[56px] min-w-[56px] p-4' : 'min-h-[56px] py-4 px-6 text-lg',
  };

  // Icon sizes
  const iconSizes = {
    small: 'w-4 h-4',
    medium: 'w-5 h-5',
    large: 'w-6 h-6',
  };

  // Base styles
  const baseStyles = `
    rounded-lg font-semibold
    flex items-center justify-center gap-2
    touch-manipulation
    transition-all duration-200
    ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
  `;

  const buttonClassName = `
    ${baseStyles}
    ${variantStyles[variant]}
    ${sizeStyles[size]}
    ${className}
  `.trim();

  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={buttonClassName}
      aria-label={iconOnly ? 'View route on map' : undefined}
    >
      {isLoading ? (
        <>
          <div className={`border-2 border-current border-t-transparent rounded-full animate-spin ${iconSizes[size]}`} />
          {!iconOnly && <span>Loading...</span>}
        </>
      ) : (
        <>
          <FiNavigation className={iconSizes[size]} />
          {!iconOnly && (children || 'View Route')}
        </>
      )}
    </button>
  );
}

/**
 * MapIconButton Component
 * Icon-only variant for compact spaces
 */
export function MapIconButton({ onClick, disabled = false, className = '' }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        min-h-[40px] min-w-[40px]
        bg-blue-500 hover:bg-blue-600 active:bg-blue-700
        text-white rounded-full
        flex items-center justify-center
        shadow-md hover:shadow-lg
        transition-all duration-200
        touch-manipulation
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `.trim()}
      aria-label="View route on map"
    >
      <FiMap className="w-5 h-5" />
    </button>
  );
}

export default MapButton;
