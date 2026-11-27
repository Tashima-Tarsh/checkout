# DISHA — MDR-Based Subscription Business Model

**Revenue model: 3% MDR on UPI transactions, 50/50 merchant-platform split, plus tiered monthly subscription.**

---

## 1. Revenue Model Overview

| Component | Rate | Who Pays | Who Receives |
|-----------|------|----------|--------------|
| MDR on UPI transactions | 3% of transaction volume | Merchant (via UPI rail) | 50% Merchant / 50% Platform |
| Monthly subscription | Tier-based (see below) | Merchant | Platform (100%) |

**Core principle:** DISHA never holds customer money. MDR flows through the UPI rail (bank → merchant). DISHA charges a verification service fee equivalent to 3% MDR, splits it 50/50 with the merchant, and adds a monthly subscription fee based on annual transaction volume.

---

## 2. Subscription Tiers by Annual Transaction Volume

Merchants select their tier based on expected annual UPI volume. Each tier includes up to 15 UPI IDs per agent mobile and ₹70,000 daily collection cap per device.

| Tier | Annual Volume | MDR (3%/year) | Merchant Share (50%) | Platform Share (50%) | Monthly Subscription |
|------|--------------|---------------|----------------------|----------------------|---------------------|
| **Starter** | ₹10 lakh | ₹30,000 | ₹15,000 | ₹15,000 | ₹3,000/month |
| **Growth** | ₹50 lakh | ₹1,50,000 | ₹75,000 | ₹75,000 | ₹7,500/month |
| **Business** | ₹1 crore | ₹3,00,000 | ₹1,50,000 | ₹1,50,000 | ₹15,000/month |
| **Scale** | ₹50 crore | ₹1,50,00,000 | ₹75,00,000 | ₹75,00,000 | ₹35,000/month |
| **Enterprise** | ₹100 crore | ₹3,00,00,000 | ₹1,50,00,000 | ₹1,50,00,000 | ₹60,000/month |
| **Corporate** | ₹500 crore | ₹15,00,00,000 | ₹7,50,00,000 | ₹7,50,00,000 | ₹1,50,000/month |
| **Platinum** | ₹1000 crore | ₹30,00,00,000 | ₹15,00,00,000 | ₹15,00,00,000 | ₹3,00,000/month |

---

## 3. Monthly Revenue Per Tier

| Tier | MDR/Month (Platform 50%) | Subscription/Month | **Total Platform Revenue/Month** | Merchant Profit/Month (from MDR) |
|------|--------------------------|-------------------|----------------------------------|----------------------------------|
| Starter (₹10L) | ₹1,250 | ₹3,000 | **₹4,250** | ₹1,250 |
| Growth (₹50L) | ₹6,250 | ₹7,500 | **₹13,750** | ₹6,250 |
| Business (₹1Cr) | ₹12,500 | ₹15,000 | **₹27,500** | ₹12,500 |
| Scale (₹50Cr) | ₹6,25,000 | ₹35,000 | **₹6,60,000** | ₹6,25,000 |
| Enterprise (₹100Cr) | ₹12,50,000 | ₹60,000 | **₹13,10,000** | ₹12,50,000 |
| Corporate (₹500Cr) | ₹62,50,000 | ₹1,50,000 | **₹64,00,000** | ₹62,50,000 |
| Platinum (₹1000Cr) | ₹1,25,00,000 | ₹3,00,000 | **₹1,28,00,000** | ₹1,25,00,000 |

---

## 4. Platform Cost Per Tier (Monthly)

| Tier | AWS Infra | Mobile Fleet (eSIM+Gmail+MDM+device) | Platform Ops & Support | **Total Platform Cost** |
|------|-----------|--------------------------------------|------------------------|------------------------|
| Starter | ₹4,000 | ₹1,099 | ₹3,000 | **₹8,099** |
| Growth | ₹12,000 | ₹1,099 | ₹5,000 | **₹18,099** |
| Business | ₹25,000 | ₹1,099 | ₹8,000 | **₹34,099** |
| Scale | ₹1,80,000 | ₹1,099 | ₹20,000 | **₹2,01,099** |
| Enterprise | ₹3,00,000 | ₹1,099 | ₹40,000 | **₹3,41,099** |
| Corporate | ₹12,00,000 | ₹1,099 | ₹80,000 | **₹12,81,099** |
| Platinum | ₹28,00,000 | ₹1,099 | ₹1,50,000 | **₹29,51,099** |

---

## 5. Platform Profit & Margin Per Tier

| Tier | Revenue/Month | Cost/Month | **Profit/Month** | **Profit Margin** |
|------|--------------|------------|------------------|-------------------|
| Starter | ₹4,250 | ₹8,099 | -₹3,849 | Negative* |
| Growth | ₹13,750 | ₹18,099 | -₹4,349 | Negative* |
| Business | ₹27,500 | ₹34,099 | -₹6,599 | Negative* |
| Scale | ₹6,60,000 | ₹2,01,099 | **₹4,58,901** | **69.5%** |
| Enterprise | ₹13,10,000 | ₹3,41,099 | **₹9,68,901** | **74.0%** |
| Corporate | ₹64,00,000 | ₹12,81,099 | **₹51,18,901** | **80.0%** |
| Platinum | ₹1,28,00,000 | ₹29,51,099 | **₹98,48,901** | **76.9%** |

*\* Small tiers (Starter/Growth/Business) operate at a platform loss — they are entry-level/acquisition tiers subsidized by large tiers. To make them profitable, increase subscription fees or require minimum MDR volume.*

---

## 6. Revised Pricing for Small Tiers (To Achieve Profitability)

If DISHA wants all tiers profitable, increase subscription for small volumes:

| Tier | Revised Subscription/Month | Revenue/Month | Cost/Month | Profit/Month | Margin |
|------|---------------------------|---------------|------------|--------------|--------|
| Starter | ₹8,000 | ₹9,250 | ₹8,099 | ₹1,151 | 12.4% |
| Growth | ₹18,000 | ₹24,250 | ₹18,099 | ₹6,151 | 25.4% |
| Business | ₹35,000 | ₹47,500 | ₹34,099 | ₹13,401 | 28.2% |

---

## 7. Revenue Scenarios by Merchant Count

### Scenario A: 10 Merchants (All Platinum - ₹1000 Crore each)

| Metric | Value |
|--------|-------|
| Total Annual Volume | ₹10,000 crore |
| Total MDR (3%) | ₹300 crore |
| Merchant Profit (50% MDR) | ₹150 crore/year |
| Platform Revenue (50% MDR + subs) | ₹153.6 crore/year |
| Platform Cost | ₹3.54 crore/year |
| **Platform Profit** | **₹150.06 crore/year** |
| **Platform Margin** | **97.7%** |

### Scenario B: 100 Merchants (Mixed Tiers)

| Tier | Count | Monthly Revenue/Month | Monthly Cost/Month | Monthly Profit |
|------|-------|----------------------|-------------------|----------------|
| Platinum | 5 | ₹6,40,00,000 | ₹1,47,55,495 | ₹4,92,44,505 |
| Corporate | 20 | ₹12,80,00,000 | ₹2,56,21,980 | ₹10,23,78,020 |
| Enterprise | 30 | ₹3,93,00,000 | ₹1,02,32,970 | ₹2,90,67,030 |
| Scale | 25 | ₹1,65,00,000 | ₹50,27,475 | ₹1,14,72,525 |
| Business | 20 | ₹5,50,000 | ₹6,81,980 | -₹1,31,980 |
| **Total** | **100** | **₹24,87,50,000** | **₹5,63,19,900** | **₹19,24,30,100** |
| **Annualized** | | **₹298.5 crore** | **₹67.6 crore** | **₹230.9 crore** |

---

## 8. Merchant Economics (Why Merchants Join)

### Example: Merchant with ₹100 crore annual volume (Enterprise Tier)

| Item | Amount/Year |
|------|-------------|
| Transaction Volume | ₹100 crore |
| MDR Collected (3%) | ₹3 crore |
| Merchant Share (50% of MDR) | ₹1.5 crore |
| Platform Subscription | ₹7.2 lakh/year |
| **Net Merchant Profit** | **₹1,42,80,000/year** |
| **Effective MDR Cost to Merchant** | **0.72%/year** |

### Example: Merchant with ₹10 lakh annual volume (Starter Tier)

| Item | Amount/Year |
|------|-------------|
| Transaction Volume | ₹10 lakh |
| MDR Collected (3%) | ₹30,000 |
| Merchant Share (50% of MDR) | ₹15,000 |
| Platform Subscription | ₹36,000/year |
| **Net Merchant Position** | **-₹21,000/year** |

*Note: For very small volumes, the subscription fee exceeds MDR profit share. Merchants at this scale should use Starter tier only if they value verification features more than MDR profit, or DISHA should waive subscription for the first 3 months.*

---

## 9. Platform Owner Profit Target

**Target: 66%+ platform profit margin on large tiers (₹50 crore+ volume)**

| Tier | Platform Margin | Meets 66% Target? |
|------|----------------|-------------------|
| Starter | Negative | No (acquisition tier) |
| Growth | Negative | No (acquisition tier) |
| Business | Negative | No (acquisition tier) |
| Scale | 69.5% | ✅ Yes |
| Enterprise | 74.0% | ✅ Yes |
| Corporate | 80.0% | ✅ Yes |
| Platinum | 76.9% | ✅ Yes |

**Break-even point:** Merchants with annual volume above ~₹30 crore make the platform profitable.

---

## 10. Implementation: How Merchants Select Tier

1. Merchant onboards via Super Admin console
2. Merchant estimates annual UPI volume
3. System recommends tier based on volume
4. Merchant selects tier → subscription activated
5. System provisions: Android mobile, eSIM, observer APK, API keys, merchant dashboard
6. Monthly billing: Subscription fee + MDR share reconciliation (based on actual transaction volume)

### Tier Upgrade/Downgrade
- Merchant can change tier once per quarter
- System prorates subscription fee
- MDR split remains 50/50 regardless of tier

---

## 11. Billing & Collections

| Component | Collection Method | Frequency |
|-----------|-------------------|-----------|
| Platform 50% MDR share | API-based reconciliation with settlement bank | Monthly |
| Subscription fee | Razorpay/Stripe auto-debit | Monthly |
| Overage (if volume exceeds tier) | Pro-rated MDR share adjustment | Quarterly |

---

## 12. Summary

| Metric | Value |
|--------|-------|
| MDR Rate | 3% on UPI transactions |
| MDR Split | 50% Merchant / 50% Platform |
| Subscription Range | ₹3,000 – ₹3,00,000/month |
| Volume Range | ₹10 lakh – ₹1000 crore/year |
| Daily Collection Cap | ₹70,000 per agent mobile |
| UPIs per Mobile | Up to 15 |
| Platform Profit Margin (Large Tiers) | 69% – 80% |
| Platform Profit Margin (All Tiers, Mixed) | ~77% |
| Merchant Net Profit (₹100 Cr volume) | ₹1.43 crore/year |

**Key Insight:** The platform makes most of its profit from merchants with ₹50+ crore annual volume. Small tiers (₹10L–₹1Cr) should be treated as acquisition/ecosystem tiers — either subsidized by large merchants or priced with higher subscription fees to cover fixed device costs.
