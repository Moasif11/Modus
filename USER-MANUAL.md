# MODUS ERP — User Manual

**Your complete guide to invoicing, expenses, and GST compliance.**
Written in plain English — no accounting background needed. The app does the hard tax maths; you just follow the steps.

---

## Contents

1. [Introduction](#1-introduction)
2. [Logging in & your account](#2-logging-in--your-account)
3. [Who can do what (roles)](#3-who-can-do-what-roles)
4. [The Dashboard](#4-the-dashboard)
5. [Setting up your company (do this first)](#5-setting-up-your-company-do-this-first)
6. [Customers, Vendors, Employees & Services](#6-customers-vendors-employees--services)
7. [Quotes / Estimates](#7-quotes--estimates)
8. [Creating & sending invoices](#8-creating--sending-invoices)
9. [Getting paid, TDS & credit notes](#9-getting-paid-tds--credit-notes)
10. [Recording expenses (bills)](#10-recording-expenses-bills)
11. [Approvals (expense workflow)](#11-approvals-expense-workflow)
12. [Projects & profitability](#12-projects--profitability)
13. [Reports](#13-reports)
14. [GSTR-2B matching](#14-gstr-2b-matching)
15. [Audit log & locking a period](#15-audit-log--locking-a-period)
16. [Notifications](#16-notifications)
17. [Settings reference](#17-settings-reference)
18. [Month-end / compliance checklist](#18-month-end--compliance-checklist)
19. [Glossary — tax terms in plain English](#19-glossary--tax-terms-in-plain-english)
20. [Troubleshooting & FAQ](#20-troubleshooting--faq)

---

## 1. Introduction

MODUS is an all-in-one ERP & invoicing suite for a business to:
- Raise **GST-correct invoices** and email them to clients.
- Track **money owed to you** (receivables) and **money you owe** (payables).
- Handle **refunds, credit notes, and TDS** the right way.
- Produce **ready-to-file GST reports** and reconcile your input tax credit.
- Keep a **tamper-proof audit trail** for compliance.

It is designed for a firm below ₹5 crore turnover — everything you need at that scale is built in. You **do not** need e-invoicing or e-way bills (those apply only above ₹5 crore).

**Tip:** Press **⌘K** (Mac) / **Ctrl+K** (Windows) anywhere to jump to any screen or action instantly.

---

## 2. Logging in & your account

1. Open the app URL in your browser.
2. Enter your **username or email** and **password**, click **Sign in**.
3. **First time?** You'll be asked to set a new password — do it, and you're in.
4. **Forgot password?** Click the link on the login page; you'll get a reset email.

### Your profile
Click your name/avatar (top-right) → **Profile**:
- Update your name, phone, designation, photo.
- **Change Password** any time from the same page.

---

## 3. Who can do what (roles)

| Role | What they can do |
|------|------------------|
| **Superadmin** | Everything — company settings, GST config, approve expenses, manage all users, lock periods |
| **Admin** | Day-to-day work + manage regular users |
| **User** | Create invoices, log expenses, do normal work. Their expenses go for approval. |

**Team management:** Superadmins manage people under **Settings → Team** (create users, reset passwords, deactivate).

---

## 4. The Dashboard

Your home screen — a snapshot of the business:
- **Top cards:** Revenue this year, money clients owe you (AR outstanding), GST collected, bills due.
- **Charts:** billed vs collected over the last 9 months, and a breakdown of invoice statuses.
- **Recent invoices** and your **top clients** by outstanding amount.

Use it as your daily check: who owes you, what's overdue, how's cash flow.

---

## 5. Setting up your company (do this first)

Go to **Settings → Company** and fill in once:
- **Company name, registered legal name, address, GSTIN, PAN.**
- **Bank details** — shown on invoices so clients know where to pay.
- **Branding & White-Label Customization:**
  - **App & Display Name**: Customizes browser title bars, email footers, and dashboard greetings.
  - **Brand Accent Colors**: Choose a preset palette or assign custom primary and dark-mode brand colors. Dynamically sets `--modus-accent` throughout the web interface.
  - **Brand Logos**: Upload primary horizontal logo, white variant for dark mode, and a custom web favicon.
  - **Digital Signature**: Upload an authorized signatory stamp/signature for PDF documents.
- **Invoice numbering** — choose a format (e.g. `MODUS/2026-27/001`, which resets every financial year).
- **GST compliance:**
  - **LUT number** — only if you export services (bill foreign clients).
  - **Turnover above ₹5 crore** toggle — leave off unless you cross ₹5 cr.

Then add your **Services** (see next section) so they auto-fill on invoices.

---

## 6. Customers, Vendors, Employees & Services

**Customers** = who you invoice. **Vendors** = who you pay. **Employees** = staff (for salary/reimbursements). **Services** = your catalogue of things you sell.

### Adding a contact
Open the menu (e.g. **Customers**) → **Add** → fill the form (slides up from the bottom) → **Save**. You can also add one on the fly while making an invoice/bill.

> **Important — GST Treatment:** when adding a customer or vendor, set their **GST Treatment**:
> - **Registered** — has a GSTIN (normal Indian business).
> - **Unregistered** — no GSTIN (small/individual).
> - **Overseas / Export** — a foreign client or vendor.
> - **SEZ** — special economic zone.
>
> This one setting makes the app apply the correct tax automatically (CGST+SGST, IGST, or zero-rated export).

### Services
Add each service you sell with its **SAC code** and **GST rate** (usually 18%). These auto-fill when you build invoices, saving time and keeping tax correct.

---

## 7. Quotes / Estimates

Before an invoice, you can send a **Quote** (estimate/proposal):
1. **Quotes → New quote** → add the client and line items.
2. Send it to the client.
3. Once they agree, **convert it to an invoice** (no re-typing).

Quotes don't affect your tax — they're just proposals until converted.

---

## 8. Creating & sending invoices

### Create
1. **Receivables → New invoice** (or the **New Invoice** button in the sidebar).
2. **Pick the customer** — their GST details load automatically.
3. **Invoice number & dates** are pre-filled; set the **due date / payment terms**.
4. **Add line items:** pick a service (or type one), set **quantity, rate, GST %**. The app calculates **CGST + SGST** (same state) or **IGST** (different state) automatically.
5. Check the **summary panel** — taxable value, GST, grand total.
6. **Notes & terms** pre-fill from your defaults; edit if needed.
7. **Save draft** (keeps it editable) or **Send invoice**.

### Invoice templates
Every invoice can use one of three looks — **Modern**, **Minimal**, **Classic** — switch with the toggle on the invoice page. "Modern" is the sleek signature tax-invoice design.

### Sending
Click **Send** — the app emails a formatted invoice + PDF to the client and marks it **Sent**.

### Attachments
On any invoice you can attach supporting files (SOW, PO, etc.) under **Attachments**.

### Automatic tax handling
- **Foreign/export client** → invoice is **zero-rated** (no GST) with the export declaration; you'll be stopped if you accidentally add tax.
- **Different-state client** → switches to **IGST** automatically.
- **Missing HSN/SAC on a business invoice** → the app reminds you (it's mandatory).

### Editing / cancelling
- A **draft** can be freely edited.
- A **sent** invoice generally shouldn't be edited (GST rule). To reduce or cancel it, **issue a credit note** (next section).
- Invoices in a **locked (filed) period** can't be changed at all.

---

## 9. Getting paid, TDS & credit notes

Open an invoice → the right panel shows **Balance due** and three buttons:

### Record Payment
The client paid you → enter amount, date, method (bank/UPI/cheque), reference. The balance updates. Partial payments are fine (status shows **Partially paid**).

### Record TDS deducted
A company client often pays you **minus TDS** — they keep a slice, pay you the rest, and deposit that slice to the govt against your PAN. It's not lost money; you claim it back at income-tax time.

**Worked example — you invoiced SLK ₹75,000 + 18% GST ₹13,500 = ₹88,500 total.**

*First, wait for the payment and look at what actually hits your bank.*

- **Case A — SLK pays the full ₹88,500** (no TDS; small clients, individuals):
  → Just **Record Payment → ₹88,500**. Invoice = Paid. You never touch the TDS button.

- **Case B — SLK is a company and deducts TDS:** TDS is 10% of the **base ₹75,000** (never on the GST, never on the total) = **₹7,500**. They keep it and pay you **₹88,500 − ₹7,500 = ₹81,000**. So you do two steps:
  1. **Record Payment → ₹81,000** (the money that arrived).
  2. **Record TDS deducted → 194J, 10%** → app fills ₹7,500.
  → 81,000 + 7,500 = 88,500 → invoice fully **Paid**, balance ₹0.

**How to tell which case:** look at your bank. Full amount arrived → Case A. Short by ~10% of the base → Case B (the client usually sends a TDS certificate / Form 16A confirming it).

- Section is usually **194J** (professional/technical fees) for an agency.
- The TDS is treated as **settled** (not pending), so the invoice closes correctly.
- Track all such TDS under **Reports → TDS (26AS)** and match it to your Form 26AS at income-tax time.

> **One-line rule:** money came in full → **Record Payment** only. Money came short → **Record Payment** (what arrived) **+ Record TDS deducted** (the shortfall).

### Issue Credit Note (refunds / reductions)
Need to reduce or cancel an invoice already sent (returned work, post-sale discount, billing error)?
1. **Issue Credit Note** → enter the **amount** (full or partial) + a **reason** + date.
2. The app creates a GST-compliant credit note, reduces the invoice balance, and marks it **Credited** if fully offset.
3. If real money goes back to the client, click **Record Refund** on that credit note.

Credit notes automatically appear in your GST return (GSTR-1) and reduce your tax. All are listed under the **Credit Notes** menu (read-only, by law).
> GST allows a credit note to adjust tax only up to **30 November after the financial year** — the app blocks later ones.

---

## 10. Recording expenses (bills)

**Expenses → Record Bill:**
1. **Title** + **category** (marketing, software, travel, salary…).
2. **Paid to** — pick a saved vendor, or just type a name for a one-off.
3. **Amount** + **Tax/GST** (if the vendor charged GST).
4. **Dates**, notes, and **upload the receipt** (drag & drop — there's an AI scanner that reads it).
5. Save.

### The three tax settings on a bill
- **ITC eligibility** — whether you can claim back the GST on this purchase. Leave on **Auto** (petrol/food/travel are auto-blocked by law). To claim credit, the vendor must be GST-registered and you must enter their **invoice number**.
- **Reverse Charge (RCM)** — for **foreign** purchases (Google/Meta Ads, foreign SaaS), *you* owe the Indian GST. The app **auto-detects** this when the vendor is "Overseas," computes the IGST, and assigns a self-invoice number. Nothing extra to do.
- **TDS section** — when you pay a **freelancer/contractor/rent**, you must deduct TDS. Pick the section (**194J** professional, **194C** contractor, **194H** commission, **194I** rent). The app shows the **net to actually pay** the vendor and tracks the TDS for your **26Q** filing.

### Foreign-currency bills
If you paid in USD/other, enter the amount + the **actual INR debited** (incl. bank markup). The app stores everything in INR and keeps the foreign figure for reference.

---

## 11. Approvals (expense workflow)

To prevent unauthorised spending:
- **Superadmins** — their expenses are recorded immediately.
- **Admins / Users** — their expenses are created as **Pending** and a superadmin must **Approve** (or **Reject** with a reason).
- Superadmins get a **notification** (bell + email) when something needs approval.
- Approve/reject from the **Expenses → Pending** tab or the bill's detail page.

Pending/rejected expenses don't count in your outstanding payables or GST until approved.

---

## 12. Projects & profitability

Tag invoices and bills to a **Project** to see live **profit & loss per client engagement**.
- **Projects → New project** (name, client, budget, dates).
- On any invoice or bill, choose the **Project**.
- Open a project to see 4 tabs: **Overview** (revenue, expenses, net profit, outstanding), **Invoices**, **Expenses**, **Activity**. All figures update automatically.

---

## 13. Reports

**Reports** → pick a report and set the date range at the top.

| Report | What it's for |
|--------|---------------|
| **GST / Invoice Summary** | A plain list of all invoices with tax on each |
| **GSTR-1** | Monthly return of your **sales** (B2B, B2C, exports, credit notes) |
| **GSTR-3B** | Monthly **summary return** — tax to pay after credits |
| **HSN-wise Summary** | Sales grouped by SAC/HSN code |
| **Profit & Loss** | Revenue minus expenses |
| **TDS — 26Q & 26AS** | TDS you deducted (to deposit) + TDS clients deducted from you |

### Filing your GST return
1. Open **GSTR-1** (or **GSTR-3B**) for the month.
2. Click the **download menu → "Govt JSON (GSTR-1/3B)"**.
3. Upload that file to the GST portal's offline tool — no re-typing.

You can also export any report as **PDF / Excel / CSV**.

---

## 14. GSTR-2B matching

You can only claim GST credit (ITC) on a purchase if **your vendor also reported it**. The govt publishes **GSTR-2B** monthly = the list of purchases your vendors declared.

1. Download your **GSTR-2B JSON** from the GST portal (Returns → GSTR-2B → Download).
2. **GSTR-2B Match** → pick the period → **upload** the file → **Reconcile**.
3. Review:
   - ✅ **Matched** — safe to claim.
   - ⚠️ **In books, not in 2B** — your credit is **at risk**; chase the vendor to file.
   - 🔵 **In 2B, not in books** — a purchase you forgot; add it to claim the credit.
   - **Mismatches** — tax amounts differ; investigate.

---

## 15. Audit log & locking a period

### Audit Log
A **tamper-proof history** of every change to invoices, bills, and payments — who changed what, and when. It can't be edited or switched off (a legal requirement for companies). Filter by Invoices/Bills. You rarely need it — it's there for safety and audits.

### Locking a filed period
After you file a month's GST return, a superadmin can set **Settings → "Books locked up to"** to that date. Locked invoices/bills then **can't be edited or deleted** — keeping your books matching what you filed. To change something later, use a credit note.

---

## 16. Notifications

The **bell** (top-right) shows alerts — e.g. expenses awaiting approval. Manage which alerts you get under **Settings → Notifications** (payment received, invoice overdue, bill due soon, GST reminders, weekly summary).

---

## 17. Settings reference

**Settings** (superadmin for company-level changes):
- **Company** — name, GSTIN/PAN, address, registered legal name.
- **Bank & payment** — account details + UPI shown on invoices.
- **Branding** — logo, dark logo, signature.
- **Invoice numbering** — prefix + format (FY / calendar / plain) + live preview.
- **GST compliance** — LUT number, turnover>₹5cr toggle, e-invoice-from date, **Books locked up to**.
- **Notifications** — toggle each alert.
- **Team** — manage users (superadmin/admin).

---

## 18. Month-end / compliance checklist

A simple routine to stay compliant. (Confirm exact dates with your CA.)

**Every month:**
1. **Record all invoices** raised during the month; **Send** any pending.
2. **Record all expenses**; upload receipts; get pending ones **approved**.
3. For each expense, confirm **ITC eligibility**, **RCM** (foreign spend), and **TDS** are set.
4. **Reports → GSTR-1** → download Govt JSON → file on the portal (by ~11th).
5. Download **GSTR-2B** from the portal → **GSTR-2B Match** → fix at-risk / missing items.
6. **Reports → GSTR-3B** → download Govt JSON → file + pay tax (by ~20th).
7. **Deposit TDS** you deducted (by 7th) → check **Reports → TDS (26Q)**.
8. After filing, **lock the period** (Settings → Books locked up to).

**Every quarter:** file TDS return (26Q). **Yearly:** reconcile with your CA; file income tax.

> The app prepares the numbers and files; your CA/accountant does the actual portal filing and sign-off.

---

## 19. Glossary — tax terms in plain English

**GST** — the tax added on sales/services in India (usually 18% for services).

**CGST / SGST / IGST** — the split of GST. Same-state sale = **CGST + SGST** (half each). Different-state sale = **IGST** (single). The app picks automatically.

**Invoice statuses** — *Draft* (editable), *Sent* (emailed), *Partially paid*, *Paid*, *Credited* (fully cancelled by a credit note), *Overdue*.

**TDS (Tax Deducted at Source)** — income tax held back at payment time. When a client pays you minus TDS, or when you pay a freelancer and hold back TDS.

**Reverse Charge (RCM)** — the *buyer* pays the GST to the govt instead of the seller. Mainly for foreign purchases (you owe GST on Google/Meta ads).

**ITC (Input Tax Credit)** — the GST you paid on business purchases, which you subtract from the GST you owe. "Blocked" items (petrol, food) can't be claimed.

**Credit Note** — an official "reduce/cancel this invoice" document. Can't be edited (legal) — you create it from an invoice.

**GSTR-1** — monthly return of your **sales**. **GSTR-3B** — monthly **summary** return (what to pay). **GSTR-2B** — govt's list of your **purchases** (for claiming ITC). **26Q** — TDS you deducted. **26AS** — TDS deducted from you.

**HSN / SAC** — a code for every product/service. Services use SAC codes (e.g. 9983…).

**LUT** — a one-time letter that lets you export services **without charging GST**.

**Zero-rated** — export/SEZ supplies: taxed at 0% (no GST charged, and you can still claim your input credits).

---

## 20. Troubleshooting & FAQ

**The page looks blank / didn't update after a change.**
Hard-refresh your browser: **Cmd+Shift+R** (Mac) / **Ctrl+Shift+R** (Windows).

**I got logged out / a screen won't load.**
Your session may have expired — log in again.

**"Eligible ITC requires a registered vendor / invoice number."**
You marked a bill's GST as claimable but the vendor has no GSTIN or you didn't enter their invoice number. Either add those, or set ITC to Ineligible.

**"Export supplies are zero-rated — tax must be 0."**
The customer is set to Overseas/Export, so the invoice can't have GST. Remove the tax (or change the customer's treatment if that's wrong).

**"Inter-state supply must use IGST, not CGST/SGST."**
The client is in another state — let the app recalculate; don't force CGST/SGST.

**"This invoice is in a locked period."**
Its month is locked (filed). To change it, issue a credit note, or a superadmin can move the lock date in Settings.

**"A sent/paid invoice can't be deleted."**
By GST rules you can't delete an issued invoice — reverse it with a **credit note** instead.

**Do I need e-invoicing / e-way bills?**
No — those are only mandatory above ₹5 crore turnover. Your invoices are fully valid without them.

**Do I need to file GSTR-9 (annual return)?**
Only if turnover crosses ₹2 crore. Below that it's optional.

---

*For anything not covered here, contact your MODUS administrator or your CA for tax-specific advice.*
