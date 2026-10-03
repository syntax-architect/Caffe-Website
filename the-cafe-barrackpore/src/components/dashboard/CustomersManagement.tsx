import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { fetchCustomers, updateCustomerConsent, exportCustomersCSV, downloadCSV } from '../../services/ownerService';
import type { Customer } from '../../types/owner';
import { useNotification } from '../../hooks/useNotification';
import { formatCurrency } from '../../utils/currency';

export const CustomersManagement: React.FC = () => {
  const { isOwner } = useAuth();
  const { addNotification } = useNotification();
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [consentFilter, setConsentFilter] = useState<'all' | 'opted_in'>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const loadCustomers = async () => {
    setIsLoading(true);
    try {
      const data = await fetchCustomers({
        search: searchQuery,
        consentOnly: consentFilter === 'opted_in',
      });
      setCustomers(data);
    } catch (error) {
      console.error('Error fetching customers:', error);
      addNotification('error', 'Error', 'Failed to load customers');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [searchQuery, consentFilter]);

  const handleExportCSV = () => {
    try {
      const csv = exportCustomersCSV(customers);
      const date = new Date().toISOString().split('T')[0];
      downloadCSV(csv, `customers_${date}.csv`);
      addNotification('success', 'Export Successful', 'Customer list downloaded');
    } catch (error) {
      console.error('Export error:', error);
      addNotification('error', 'Export Failed', 'Could not generate CSV');
    }
  };

  const handleToggleConsent = async (customer: Customer) => {
    const newConsent = !customer.marketing_consent;
    if (!window.confirm(`Are you sure you want to ${newConsent ? 'opt-in' : 'opt-out'} ${customer.name} from marketing?`)) {
      return;
    }

    try {
      const { success, error } = await updateCustomerConsent(customer.id, newConsent);
      if (success) {
        addNotification('success', 'Updated', `Marketing consent updated for ${customer.name}`);
        if (selectedCustomer?.id === customer.id) {
          setSelectedCustomer({ ...selectedCustomer, marketing_consent: newConsent });
        }
        await loadCustomers();
      } else {
        throw new Error(error || 'Failed to update consent');
      }
    } catch (err: any) {
      console.error('Consent update error:', err);
      addNotification('error', 'Update Failed', err.message);
    }
  };

  if (!isOwner) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500 bg-[#120F0D]/95 border border-white/[0.04] p-6 rounded-[calc(2rem-0.25rem)]">
        <span className="material-symbols-outlined text-4xl mr-3">lock</span>
        <h2 className="text-xl font-serif">Owner Access Required</h2>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-serif text-white tracking-wide">
            Customer Directory
            <span className="ml-3 inline-flex items-center justify-center px-3 py-1 rounded-full bg-white/[0.05] border border-white/[0.05] text-sm text-stone-400 font-sans">
              {customers.length}
            </span>
          </h2>
          <p className="text-stone-400 mt-2">Manage customer relationships and marketing preferences</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-300 bg-gradient-to-r from-[#D4AF37] to-[#F3C766] text-[#120B08] hover:shadow-[0_0_20px_rgba(212,175,55,0.3)] hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            disabled={isLoading || customers.length === 0}
          >
            <span className="material-symbols-outlined text-lg">download</span>
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="p-1 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.07] shadow-xl">
        <div className="rounded-[calc(2rem-0.25rem)] bg-[#120F0D]/95 border border-white/[0.04] p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-stone-500">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, phone, or email..."
                className="w-full bg-[#1A1614] border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-stone-500 focus:outline-none focus:border-[#D4AF37]/50 focus:ring-1 focus:ring-[#D4AF37]/50 transition-all"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConsentFilter('all')}
                className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  consentFilter === 'all'
                    ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30'
                    : 'bg-[#1A1614] text-stone-400 border border-white/10 hover:border-white/20 hover:text-white'
                }`}
              >
                All Customers
              </button>
              <button
                onClick={() => setConsentFilter('opted_in')}
                className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  consentFilter === 'opted_in'
                    ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30'
                    : 'bg-[#1A1614] text-stone-400 border border-white/10 hover:border-white/20 hover:text-white'
                }`}
              >
                Marketing Opt-in Only
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Customers List */}
      <div className="p-1 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.07] shadow-xl">
        <div className="rounded-[calc(2rem-0.25rem)] bg-[#120F0D]/95 border border-white/[0.04] overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center space-y-4">
              <span className="material-symbols-outlined text-4xl text-[#D4AF37] animate-spin">refresh</span>
              <p className="text-stone-400">Loading customers...</p>
            </div>
          ) : customers.length === 0 ? (
            <div className="p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl text-stone-500">group_off</span>
              </div>
              <p className="text-stone-300 font-medium text-lg">No customers found</p>
              <p className="text-stone-500 text-sm">Try adjusting your filters or search query.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.04] text-stone-500 text-xs uppercase tracking-wider">
                    <th className="p-4 font-medium">Name</th>
                    <th className="p-4 font-medium">Contact</th>
                    <th className="p-4 font-medium text-center">Orders</th>
                    <th className="p-4 font-medium text-right">Total Spent</th>
                    <th className="p-4 font-medium text-right">Last Order</th>
                    <th className="p-4 font-medium text-center">Marketing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {customers.map((customer) => (
                    <tr
                      key={customer.id}
                      onClick={() => setSelectedCustomer(customer)}
                      className="group hover:bg-white/[0.02] transition-colors cursor-pointer"
                    >
                      <td className="p-4">
                        <div className="font-medium text-white">{customer.name}</div>
                        {customer.email && <div className="text-xs text-stone-500 mt-0.5">{customer.email}</div>}
                      </td>
                      <td className="p-4">
                        <div className="text-stone-300 font-mono">{customer.phone}</div>
                      </td>
                      <td className="p-4 text-center">
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-white/5 text-stone-300 font-mono text-sm border border-white/10">
                          {customer.order_count}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-[#D4AF37] font-medium tracking-wide">
                          {formatCurrency(customer.total_spent)}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-stone-400 text-sm">
                          {customer.last_order_at ? new Date(customer.last_order_at).toLocaleDateString() : 'Never'}
                        </span>
                      </td>
                      <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleToggleConsent(customer)}
                          className={`inline-flex items-center justify-center p-1.5 rounded-lg transition-colors ${
                            customer.marketing_consent
                              ? 'text-emerald-400 hover:bg-emerald-400/10'
                              : 'text-stone-600 hover:bg-white/5'
                          }`}
                          title={customer.marketing_consent ? "Opted In" : "Opted Out"}
                        >
                          <span className="material-symbols-outlined text-xl">
                            {customer.marketing_consent ? 'mark_email_read' : 'unsubscribe'}
                          </span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Customer Detail Slide-out */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedCustomer(null)}
          />
          <div className="relative w-full max-w-md bg-[#160E0A] h-full shadow-2xl border-l border-white/10 flex flex-col animate-slideInRight">
            <div className="flex items-center justify-between p-6 border-b border-white/10 bg-[#120B08]">
              <h3 className="text-xl font-serif text-[#D4AF37]">Customer Details</h3>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="p-2 text-stone-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Profile Info */}
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#D4AF37]/20 to-[#F3C766]/10 border border-[#D4AF37]/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl font-serif text-[#D4AF37]">
                    {selectedCustomer.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h4 className="text-2xl font-medium text-white">{selectedCustomer.name}</h4>
                  <div className="flex flex-col gap-1 mt-2">
                    <div className="flex items-center gap-2 text-stone-400">
                      <span className="material-symbols-outlined text-sm">phone</span>
                      <span className="font-mono">{selectedCustomer.phone}</span>
                    </div>
                    {selectedCustomer.email && (
                      <div className="flex items-center gap-2 text-stone-400">
                        <span className="material-symbols-outlined text-sm">mail</span>
                        <span>{selectedCustomer.email}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#1A1614] p-4 rounded-xl border border-white/5">
                  <div className="text-stone-500 text-sm mb-1">Total Orders</div>
                  <div className="text-2xl font-medium text-white">{selectedCustomer.order_count}</div>
                </div>
                <div className="bg-[#1A1614] p-4 rounded-xl border border-white/5">
                  <div className="text-stone-500 text-sm mb-1">Total Spent</div>
                  <div className="text-2xl font-medium text-[#D4AF37]">{formatCurrency(selectedCustomer.total_spent)}</div>
                </div>
              </div>

              {/* Order History Summary */}
              <div className="space-y-3">
                <h5 className="text-sm font-medium text-stone-500 uppercase tracking-wider">History</h5>
                <div className="bg-[#1A1614] rounded-xl border border-white/5 divide-y divide-white/5">
                  <div className="p-4 flex justify-between items-center">
                    <span className="text-stone-400">First Order</span>
                    <span className="text-white">
                      {selectedCustomer.first_order_at ? new Date(selectedCustomer.first_order_at).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  <div className="p-4 flex justify-between items-center">
                    <span className="text-stone-400">Last Order</span>
                    <span className="text-white">
                      {selectedCustomer.last_order_at ? new Date(selectedCustomer.last_order_at).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Marketing Preferences */}
              <div className="space-y-3">
                <h5 className="text-sm font-medium text-stone-500 uppercase tracking-wider">Preferences</h5>
                <div className="bg-[#1A1614] rounded-xl border border-white/5 p-4 flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">Marketing Emails & SMS</div>
                    <div className="text-sm text-stone-500 mt-0.5">Receive promotional content</div>
                  </div>
                  <button
                    onClick={() => handleToggleConsent(selectedCustomer)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      selectedCustomer.marketing_consent ? 'bg-[#D4AF37]' : 'bg-stone-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        selectedCustomer.marketing_consent ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-3">
                <h5 className="text-sm font-medium text-stone-500 uppercase tracking-wider">Internal Notes</h5>
                <div className="bg-[#1A1614] rounded-xl border border-white/5 p-4">
                  {selectedCustomer.notes ? (
                    <p className="text-stone-300 text-sm whitespace-pre-wrap">{selectedCustomer.notes}</p>
                  ) : (
                    <p className="text-stone-600 text-sm italic">No internal notes for this customer.</p>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomersManagement;
