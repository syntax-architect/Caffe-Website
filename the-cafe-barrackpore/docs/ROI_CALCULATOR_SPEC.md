# ROI Calculator Specification: Fury Studios Hospitality Platform

**Purpose:** Provide restaurant prospects with a clear, conservative, and mathematically rigorous estimate of the financial impact of adopting the Fury Studios platform.  
**Guiding Principle:** Full disclosure of assumptions. Distinguish gross revenue from net contribution. Never assume 100% of online orders are incremental.

---

## 1. Input Variables & Definitions

The calculator models financial returns based on client-provided operational parameters:

| Variable | Name | Unit | Description & Guidelines | Default / Range |
|---|---|---|---|---|
| `V` | **Monthly Dining Traffic** | Number | Total monthly covers, dine-in guests, or website visits (consistent basis). | Client input (e.g., 2,500) |
| `A` | **Average Order Value (AOV)** | Currency | Historical average spending per table or guest order. | Client input (e.g., \$45 or ₹600) |
| `C` | **Baseline Conversion Rate** | Percentage | Current percentage of visitors who order online or reserve (if known). | Client input (e.g., 3.0%) or blank |
| `ΔC` | **Expected Conversion Lift** | Percentage pts | Realistic uplift in conversion due to digital menu, mobile UX, and QR ordering. | 0.5% – 2.0% (User entered) |
| `I` | **Incremental Share** | Percentage | Portion of new digital orders that represent net-new business vs existing guest shift. | 20% – 40% (User entered) |
| `M` | **Contribution Margin** | Percentage | Gross profit margin on food & beverage (Revenue minus Cost of Goods Sold). | 30% – 45% (User entered) |
| `S` | **Monthly Operational Savings**| Currency | Labor/time savings from QR ordering, reduced paper printing, and fewer phone bookings. | Client estimated |
| `K` | **One-Time Implementation Cost**| Currency | Total upfront cost for setup, customisation, menu onboarding, and training. | Contract quote |
| `F` | **Monthly Platform Support Fee**| Currency | Ongoing recurring software, hosting, and SLA maintenance fee. | Contract quote |
| `H` | **Evaluation Horizon** | Months | Analysis timeframe for cumulative net return and breakeven evaluation. | 12 months |

---

## 2. Mathematical Calculations & Formulas

### Step 1: Digital Conversion & Order Generation
- **New Conversion Rate:**  
  $$C_{\text{new}} = \min(100\%, C + \Delta C)$$
- **Additional Converted Orders:**  
  $$O_{\text{add}} = \max(0, V \times \Delta C)$$
- **Estimated Net Incremental Orders:**  
  $$O_{\text{inc}} = O_{\text{add}} \times I$$
*(Acknowledges that $(1 - I)$ of new orders are from existing diners shifting channels).*

### Step 2: Revenue & Gross Contribution
- **Estimated Incremental Gross Revenue:**  
  $$R_{\text{inc}} = O_{\text{inc}} \times A$$
- **Net Contribution from Food & Beverage Sales:**  
  $$\text{Contribution} = R_{\text{inc}} \times M$$

### Step 3: Net Monthly Operational Benefit
- **Monthly Net Benefit:**  
  $$\text{Net Benefit}_{\text{monthly}} = \text{Contribution} + S - F$$

### Step 4: Payback Period & First-Year Net Gain
- **Simple Payback Period (Months):**  
  $$\text{Payback} = \frac{K}{\text{Net Benefit}_{\text{monthly}}} \quad (\text{if Net Benefit} > 0)$$
- **Cumulative First-Period Net Value:**  
  $$\text{Cumulative Gain} = (\text{Net Benefit}_{\text{monthly}} \times H) - K$$

---

## 3. Worked Validation Scenarios

### Scenario A: Mid-Size Artisanal Bistro (United States / USD)
- **Inputs:**
  - $V = 3,000$ monthly visits
  - $A = \$55.00$ Average Order Value
  - $\Delta C = 1.0\%$ conversion uplift
  - $I = 30\%$ incremental share (70% channel shift)
  - $M = 35\%$ contribution margin
  - $S = \$400$ monthly labor & printing savings
  - $K = \$4,500$ implementation cost
  - $F = \$250$ monthly support fee
- **Results:**
  - Additional Converted Orders: $3,000 \times 1\% = 30$ orders
  - Incremental Orders: $30 \times 30\% = 9$ net-new orders
  - Incremental Monthly Revenue: $9 \times \$55.00 = \$495.00$
  - Monthly Sales Contribution: $\$495.00 \times 35\% = \$173.25$
  - Net Monthly Benefit: $\$173.25 + \$400.00 - \$250.00 = \$323.25$
  - Payback Period: $\$4,500 / \$323.25 \approx 13.9$ months
  - 12-Month Net Gain: $(\$323.25 \times 12) - \$4,500 = -\$621$ (breakeven in month 14).

### Scenario B: High-Volume Casual Dining (India / INR)
- **Inputs:**
  - $V = 6,000$ monthly diners
  - $A = ₹750$ Average Order Value
  - $\Delta C = 1.5\%$ conversion uplift
  - $I = 25\%$ incremental share
  - $M = 40\%$ contribution margin
  - $S = ₹12,000$ monthly operational savings (reduced staff order-taking overhead)
  - $K = ₹120,000$ implementation cost
  - $F = ₹6,000$ monthly support fee
- **Results:**
  - Additional Converted Orders: $6,000 \times 1.5\% = 90$ orders
  - Incremental Orders: $90 \times 25\% = 22.5$ net-new orders
  - Incremental Monthly Revenue: $22.5 \times ₹750 = ₹16,875$
  - Monthly Sales Contribution: $₹16,875 \times 40\% = ₹6,750$
  - Net Monthly Benefit: $₹6,750 + ₹12,000 - ₹6,000 = ₹12,750$
  - Payback Period: $₹120,000 / ₹12,750 \approx 9.4$ months
  - 12-Month Net Gain: $(₹12,750 \times 12) - ₹120,000 = +₹33,000$.

---

## 4. Required Disclosures & Model Limitations
- **Estimates, Not Guarantees:** Calculations are theoretical projections based on client inputs, not promised contractual guarantees.
- **Variable Operating Realities:** External factors such as kitchen capacity, seasonal diner traffic, local competition, weather, and food ingredient inflation will affect actual net margins.
- **Third-Party Costs Excluded:** Payment processing fees (e.g., Stripe 2.9% + \$0.30), municipal sales taxes, and delivery driver commissions are separate from this model.
