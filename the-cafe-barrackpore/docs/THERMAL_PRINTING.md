# Thermal Printing & POS Hardware Guide (80mm & 58mm)

This guide documents the thermal printing engine in Caffe OS, covering 80mm and 58mm POS receipt printers, Kitchen Order Tickets (KOT), customer tax bills, cash drawer kicking, and local network bridge setup.

---

## 1. Architecture Overview

The printing engine is implemented with **zero external paid dependencies or closed-source drivers**. It uses 100% native JavaScript/TypeScript to generate both:
1. **Raw ESC/POS Binary Buffers (`Uint8Array`)**: For high-speed direct hardware printing over WebUSB, Web Serial, and LAN Network Bridge.
2. **Pixel-Accurate Thermal CSS (`@page` HTML)**: Rendered inside an isolated hidden iframe for browser print dialogs, CUPS, Windows Spooler, and iOS AirPrint.

### Supported Paper Formats
| Paper Width | Printable Cols (Font A) | Recommended Content Width | Typical Usage |
| :--- | :--- | :--- | :--- |
| **80mm (Standard POS)** | **48 columns** | 72mm | High-volume dine-in bills, kitchen orders, bar chits |
| **58mm (Compact POS)** | **32 columns** | 48mm | Mobile handheld POS, compact counter takeaway printers |

---

## 2. Print Targets & Transports

Caffe OS supports four distinct print targets configurable per station (**Receipt**, **Kitchen**, **Bar**):

### 1) Browser Print (Universal Fallback)
- **Compatibility**: 100% of browsers, desktop operating systems (Windows, macOS, Linux), Android, and Apple iOS Safari.
- **How it works**: Compiles HTML formatted with `@page { size: 80mm auto; margin: 0; }` into a temporary hidden `<iframe>` and triggers `window.print()`.
- **Best for**: Standard USB printers installed as OS system printers, cloud printing, and Apple iPad / iPhone AirPrint.

### 2) WebUSB Direct Hardware Printing
- **Compatibility**: Google Chrome, Microsoft Edge, Opera (Desktop & Android).
- **How it works**: Uses the W3C WebUSB API (`navigator.usb.requestDevice()`). The browser claims the printer's vendor USB bulk-out endpoint and streams raw ESC/POS byte sequences without opening an OS print dialog.
- **Advantages**: Instant zero-click printing, silent cut, direct cash drawer kick pulse.

### 3) Web Serial Direct Hardware Printing
- **Compatibility**: Google Chrome, Microsoft Edge, Chromium browsers on desktop and Android.
- **How it works**: Uses `navigator.serial.requestPort()`. Communicates with thermal printers connected via RS-232 COM ports or USB Virtual COM Port (VCP) drivers (e.g. CH340, Prolific, FTDI) at configurable baud rates (default: `9600` or `115200` bps).

### 4) Local LAN Network Print Bridge (Raw TCP Port 9100)
- **Compatibility**: Any thermal printer equipped with an Ethernet RJ45 port or WiFi interface.
- **Why a bridge is needed**: Modern web browsers strictly prohibit web applications from opening raw TCP sockets directly to local IP addresses on port 9100.
- **Solution**: A lightweight Node.js script (`scripts/print-bridge.mjs`) runs on the local counter PC, POS terminal, or a Raspberry Pi. It exposes an HTTP endpoint (`http://localhost:9123/print`) and relays ESC/POS data to the printer over TCP port 9100.

---

## 3. Running the LAN Network Print Bridge

To connect standard Ethernet or WiFi thermal printers:

1. **Find Printer IP Address**:
   Turn off the thermal printer. Hold the **FEED** button while powering it on. The printer will print a self-test slip showing its IP address (e.g. `192.168.1.200`) and port (`9100`).

2. **Start the Bridge on the local POS counter machine**:
   ```bash
   node scripts/print-bridge.mjs
   ```
   You can also specify custom ports via environment variables:
   ```bash
   BRIDGE_PORT=9123 PRINTER_IP=192.168.1.200 PRINTER_PORT=9100 node scripts/print-bridge.mjs
   ```

3. **Verify Bridge Health**:
   Open in your browser: `http://localhost:9123/health`  
   Expected JSON response:
   ```json
   {
     "status": "online",
     "service": "Caffe OS Thermal Print Bridge",
     "defaultPrinter": "192.168.1.200:9100",
     "timestamp": "2026-10-22T..."
   }
   ```

4. **Configure in Caffe OS**:
   - Go to **Dashboard > Settings > Thermal Printers**.
   - Select **Target**: `LAN Network Bridge`.
   - Enter Bridge URL: `http://localhost:9123`.
   - Enter Printer IP: `192.168.1.200` and Port: `9100`.
   - Click **Ping Bridge** and **Print Test Slip**.

---

## 4. Kitchen Order Tickets (KOT) & Station Routing

KOTs communicate orders quickly and clearly to kitchen and bar staff:

### Category-Based Routing
- When **Category Routing** is enabled in Settings, the engine inspects each item's category:
  - **Bar / Drinks Station**: Items in categories such as `Beverages`, `Coffee`, `Tea`, `Mocktails`, `Cocktails`, `Shakes`, `Bar`, `Sips`.
  - **Kitchen Station**: All other food and kitchen items.
- If separate printers are configured, two distinct tickets are dispatched automatically. If a station printer is disabled, items route cleanly to the main receipt printer.

### KOT Content & Features
- **Header**: Order Type banner (`DINE-IN` / `TAKEAWAY` / `DELIVERY`) and Table Number in double-height bold font.
- **Duplicate / Reprint Tag**: If an order ticket is reprinted, a prominent inverted badge (`*** DUPLICATE / REPRINT ***`) appears to prevent double food preparation.
- **New / Added Items**: Items added to an existing table order display a `[NEW / ADDED]` marker.
- **Kitchen Notes**: Table-level special instructions and item-level customizations (e.g., "extra spicy", "no onion") appear inside bordered note boxes.
- **Auto-Cut**: Dispatches ESC/POS partial cut (`GS V 66 0`) after 3 feed lines.

---

## 5. Customer Bill & Tax Invoice Printing

Customer receipts include all statutory and accounting details:
- **Header**: Business name, registered address, phone number, and tax identification number (GSTIN / VAT ID).
- **Invoice Metadata**: Bill Reference `#`, Order Type, Date, Time, and Guest Name.
- **Itemized Columns**: Quantity (`2x`), Item Name, Line Total. Long item names wrap neatly without breaking column alignment.
- **Financial Breakdown**:
  - Subtotal
  - Taxes: Itemized CGST, SGST, or configured composite tax rates
  - Discounts & Coupon Codes
  - Service Charge / Tips
  - **FINAL TOTAL** in emphasized double-height text
- **Payment Status**: `PAID (Method: UPI/Cash/Card)` or `PAYMENT DUE AT COUNTER`.
- **Dynamic QR Code**:
  - Unpaid bills: Native Epson QR code (`GS ( k`) encoding UPI Intent URL (`upi://pay?pa=...&am=...&tn=...`) for instant scan-to-pay at table.
  - Settled bills: QR code encoding digital receipt URL or review link.

---

## 6. Cash Drawer Kick Pulse

Cash drawers connected to thermal receipt printers via standard **RJ-11 / RJ-12** kick ports can be opened electronically:

### ESC/POS Command
- Standard command: `ESC p m t1 t2` (`0x1B, 0x70, pin, 0x19, 0xFA`).
  - `pin = 0`: Pin 2 of the RJ12 drawer kick socket (standard default).
  - `pin = 1`: Pin 5 of the RJ12 drawer kick socket.
  - Pulse duration: `25 * 2ms = 50ms` ON time, `250 * 2ms = 500ms` OFF time.

### Automated Triggers
1. **Cash Payment Saved**: In the POS **Bill Settlement Modal**, saving a payment with method `cash` automatically fires `kickCashDrawer()`.
2. **Bill Printing with Drawer Kick**: Enabling **"Kick cash drawer when printing customer bill"** in Settings will fire the pulse alongside the bill receipt.
3. **Manual Trigger**: Quick-action **"Open Cash Drawer"** buttons are available on both the **Orders Management** panel and the **Settings** panel for cashier change-making.

---

## 7. Known Hardware & Platform Limitations

### Apple iOS / iPadOS (Safari WebKit)
> [!WARNING]
> **WebUSB and Web Serial are NOT supported on iOS or iPadOS.**  
> Apple's WebKit sandbox does not expose USB or serial communication to browser tabs.

**Solutions for iPad / iPhone POS setups**:
1. **Browser Print (Recommended for iOS)**: Set Target to `Browser Print`. Uses Apple AirPrint or wireless network printers configured on the iPad.
2. **Local LAN Network Bridge**: Run `node scripts/print-bridge.mjs` on any computer on the restaurant's local network (e.g. counter PC). iPads can then send silent zero-click print jobs and cash drawer kicks to network printers via HTTP to the bridge.

### Mixed Content & SSL (HTTPS vs HTTP)
When Caffe OS is hosted on `https://`, modern browsers may restrict insecure `http://localhost:9123` requests. The LAN bridge script includes CORS headers (`Access-Control-Allow-Origin: *`) allowing requests from localhost and local subnets. For production POS terminals, install the bridge locally or run behind a local reverse proxy with SSL if required.

---

## 8. Test Page & Diagnostic Utility

Before starting service, test your thermal printer hardware:
1. Navigate to **Dashboard > Settings > Thermal Printers**.
2. Select your printer station and click **Print Test Slip**.
3. The printer will output a diagnostic slip verifying:
   - 48-column or 32-column alignment ruler
   - Normal, Bold, Double-Width, and Double-Height font scaling
   - 2-column and 3-column table alignment
   - Model 2 QR code rendering
   - Cash drawer kick pulse
   - Clean paper cut
