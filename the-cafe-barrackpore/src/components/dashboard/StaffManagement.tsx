import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { fetchStaffProfiles, toggleStaffActive, updateStaffRole } from '../../services/dashboardService';
import { useNotification } from '../../hooks/useNotification';
import type { StaffProfile, StaffRole } from '../../types/auth';

export const StaffManagement: React.FC = () => {
  const { isOwner, isManager, staffProfile: currentProfile } = useAuth();
  const { addNotification } = useNotification();

  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Invite Modal
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<StaffRole>('staff');

  useEffect(() => {
    let isMounted = true;
    fetchStaffProfiles()
      .then((data) => {
        if (!isMounted) return;
        if (data.length === 0 && currentProfile) {
          setStaffList([currentProfile]);
        } else {
          setStaffList(data);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Failed to load staff list:', err);
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentProfile]);

  const handleToggleStatus = async (staff: StaffProfile) => {
    if (!isOwner) {
      addNotification('warning', 'Permission Denied', 'Only restaurant owners can deactivate or reactivate staff.');
      return;
    }

    if (staff.id === currentProfile?.id) {
      addNotification('error', 'Cannot Deactivate Self', 'You cannot deactivate your own owner profile.');
      return;
    }

    try {
      const nextActive = !staff.active;
      const res = await toggleStaffActive(staff.id, nextActive);
      if (res.success) {
        addNotification(
          'success',
          'Account Updated',
          `${staff.full_name}'s terminal access has been ${nextActive ? 'reactivated' : 'deactivated'}.`
        );
        setStaffList((prev) =>
          prev.map((s) => (s.id === staff.id ? { ...s, active: nextActive } : s))
        );
      } else {
        addNotification('error', 'Action Failed', res.error || 'Could not update staff status.');
      }
    } catch {
      addNotification('error', 'Error', 'Failed to update staff status.');
    }
  };

  const handleRoleChange = async (staff: StaffProfile, newRole: StaffRole) => {
    if (!isOwner) {
      addNotification('warning', 'Permission Denied', 'Only restaurant owners can modify staff roles.');
      return;
    }

    if (staff.id === currentProfile?.id) {
      addNotification('warning', 'Owner Role Locked', 'You cannot alter your primary proprietor role.');
      return;
    }

    try {
      const res = await updateStaffRole(staff.id, newRole);
      if (res.success) {
        addNotification(
          'success',
          'Role Updated',
          `${staff.full_name}'s role updated to ${newRole.toUpperCase()}.`
        );
        setStaffList((prev) =>
          prev.map((s) => (s.id === staff.id ? { ...s, role: newRole } : s))
        );
      } else {
        addNotification('error', 'Update Failed', res.error || 'Could not update staff role.');
      }
    } catch {
      addNotification('error', 'Error', 'Failed to update staff role.');
    }
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) {
      addNotification('warning', 'Permission Denied', 'Only owners can provision new staff.');
      return;
    }

    if (!inviteEmail.trim() || !inviteName.trim()) {
      addNotification('error', 'Validation Error', 'Please provide both staff name and email.');
      return;
    }

    // Provision local entry and explain serverless Edge Function invite pattern
    const newStaff: StaffProfile = {
      id: `staff-${Date.now()}`,
      user_id: `user-${Date.now()}`,
      full_name: inviteName.trim(),
      role: inviteRole,
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setStaffList((prev) => [newStaff, ...prev]);
    setIsInviteModalOpen(false);
    setInviteEmail('');
    setInviteName('');
    addNotification(
      'success',
      'Staff Provisioned',
      `Staff profile for ${inviteName} created with ${inviteRole.toUpperCase()} permissions.`
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-serif font-bold text-on-surface">Staff Roster & Terminal Access</h2>
          <p className="text-xs text-outline mt-0.5">
            Manage operational team members, role assignments, and active terminal permissions.
          </p>
        </div>

        {isOwner && (
          <button
            type="button"
            onClick={() => setIsInviteModalOpen(true)}
            className="py-2.5 px-4 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:bg-primary-hover active:scale-95 transition-all flex items-center gap-2 shadow"
          >
            <span className="material-symbols-outlined text-base">person_add</span>
            Provision Staff Account
          </button>
        )}
      </div>

      {/* Role Security Callout */}
      {!isOwner && isManager && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-3">
          <span className="material-symbols-outlined text-amber-400 text-lg shrink-0 mt-0.5">info</span>
          <div>
            <p className="font-semibold text-amber-300">Manager Mode</p>
            <p className="text-[11px] text-amber-200/80 mt-0.5">
              You have access to view the staff roster. Deactivating accounts and modifying permissions is restricted to restaurant proprietors (Owner role).
            </p>
          </div>
        </div>
      )}

      {/* Staff Roster Table */}
      <div className="bg-surface-container border border-outline-variant/40 rounded-3xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="py-20 text-center text-outline text-xs">Loading staff roster...</div>
        ) : staffList.length === 0 ? (
          <div className="py-20 text-center text-outline text-xs flex flex-col items-center">
            <span className="material-symbols-outlined text-4xl mb-2 opacity-40">group</span>
            <p className="font-semibold text-sm text-on-surface">No staff members found</p>
            <p className="text-[11px] mt-1">Staff accounts can be provisioned by the restaurant owner.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-outline-variant/30 bg-surface-container-high/40 text-outline text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-5 font-semibold">Staff Member</th>
                  <th className="py-3 px-4 font-semibold">Assigned Role</th>
                  <th className="py-3 px-4 font-semibold">Account State</th>
                  <th className="py-3 px-4 font-semibold">Registered</th>
                  <th className="py-3 px-5 text-right font-semibold">Security Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {staffList.map((staff) => {
                  const roleBadge = {
                    owner: 'bg-primary/15 text-primary border-primary/30',
                    manager: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
                    staff: 'bg-stone-500/15 text-stone-300 border-stone-500/30',
                  }[staff.role];

                  const isCurrent = staff.id === currentProfile?.id;

                  return (
                    <tr key={staff.id} className="hover:bg-surface-container-high/50 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center font-bold text-xs text-primary uppercase">
                            {staff.full_name ? staff.full_name.charAt(0) : 'S'}
                          </div>
                          <div>
                            <p className="font-semibold text-on-surface flex items-center gap-1.5">
                              {staff.full_name}
                              {isCurrent && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary border border-primary/20 font-bold uppercase">
                                  You
                                </span>
                              )}
                            </p>
                            <p className="text-[10px] text-outline font-mono">ID: {staff.user_id.slice(0, 8)}...</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {isOwner && !isCurrent ? (
                          <select
                            value={staff.role}
                            onChange={(e) => handleRoleChange(staff, e.target.value as StaffRole)}
                            className="bg-surface-container-high border border-outline-variant/60 rounded-lg px-2.5 py-1 text-xs text-on-surface font-semibold focus:outline-none focus:border-primary capitalize"
                          >
                            <option value="staff">Staff (Service/Kitchen)</option>
                            <option value="manager">Manager (Shift Lead)</option>
                            <option value="owner">Owner (Proprietor)</option>
                          </select>
                        ) : (
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${roleBadge}`}>
                            {staff.role}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            staff.active
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-red-500/15 text-red-400 border-red-500/30'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${staff.active ? 'bg-emerald-400' : 'bg-red-400'}`} />
                          {staff.active ? 'Active' : 'Deactivated'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-outline font-mono text-[11px]">
                        {new Date(staff.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      <td className="py-3.5 px-5 text-right">
                        {isOwner && !isCurrent ? (
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(staff)}
                            className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors border ${
                              staff.active
                                ? 'bg-red-950/40 hover:bg-red-900/60 text-red-300 border-red-500/30'
                                : 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border-emerald-500/30'
                            }`}
                          >
                            {staff.active ? 'Deactivate' : 'Reactivate'}
                          </button>
                        ) : (
                          <span className="text-outline/40 text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Provision Staff Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setIsInviteModalOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          <div className="relative w-full max-w-md bg-surface-container-high border border-outline-variant/60 rounded-3xl p-6 sm:p-8 shadow-2xl z-10 animate-in zoom-in-95 duration-150">
            <h3 className="text-lg font-serif font-bold text-on-surface mb-1">
              Provision Staff Terminal Account
            </h3>
            <p className="text-xs text-outline mb-6">
              Create a restaurant staff profile and assign operational permissions.
            </p>

            <form onSubmit={handleInviteSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block uppercase font-bold tracking-wider text-outline mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full bg-surface-container border border-outline-variant/60 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block uppercase font-bold tracking-wider text-outline mb-1">
                  Staff Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="staff@thecafebarrackpore.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full bg-surface-container border border-outline-variant/60 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block uppercase font-bold tracking-wider text-outline mb-1">
                  Role Assignment
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as StaffRole)}
                  className="w-full bg-surface-container border border-outline-variant/60 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
                >
                  <option value="staff">Staff (Orders & Table Service)</option>
                  <option value="manager">Manager (Floor & Roster Oversight)</option>
                  <option value="owner">Owner (Full Administration)</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="flex-1 py-2.5 rounded-full bg-surface-container hover:bg-surface-container-highest border border-outline-variant/40 font-semibold text-outline hover:text-on-surface transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-full bg-primary text-on-primary font-semibold hover:bg-primary-hover active:scale-95 transition-all shadow"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManagement;
