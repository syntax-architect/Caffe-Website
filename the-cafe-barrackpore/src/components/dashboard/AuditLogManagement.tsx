import React, { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';

interface AuditLogEntry {
  id: string;
  restaurant_id: string;
  actor_id: string | null;
  actor_role: string | null;
  actor_name: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, any>;
  ip_address: string | null;
  created_at: string;
}

export const AuditLogManagement: React.FC = () => {
  const { isOwner, isManager } = useAuth();
  const { addNotification } = useNotification();

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterAction, setFilterAction] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!supabase || !isSupabaseConfigured) {
        // Local demo audit logs
        const demoLogs: AuditLogEntry[] = [
          {
            id: 'log-1',
            restaurant_id: 'the-cafe-barrackpore',
            actor_id: 'usr-1',
            actor_role: 'owner',
            actor_name: 'Main Executive Owner',
            action: 'staff_login',
            target_type: 'auth',
            target_id: 'usr-1',
            details: { email: 'owner@thecafebarrackpore.com', role: 'owner' },
            ip_address: '103.21.244.0',
            created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
          },
          {
            id: 'log-2',
            restaurant_id: 'the-cafe-barrackpore',
            actor_id: 'usr-1',
            actor_role: 'owner',
            actor_name: 'Main Executive Owner',
            action: 'price_change',
            target_type: 'menu_item',
            target_id: 'caffe-latte',
            details: { item_name: 'Artisanal Caffè Latte', old_price: 180, new_price: 195 },
            ip_address: '103.21.244.0',
            created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
          },
          {
            id: 'log-3',
            restaurant_id: 'the-cafe-barrackpore',
            actor_id: 'usr-2',
            actor_role: 'manager',
            actor_name: 'Floor Manager',
            action: 'refund',
            target_type: 'payments',
            target_id: 'pay_9941',
            details: { order_ref: 'CB-2026-F81A', amount: 540, refund_amount: 540, reason: 'Guest cancellation' },
            ip_address: '103.21.244.12',
            created_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
          },
          {
            id: 'log-4',
            restaurant_id: 'the-cafe-barrackpore',
            actor_id: 'usr-1',
            actor_role: 'owner',
            actor_name: 'Main Executive Owner',
            action: 'role_change',
            target_type: 'staff_profile',
            target_id: 'usr-3',
            details: { staff_name: 'Rahul Sen', old_role: 'staff', new_role: 'manager' },
            ip_address: '103.21.244.0',
            created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
          },
          {
            id: 'log-5',
            restaurant_id: 'the-cafe-barrackpore',
            actor_id: 'usr-1',
            actor_role: 'owner',
            actor_name: 'Main Executive Owner',
            action: 'setting_change',
            target_type: 'restaurant_settings',
            target_id: 'current',
            details: { tax_mode: 'inclusive', tax_rate: 0.05, payment_provider: 'razorpay' },
            ip_address: '103.21.244.0',
            created_at: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
          },
        ];
        setLogs(demoLogs);
        setIsLoading(false);
        return;
      }

      let query = supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (filterAction !== 'all') {
        query = query.eq('action', filterAction);
      }

      const { data, error } = await query;
      if (error) {
        throw error;
      }

      setLogs(data || []);
    } catch (err: any) {
      console.error('[AuditLog] Error fetching audit records:', err);
      addNotification('error', 'Audit Log Error', err.message || 'Failed to load security audit records.');
    } finally {
      setIsLoading(false);
    }
  }, [filterAction, addNotification]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filteredLogs = logs.filter((l) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (l.actor_name && l.actor_name.toLowerCase().includes(q)) ||
      (l.action && l.action.toLowerCase().includes(q)) ||
      (l.target_type && l.target_type.toLowerCase().includes(q)) ||
      (l.target_id && l.target_id.toLowerCase().includes(q)) ||
      (l.details && JSON.stringify(l.details).toLowerCase().includes(q))
    );
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'staff_login':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-mono bg-blue-500/10 text-blue-300 border border-blue-500/30">LOGIN</span>;
      case 'price_change':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/30">PRICE MODIFIED</span>;
      case 'role_change':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-mono bg-purple-500/10 text-purple-300 border border-purple-500/30">ROLE UPDATED</span>;
      case 'refund':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-mono bg-red-500/10 text-red-300 border border-red-500/30">REFUND</span>;
      case 'setting_change':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">SETTINGS</span>;
      case 'staff_logout_everywhere':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-mono bg-rose-500/10 text-rose-300 border border-rose-500/30">REVOKE ALL</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-mono bg-stone-500/10 text-stone-300 border border-stone-500/30">{action.toUpperCase()}</span>;
    }
  };

  if (!isOwner && !isManager) {
    return (
      <div className="p-8 text-center text-stone-400">
        <span className="material-symbols-outlined text-4xl text-amber-400 mb-2">lock</span>
        <h2 className="text-lg font-serif text-white font-bold">Access Restricted</h2>
        <p className="text-xs text-stone-400 mt-1">Audit logs are restricted strictly to Executive Owners and Floor Managers.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-[#120F0D] p-4 sm:p-6 rounded-2xl border border-white/[0.06]">
        <div className="flex-1 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-lg">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search actors, targets, details..."
              className="w-full bg-[#080706] border border-white/[0.1] rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder:text-stone-600 focus:border-[#D4AF37] focus:outline-none"
            />
          </div>

          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="bg-[#080706] border border-white/[0.1] rounded-xl px-4 py-2 text-xs text-stone-300 focus:border-[#D4AF37] focus:outline-none"
          >
            <option value="all">All Events</option>
            <option value="staff_login">Staff Logins</option>
            <option value="price_change">Price Changes</option>
            <option value="role_change">Role Changes</option>
            <option value="refund">Refunds</option>
            <option value="setting_change">Setting Changes</option>
            <option value="staff_logout_everywhere">Global Revocations</option>
          </select>
        </div>

        <button
          onClick={fetchLogs}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-medium text-stone-300 hover:text-white transition-colors"
        >
          <span className={`material-symbols-outlined text-sm ${isLoading ? 'animate-spin' : ''}`}>
            refresh
          </span>
          <span>Refresh</span>
        </button>
      </div>

      {/* Log Table */}
      <div className="bg-[#120F0D] rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-black/30 border-b border-white/[0.06] text-stone-400 font-mono uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3.5 px-4 sm:px-6">Timestamp</th>
                <th className="py-3.5 px-4">Event</th>
                <th className="py-3.5 px-4">Actor</th>
                <th className="py-3.5 px-4">Target</th>
                <th className="py-3.5 px-4">Details Summary</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] text-stone-300">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-stone-500">
                    <span className="material-symbols-outlined text-2xl animate-spin mb-2">progress_activity</span>
                    <p>Loading security audit entries...</p>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-stone-500">
                    <span className="material-symbols-outlined text-2xl mb-2">shield_lock</span>
                    <p>No audit events match your search filters.</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 sm:px-6 font-mono text-[11px] text-stone-400 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getActionBadge(log.action)}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-semibold text-white">{log.actor_name || 'System / Auto'}</div>
                      <div className="text-[10px] text-stone-500 font-mono uppercase">{log.actor_role || 'anon'}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-stone-300 whitespace-nowrap">
                      <span className="text-stone-500">{log.target_type}:</span> {log.target_id || 'system'}
                    </td>
                    <td className="py-3.5 px-4 max-w-xs truncate text-[11px] text-stone-400 font-mono">
                      {JSON.stringify(log.details)}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-stone-300 hover:text-white text-[11px] transition-colors"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#120F0D] border border-white/[0.1] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#D4AF37]">shield</span>
                <h3 className="font-serif text-base font-bold text-white">Audit Event Inspection</h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-stone-400 hover:text-white"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-black/40 border border-white/[0.04]">
                <div>
                  <span className="text-stone-500 block text-[10px] uppercase font-mono">Event Type</span>
                  <span className="font-bold text-white">{selectedLog.action}</span>
                </div>
                <div>
                  <span className="text-stone-500 block text-[10px] uppercase font-mono">Actor</span>
                  <span className="text-white">{selectedLog.actor_name} ({selectedLog.actor_role})</span>
                </div>
                <div>
                  <span className="text-stone-500 block text-[10px] uppercase font-mono">Target</span>
                  <span className="text-white font-mono">{selectedLog.target_type}: {selectedLog.target_id}</span>
                </div>
                <div>
                  <span className="text-stone-500 block text-[10px] uppercase font-mono">Timestamp</span>
                  <span className="text-white font-mono">{new Date(selectedLog.created_at).toISOString()}</span>
                </div>
              </div>

              <div>
                <span className="text-stone-400 block text-[10px] uppercase font-mono mb-1">Payload Details (JSON)</span>
                <pre className="p-3 rounded-xl bg-black/60 border border-white/[0.06] font-mono text-[11px] text-emerald-400 overflow-x-auto max-h-48">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-xl bg-[#D4AF37] text-[#120B08] font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogManagement;
