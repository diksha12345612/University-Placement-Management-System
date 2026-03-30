import React from 'react';

/**
 * LoadingSpinner Component
 * A centralized, elegant loading indicator with glassmorphism.
 * 
 * @param {Object} props - Component props
 * @param {boolean} [props.fullPage=false] - Whether to show as a full-page overlay
 * @param {string} [props.message='Loading...'] - Optional message to display
 */
const LoadingSpinner = ({ fullPage = false, message = 'Preparing your dashboard...' }) => {
  const spinnerContent = (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="relative w-16 h-16">
        {/* Outer Ring */}
        <div className="absolute inset-0 rounded-full border-4 border-primary-light/20"></div>
        {/* Spinning Ring */}
        <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
        {/* Center Pulse */}
        <div className="absolute inset-4 rounded-full bg-primary/20 animate-pulse"></div>
      </div>
      {message && (
        <p className="text-sm font-medium text-text-secondary animate-pulse">
          {message}
        </p>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-bg-dark/80 backdrop-blur-sm">
        <div className="p-8 rounded-2xl glass-heavy">
          {spinnerContent}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-8">
      {spinnerContent}
    </div>
  );
};

export default LoadingSpinner;
