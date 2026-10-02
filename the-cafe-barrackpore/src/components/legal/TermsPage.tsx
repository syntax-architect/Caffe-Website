import React, { useEffect } from 'react';

export const TermsPage: React.FC = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'Terms of Service | The Café Barrackpore';
  }, []);

  return (
    <div className="min-h-screen bg-[#0E0906] text-on-surface font-sans selection:bg-[#D4AF37]/30 selection:text-[#D4AF37]">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 bg-[#140D09]/90 backdrop-blur-md border-b border-white/10 px-4 sm:px-8 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <a href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-full border border-[#D4AF37]/40 bg-[#1C120D] flex items-center justify-center overflow-hidden shadow-sm group-hover:border-[#D4AF37] transition-colors">
              <img src="/logo.webp" alt="The Café Crest" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col">
              <span className="font-serif text-base text-white font-semibold tracking-tight">The Café</span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#D4AF37]">Barrackpore</span>
            </div>
          </a>

          <a
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-xs font-semibold text-zinc-300 hover:text-white border border-white/10 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Back to Dining</span>
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-12 sm:py-16">
        <div className="mb-12 border-b border-white/10 pb-8">
          <span className="font-mono text-xs uppercase tracking-widest text-[#D4AF37] mb-2 block">
            Guest Agreement &amp; Dining Guidelines
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl text-white font-normal tracking-tight mb-4">
            Terms of Service
          </h1>
          <p className="text-zinc-400 text-sm font-light">
            Effective Date: October 2, 2026 · Governing Jurisdiction: Barrackpore / West Bengal, India
          </p>
        </div>

        <div className="space-y-10 text-zinc-300 text-sm leading-relaxed font-light">
          <section className="space-y-3">
            <h2 className="font-serif text-xl sm:text-2xl text-white font-medium">1. Agreement to Terms</h2>
            <p>
              By accessing our website, placing an order via our digital Smart QR system, or booking a table reservation at The Café Barrackpore, you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, please consult our staff directly for in-person hospitality.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl sm:text-2xl text-white font-medium">2. Reservations &amp; Seating Policy</h2>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li><strong className="text-white">Grace Period:</strong> Reserved tables are held for up to 15 minutes past the scheduled booking time. Beyond this window, tables may be released to waiting walk-in guests.</li>
              <li><strong className="text-white">Party Capacity:</strong> Bookings must accurately reflect the number of guests. Additional seating is subject to floor availability.</li>
              <li><strong className="text-white">Cancellations:</strong> We appreciate at least 2 hours notice for cancellations to allow other dining guests the opportunity to book.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl sm:text-2xl text-white font-medium">3. Smart QR Table Ordering &amp; Kitchen Dispatch</h2>
            <p>
              When ordering via tabletop QR codes:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li>Ensure the table number displayed on your screen corresponds with your physical table marker.</li>
              <li>Once submitted, orders enter our Kitchen Display System (KDS) immediately for fresh preparation. Modifications or cancellations can only be made by requesting immediate staff assistance.</li>
              <li>Items marked as "86'd" or "Sold Out" cannot be added to cart or fulfilled by the kitchen.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl sm:text-2xl text-white font-medium">4. Allergen Notice &amp; Dietary Advisory</h2>
            <p>
              We take great pride in culinary craft and hygiene; however, our kitchen handles ingredients containing common allergens (including dairy, gluten, nuts, soy, seafood, and eggs). While we indicate dietary classifications (Veg, Non-Veg, Vegan) and allergen warnings on our menu:
            </p>
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-xs">
              <strong className="block mb-1 text-amber-300 font-semibold uppercase tracking-wider">Crucial Allergen Disclaimer:</strong>
              Cross-contact between ingredients may occur during peak kitchen hours. Guests with severe or life-threatening food allergies MUST inform the floor manager prior to placing an order. The Café Barrackpore cannot guarantee an environment 100% free of trace allergens.
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl sm:text-2xl text-white font-medium">5. Pricing, Taxes &amp; Payment Settlement</h2>
            <p>
              All prices displayed on the digital menu are listed in Indian Rupees (INR) or designated local currency and are subject to applicable Goods and Services Tax (GST) as mandated by law.
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li><strong className="text-white">Authoritative Pricing:</strong> All final bill amounts are computed authoritatively on our secure servers. Tampering with client-side totals is detected and rejected automatically.</li>
              <li><strong className="text-white">Pay at Counter:</strong> If you select counter payment, payment must be settled at the billing desk prior to departure.</li>
              <li><strong className="text-white">Online Transactions:</strong> Online transactions are verified by encrypted webhooks from our payment partners before orders are confirmed.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl sm:text-2xl text-white font-medium">6. Guest Conduct &amp; Safety</h2>
            <p>
              The Café Barrackpore strives to provide a warm, peaceful, and refined ambiance. We reserve the right to decline service or request any guest to leave if they exhibit abusive behavior towards staff or fellow guests, or fail to adhere to basic safety and hygiene protocols.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl sm:text-2xl text-white font-medium">7. Governing Law</h2>
            <p>
              These terms are governed by and construed in accordance with the laws of India. Any disputes arising in connection with these terms shall be subject to the exclusive jurisdiction of the competent courts in Barrackpore / North 24 Parganas, West Bengal.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-4 text-center text-xs text-zinc-500">
        <p>© {new Date().getFullYear()} The Café Barrackpore. All culinary and brand rights reserved.</p>
      </footer>
    </div>
  );
};

export default TermsPage;
