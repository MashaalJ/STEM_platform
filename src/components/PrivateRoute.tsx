/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { homePathForRole } from '../app/routes';

type PrivateRouteProps = {
  children: React.ReactNode;
  roles?: string[];
};

export default function PrivateRoute({ children, roles }: PrivateRouteProps) {
  const { isLoggedIn, student } = useApp();
  const token = typeof window !== 'undefined' ? localStorage.getItem('stemverse_access_token') : null;

  if (!token || !isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  if (roles?.length && student?.role && !roles.includes(student.role)) {
    return <Navigate to={homePathForRole(student.role)} replace />;
  }

  return <>{children}</>;
}
