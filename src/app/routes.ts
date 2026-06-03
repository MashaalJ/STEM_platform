/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export function homePathForRole(role: string | undefined | null): string {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'student':
      return '/galaxy';
    case 'parent':
      return '/parent';
    case 'teacher':
      return '/teacher';
    case 'school_admin':
      return '/school';
    default:
      return '/galaxy';
  }
}

export function isImmersivePath(pathname: string): boolean {
  return (
    pathname.startsWith('/galaxy') ||
    pathname.startsWith('/mission') ||
    pathname === '/parent' ||
    pathname.startsWith('/console/quiz') ||
    pathname.startsWith('/console/challenge')
  );
}
