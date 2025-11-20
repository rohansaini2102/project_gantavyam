import React, { Component } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to an error reporting service
    console.error('Error Boundary Caught:', error, errorInfo);

    this.setState({
      error,
      errorInfo,
      errorCount: this.state.errorCount + 1
    });

    // You can also log the error to an error reporting service here
    // Example: logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Custom error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center mb-4">
              <AlertTriangle className="text-red-500 w-8 h-8 mr-3" />
              <h1 className="text-2xl font-bold text-gray-800">
                Oops! Something went wrong
              </h1>
            </div>

            <div className="mb-6">
              <p className="text-gray-600 mb-2">
                We encountered an error while processing your request. This might be a temporary issue.
              </p>

              {/* Show error details in development */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-4 p-3 bg-gray-100 rounded text-sm">
                  <summary className="cursor-pointer font-medium text-gray-700">
                    Error Details (Development Only)
                  </summary>
                  <pre className="mt-2 text-xs overflow-auto text-red-600">
                    {this.state.error.toString()}
                    {this.state.errorInfo && this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 flex items-center justify-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </button>

              <button
                onClick={this.handleGoHome}
                className="flex-1 flex items-center justify-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                <Home className="w-4 h-4 mr-2" />
                Go Home
              </button>
            </div>

            {this.state.errorCount > 2 && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-sm text-yellow-800">
                  Multiple errors detected. If this persists, please contact support or try refreshing the page.
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Return children if no error
    return this.props.children;
  }
}

// Functional wrapper for Error Boundary with custom fallback
export const ErrorBoundaryWrapper = ({ children, fallback }) => {
  return (
    <ErrorBoundary fallback={fallback}>
      {children}
    </ErrorBoundary>
  );
};

export default ErrorBoundary;