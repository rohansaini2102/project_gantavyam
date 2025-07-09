import React from 'react';

const ModernCard = ({ 
  children, 
  className = '', 
  title, 
  subtitle, 
  icon, 
  actions,
  padding = 'p-6',
  hover = true,
  shadow = 'shadow-sm',
  borderRadius = 'rounded-lg'
}) => {
  return (
    <div
      className={`
        bg-white 
        ${shadow} 
        ${borderRadius} 
        border border-gray-200 
        ${hover ? 'hover:shadow-md transition-shadow duration-200' : ''}
        ${className}
      `}
    >
      {/* Header */}
      {(title || subtitle || icon || actions) && (
        <div className={`${padding} border-b border-gray-100`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              {icon && (
                <div className="flex-shrink-0">
                  {typeof icon === 'string' ? (
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <span className="text-blue-600 text-lg">{icon}</span>
                    </div>
                  ) : (
                    icon
                  )}
                </div>
              )}
              <div>
                {title && (
                  <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                )}
                {subtitle && (
                  <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
                )}
              </div>
            </div>
            {actions && (
              <div className="flex items-center space-x-2">
                {actions}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Content */}
      <div className={title || subtitle || icon || actions ? padding : padding}>
        {children}
      </div>
    </div>
  );
};

export default ModernCard;