import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { clientDetails } from '../config/client';

export const QRCodeGenerator: React.FC = () => {
  // Get the current origin (e.g. https://the-cafe-bkp.vercel.app)
  const siteUrl = window.location.origin;
  const menuUrl = `${siteUrl}/#menu-section`;

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-black">
      <div className="max-w-md w-full bg-white border border-gray-200 rounded-3xl p-10 shadow-2xl flex flex-col items-center text-center">
        
        {/* Branding */}
        <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center mb-6 p-3">
          <img src="/logo.webp" alt="Logo" className="w-full h-full object-contain filter invert" />
        </div>
        
        <h1 className="text-3xl font-bold font-serif mb-2">{clientDetails.businessName}</h1>
        <p className="text-gray-500 uppercase tracking-widest text-sm mb-8">Digital Menu</p>

        {/* QR Code */}
        <div className="bg-white p-4 rounded-xl shadow-inner border border-gray-100 mb-8">
          <QRCodeSVG 
            value={menuUrl}
            size={250}
            level="H"
            includeMargin={false}
            fgColor="#000000"
            bgColor="#ffffff"
            imageSettings={{
              src: "/logo.webp",
              x: undefined,
              y: undefined,
              height: 50,
              width: 50,
              excavate: true,
            }}
          />
        </div>

        <p className="text-gray-600 font-medium mb-2">Scan to view our menu and order</p>
        <p className="text-gray-400 text-xs">Powered by Agency Template</p>
      </div>

      <button 
        onClick={() => window.print()}
        className="mt-8 px-8 py-3 bg-black text-white rounded-full font-semibold hover:bg-gray-800 transition-colors print:hidden flex items-center gap-2"
      >
        <span className="material-symbols-outlined">print</span>
        Print QR Code
      </button>
    </div>
  );
};
