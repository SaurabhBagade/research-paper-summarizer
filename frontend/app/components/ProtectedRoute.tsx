import React from 'react';
import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = () => {
  const { isAuthenticated } = useAuth();
  
  // Check if a token exists in local storage as a fallback.
  // This prevents premature redirects on page refresh before the AuthContext finishes hydrating.
  const hasToken = !!localStorage.getItem('token') || !!localStorage.getItem('auth_token');

  if (!isAuthenticated && !hasToken) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};
