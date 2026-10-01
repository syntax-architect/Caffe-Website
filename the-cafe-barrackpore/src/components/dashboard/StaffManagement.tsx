import React, { useState, useEffect, useMemo } from 'react';
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

  const activeStaffCount = useMemo(() => staffList.filter((s) => s.active).length, [staffList]);
  const managerCount = useMemo(() => staffList.filter((s) => s.role === 'manager').length, [staffList]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* COCKPIT HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">
              Security Ledger & Terminal Access
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-serif font-black text-white mt-1 tracking-tight">
            Staff & Terminals
          </h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-xl leading-relaxed">
            Manage operational team profiles, POS credentials, role authorization, and terminal permissions.
          </p>
        </div>

        {isOwner && (
          <button
            type="button"
            onClick={() => setIsInviteModalOpen(true)}
            className="relative group overflow-hidden px-5 py-3 rounded-2xl bg-gradient-to-r from-[#D4AF37] via-[#F3C766] to-[#D4AF37] text-[#070605] text-xs font-black tracking-wider uppercase shadow-[0_10px_30px_rgba(212,175,55,0.25)] hover:shadow-[0_15px_40px_rgba(212,175,55,0.4)] active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base font-bold">person_add</span>
            <span>Provision Account</span>
          </button>
        )}
      </div>

      {/* STATS STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-1 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06]">
          <div className="p-3.5 rounded-[calc(1rem-0.125rem)] bg-[#120F0D]">
            <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">Total Staff</p>
            <p className="text-xl sm:text-2xl font-serif font-bold text-white mt-0.5">{staffList.length}</p>
          </div>
        </div>
        <div className="p-1 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06]">
          <div className="p-3.5 rounded-[calc(1rem-0.125rem)] bg-[#120F0D]">
            <p className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">Active Terminals</p>
            <p className="text-xl sm:text-2xl font-serif font-bold text-emerald-400 mt-0.5">{activeStaffCount}</p>
          </div>
        </div>
        <div className="p-1 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06]">
          <div className="p-3.5 rounded-[calc(1rem-0.125rem)] bg-[#120F0D]">
            <p className="text-[10px] font-mono uppercase tracking-wider text-[#D4AF37]">Shift Managers</p>
            <p className="text-xl sm:text-2xl font-serif font-bold text-[#D4AF37] mt-0.5">{managerCount}</p>
          </div>
        </div>
        <div className="p-1 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06]">
          <div className="p-3.5 rounded-[calc(1rem-0.125rem)] bg-[#120F0D]">
            <p className="text-[10px] font-mono uppercase tracking-wider text-sky-400">Proprietor</p>
            <p className="text-xl sm:text-2xl font-serif font-bold text-sky-400 mt-0.5">
              {staffList.filter((s) => s.role === 'owner').length}
            </p>
          </div>
        </div>
      </div>

      {/* ROLE PERMISSION NOTICE */}
      {!isOwner && isManager && (
        <div className="p-1 rounded-2xl bg-gradient-to-b from-amber-500/20 to-transparent border border-amber-500/30">
          <div className="p-4 rounded-[calc(1rem-0.125rem)] bg-[#120F0D] flex items-start gap-3.5 text-xs text-amber-200">
            <span className="material-symbols-outlined text-amber-400 text-lg shrink-0 mt-0.5">shield</span>
            <div>
              <p className="font-bold text-amber-300">Manager Shift Oversight</p>
              <p className="text-[11px] text-amber-200/80 mt-0.5 leading-relaxed">
                You have active authorization to view the staff ledger. Provisioning new accounts and altering terminal roles is restricted to restaurant proprietors.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* STAFF DATA DISPLAY */}
      {isLoading ? (
        <div className="py-20 text-center text-zinc-500 font-mono text-xs">Authenticating staff roster...</div>
      ) : staffList.length === 0 ? (
        <div className="p-1.5 rounded-[2rem] bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06]">
          <div className="py-20 text-center rounded-[calc(2rem-0.375rem)] bg-[#120F0D] flex flex-col items-center">
            <span className="material-symbols-outlined text-4xl mb-2 text-zinc-600">group</span>
            <p className="font-serif font-bold text-base text-white">No staff profiles registered</p>
            <p className="text-xs text-zinc-500 mt-1">Click "Provision Account" to create your first team credential.</p>
          </div>
        </div>
      ) : (
        <>
          {/* MOBILE CARDS VIEW (< md) */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {staffList.map((staff) => {
              const isCurrent = staff.id === currentProfile?.id;
              const roleBadge = {
                owner: 'bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/30',
                manager: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
                staff: 'bg-zinc-800 text-zinc-300 border-zinc-700',
              }[staff.role];

              return (
                <div
                  key={staff.id}
                  className="p-1 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.08]"
                >
                  <div className="p-4 rounded-[calc(1rem-0.125rem)] bg-[#120F0D] flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center font-bold text-xs text-[#D4AF37] uppercase">
                          {staff.full_name ? staff.full_name.charAt(0) : 'S'}
                        </div>
                        <div>
                          <p className="font-bold text-white text-sm flex items-center gap-1.5">
                            {staff.full_name}
                            {isCurrent && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] font-mono uppercase">
                                You
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-zinc-500 font-mono">ID: {staff.user_id.slice(0, 8)}</p>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          staff.active
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${staff.active ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                        <span>{staff.active ? 'Active' : 'Off-Duty'}</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-xs">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider border ${roleBadge}`}>
                        {staff.role}
                      </span>

                      {isOwner && !isCurrent ? (
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(staff)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                            staff.active
                              ? 'bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border-rose-500/30'
                              : 'bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border-emerald-500/30'
                          }`}
                        >
                          {staff.active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      ) : (
                        <span className="text-zinc-600 font-mono text-[10px]">Protected</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* DESKTOP TABLE VIEW (>= md) */}
          <div className="hidden md:block p-1.5 rounded-[2rem] bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06] shadow-2xl overflow-hidden">
            <div className="rounded-[calc(2rem-0.375rem)] bg-[#120F0D] overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02] text-zinc-400 text-[10px] font-mono uppercase tracking-[0.16em]">
                    <th className="py-4 px-6 font-bold">Team Member</th>
                    <th className="py-4 px-4 font-bold">Assigned Role</th>
                    <th className="py-4 px-4 font-bold">Terminal Status</th>
                    <th className="py-4 px-4 font-bold">Registration Date</th>
                    <th className="py-4 px-6 text-right font-bold">Access Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {staffList.map((staff) => {
                    const roleBadge = {
                      owner: 'bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/30',
                      manager: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
                      staff: 'bg-zinc-800 text-zinc-300 border-zinc-700',
                    }[staff.role];

                    const isCurrent = staff.id === currentProfile?.id;

                    return (
                      <tr key={staff.id} className="hover:bg-white/[0.03] transition-colors">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3.5">
                            <div className="w-9 h-9 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center font-bold text-xs text-[#D4AF37] uppercase shrink-0">
                              {staff.full_name ? staff.full_name.charAt(0) : 'S'}
                            </div>
                            <div>
                              <p className="font-bold text-white flex items-center gap-2">
                                <span className="text-sm">{staff.full_name}</span>
                                {isCurrent && (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 font-mono uppercase tracking-wider">
                                    You
                                  </span>
                                )}
                              </p>
                              <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                                UID: {staff.user_id.slice(0, 12)}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          {isOwner && !isCurrent ? (
                            <select
                              value={staff.role}
                              onChange={(e) => handleRoleChange(staff, e.target.value as StaffRole)}
                              className="bg-[#070605] border border-white/[0.1] rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-[#D4AF37] capitalize cursor-pointer"
                            >
                              <option value="staff" className="bg-[#120F0D]">Staff (Service/Kitchen)</option>
                              <option value="manager" className="bg-[#120F0D]">Manager (Floor Lead)</option>
                              <option value="owner" className="bg-[#120F0D]">Owner (Proprietor)</option>
                            </select>
                          ) : (
                            <span className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${roleBadge}`}>
                              {staff.role}
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                              staff.active
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${staff.active ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                            <span>{staff.active ? 'Active' : 'Deactivated'}</span>
                          </span>
                        </td>

                        <td className="py-4 px-4 text-zinc-400 font-mono text-xs">
                          {new Date(staff.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>

                        <td className="py-4 px-6 text-right">
                          {isOwner && !isCurrent ? (
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(staff)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors border cursor-pointer ${
                                staff.active
                                  ? 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-500/30'
                                  : 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border-emerald-500/30'
                              }`}
                            >
                              {staff.active ? 'Deactivate' : 'Reactivate'}
                            </button>
                          ) : (
                            <span className="text-zinc-600 font-mono text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* DOUBLE-BEZEL PROVISION MODAL */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setIsInviteModalOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />

          <div className="relative w-full max-w-md p-1.5 rounded-[2rem] bg-gradient-to-b from-white/[0.15] via-white/[0.05] to-white/[0.02] border border-white/[0.1] shadow-2xl z-10 animate-in zoom-in-95 duration-200">
            <div className="rounded-[calc(2rem-0.375rem)] bg-[#120F0D] p-6 sm:p-8">
              <div className="flex items-center justify-between pb-4 border-b border-white/[0.06] mb-5">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">
                    Security Provisioning
                  </span>
                  <h3 className="text-xl font-serif font-black text-white mt-0.5">
                    Provision Terminal Profile
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="p-1.5 rounded-full bg-white/[0.05] text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>

              <form onSubmit={handleInviteSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                    Terminal Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="staff@thecafebarrackpore.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                    Operational Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as StaffRole)}
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                  >
                    <option value="staff" className="bg-[#120F0D]">Staff (Orders &amp; Kitchen)</option>
                    <option value="manager" className="bg-[#120F0D]">Manager (Floor &amp; Roster)</option>
                    <option value="owner" className="bg-[#120F0D]">Owner (Proprietor Full Access)</option>
                  </select>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsInviteModalOpen(false)}
                    className="flex-1 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] font-bold text-xs text-zinc-300 hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#F3C766] text-[#070605] font-black text-xs uppercase tracking-wider hover:shadow-[0_10px_25px_rgba(212,175,55,0.3)] transition-all cursor-pointer"
                  >
                    Create Account
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManagement;
