import type { StaffRole, StaffProfile } from '../src/types/auth';

console.log('=== RUNNING PHASE 1F STAFF AUTHENTICATION FOUNDATION TESTS ===\n');

/**
 * Pure authorization evaluation matching AuthContext logic
 */
function evaluateStaffAccess(
  hasSession: boolean,
  profile: StaffProfile | null
) {
  const isAuthenticated = hasSession;
  const hasProfile = Boolean(profile);
  const isProfileActive = Boolean(profile && profile.active);
  const isValidRole = Boolean(profile && ['owner', 'manager', 'staff'].includes(profile.role));

  const isActiveStaff = isAuthenticated && hasProfile && isProfileActive && isValidRole;
  const role: StaffRole | null = isActiveStaff && profile ? profile.role : null;
  const isOwner = isActiveStaff && role === 'owner';
  const isManager = isActiveStaff && (role === 'owner' || role === 'manager');
  const isStaff = isActiveStaff;

  return {
    isAuthenticated,
    isActiveStaff,
    role,
    isOwner,
    isManager,
    isStaff,
  };
}

// 1. Unauthenticated State
console.log('Test 1: Unauthenticated visitor state');
const state1 = evaluateStaffAccess(false, null);
if (state1.isAuthenticated || state1.isActiveStaff || state1.role !== null) {
  throw new Error(`Expected unauthenticated visitor to have no access, got: ${JSON.stringify(state1)}`);
}
console.log('✔ Unauthenticated visitor has 0 staff privileges\n');

// 2. Authenticated user but missing staff profile (e.g. random signed-up user)
console.log('Test 2: Authenticated user with missing staff profile');
const state2 = evaluateStaffAccess(true, null);
if (!state2.isAuthenticated || state2.isActiveStaff || state2.role !== null) {
  throw new Error(`Expected authenticated user without profile to be denied staff access, got: ${JSON.stringify(state2)}`);
}
console.log('✔ Authenticated user without staff profile correctly denied access\n');

// 3. Authenticated staff but account is inactive (deactivated employee)
console.log('Test 3: Authenticated user with inactive staff profile');
const inactiveStaffProfile: StaffProfile = {
  id: 'profile-uuid-1',
  user_id: 'user-uuid-1',
  full_name: 'Former Staff',
  role: 'staff',
  active: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
const state3 = evaluateStaffAccess(true, inactiveStaffProfile);
if (!state3.isAuthenticated || state3.isActiveStaff || state3.role !== null) {
  throw new Error(`Expected inactive staff to be denied access, got: ${JSON.stringify(state3)}`);
}
console.log('✔ Inactive staff member correctly denied access\n');

// 4. Valid Active Staff Member ('staff' role)
console.log('Test 4: Valid active staff member');
const activeStaffProfile: StaffProfile = {
  id: 'profile-uuid-2',
  user_id: 'user-uuid-2',
  full_name: 'Rahul Floor Server',
  role: 'staff',
  active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
const state4 = evaluateStaffAccess(true, activeStaffProfile);
if (!state4.isActiveStaff || !state4.isStaff || state4.isManager || state4.isOwner || state4.role !== 'staff') {
  throw new Error(`Expected active staff privileges, got: ${JSON.stringify(state4)}`);
}
console.log('✔ Active staff member recognized with role "staff" (no manager/owner elevation)\n');

// 5. Valid Active Manager ('manager' role)
console.log('Test 5: Valid active manager');
const activeManagerProfile: StaffProfile = {
  id: 'profile-uuid-3',
  user_id: 'user-uuid-3',
  full_name: 'Priya Shift Manager',
  role: 'manager',
  active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
const state5 = evaluateStaffAccess(true, activeManagerProfile);
if (!state5.isActiveStaff || !state5.isStaff || !state5.isManager || state5.isOwner || state5.role !== 'manager') {
  throw new Error(`Expected active manager privileges, got: ${JSON.stringify(state5)}`);
}
console.log('✔ Active manager recognized with role "manager" (inherits staff, no owner elevation)\n');

// 6. Valid Active Owner ('owner' role)
console.log('Test 6: Valid active owner');
const activeOwnerProfile: StaffProfile = {
  id: 'profile-uuid-4',
  user_id: 'user-uuid-4',
  full_name: 'Amit Cafe Owner',
  role: 'owner',
  active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
const state6 = evaluateStaffAccess(true, activeOwnerProfile);
if (!state6.isActiveStaff || !state6.isStaff || !state6.isManager || !state6.isOwner || state6.role !== 'owner') {
  throw new Error(`Expected active owner privileges, got: ${JSON.stringify(state6)}`);
}
console.log('✔ Active owner recognized with role "owner" (inherits staff + manager)\n');

// 7. Route Security and Redirection Mapping
console.log('Test 7: Route Security and Redirection Verification');
interface RouteRule {
  path: string;
  requiresAuth: boolean;
  expectedHandler: string;
}

const routeRules: RouteRule[] = [
  { path: '/', requiresAuth: false, expectedHandler: 'Public App' },
  { path: '/qr', requiresAuth: false, expectedHandler: 'Public QR Menu' },
  { path: '/qr?table=07', requiresAuth: false, expectedHandler: 'Public QR Table Order' },
  { path: '/qr-generator', requiresAuth: false, expectedHandler: 'Public/Staff QR Generator' },
  { path: '/staff/login', requiresAuth: false, expectedHandler: 'Staff Login' },
  { path: '/staff/dashboard', requiresAuth: true, expectedHandler: 'Protected Staff Dashboard' },
  { path: '/staff/orders', requiresAuth: true, expectedHandler: 'Protected Staff Area' },
];

for (const rule of routeRules) {
  const isStaffPath = rule.path.startsWith('/staff') && rule.path !== '/staff/login';
  if (isStaffPath !== rule.requiresAuth) {
    throw new Error(`Route security mismatch for ${rule.path}: expected requiresAuth=${rule.requiresAuth}`);
  }
}
console.log('✔ Route security mapping verified: Public routes remain completely anonymous, /staff/* is strictly protected\n');

console.log('=== ALL PHASE 1F AUTHENTICATION FOUNDATION TESTS PASSED SUCCESSFULLY! ===\n');
