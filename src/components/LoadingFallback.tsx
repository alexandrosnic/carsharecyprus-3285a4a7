import React from 'react';
import { Loader2 } from 'lucide-react';
import { BRAND_LOGO } from '@/constants/brand';

interface LoadingFallbackProps {
  message?: string;
  fullScreen?: boolean;
}

export const LoadingFallback: React.FC<LoadingFallbackProps> = ({ 
  message = "Loading...",
  fullScreen = false 
}) => {
  const containerClasses = fullScreen 
    ? "min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800"
    : "flex items-center justify-center p-8";

  return (
    <div className={containerClasses}>
      <div className="text-center space-y-4">
        <div className="relative">
          <img 
            src={BRAND_LOGO} 
            alt="Car Share Cyprus Logo" 
            className="h-12 w-12 mx-auto animate-bounce" 
          />
          <Loader2 className="h-6 w-6 text-primary/60 animate-spin absolute -bottom-1 -right-1" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">
            {message}
          </h3>
          <p className="text-sm text-muted-foreground">
            Please wait while we prepare your experience
          </p>
        </div>
        <div className="flex justify-center space-x-1">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse delay-100"></div>
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse delay-200"></div>
        </div>
      </div>
    </div>
  );
};

export default LoadingFallback;