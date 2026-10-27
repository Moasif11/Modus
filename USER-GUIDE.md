# MODUS ERP — User Guide (Indian Statutory Compliance Edition)

> **Statutory Framework:** MODUS ERP is purpose-built from the ground up for Indian service businesses, IT companies, agencies, and consultancies. It natively implements the **CGST/SGST/IGST Act 2017**, **Income Tax Act (Section 194 TDS)**, and **MCA Rule 11(g) Tamper-Proof Audit Trail** requirements.

A step-by-step practical manual to managing your invoices, vendor payables, Input Tax Credit (ITC), and GST returns. No complex accounting background needed — just follow along.

---

## 1. Getting started

### Logging in
1. Open the app URL (e.g. `http://localhost:4000` or your deployed domain).
2. Enter your **username or email** and **password**.
3. First time? You'll be asked to set a new password — do it and you're in.

### The sidebar (your main menu)
| Menu | What it's for |
|------|---------------|
| **Dashboard** | Snapshot of money in/out, overdue invoices, top clients |
| **Receivables** | Invoices you raise to clients |
| **Quotes** | Estimates/proposals before an invoice |
| **Credit Notes** | Refund/adjustment notes against invoices |
| **Expenses** | Bills you pay to vendors, freelancers, staff |
| **Reports** | GST returns, TDS, Profit & Loss |
| **GSTR-2B Match** | Check your purchase tax credits against the govt |
| **Customers / Vendors / Employees** | Your contacts |
| **Services** | Your service catalogue (reused on invoices) |
| **Audit Log** | Every change ever made (tamper-proof history) |
| **Settings** | Company details, GST, bank, numbering |

---

## 2. One-time setup (do this first)

Go to **Settings → Company** and fill in:
- **Company name, address, GSTIN, PAN**
- **Bank details** (shown on invoices for payment)
- **Branding & White-Label:**
  - **App & Display Name**: Name of your studio/firm displayed across the portal.
  - **Brand Accent Color**: Select from 7 designer swatches (Emerald, Indigo, Violet, Amber, Rose, Cyan, Slate) or input a custom hex code.
  - **Logos & Favicon**: Upload your primary logo (for light pages), white logo (for dark theme & headers), and custom browser favicon.
- **Invoice numbering** — pick a format (e.g. `MODUS/2026-27/001`, resets every financial year)
- **GST compliance:** LUT number (if you export services), "Turnover above ₹5 crore" toggle

Then add your **Services** (Services menu) — the things you sell (e.g. "Social Media Management"), each with an SAC code and GST rate. These auto-fill when you make invoices.

Add your **Customers** and **Vendors** as you go (you can also add them on the fly while making an invoice/bill).

> **Tip — GST Treatment:** when adding a customer or vendor, pick their **GST Treatment** (Registered, Unregistered, Overseas/Export, SEZ…). This one setting makes the app apply the correct tax automatically.

---

## 3. Creating an invoice (the main flow)

1. Click **Receivables → New invoice** (or the **New Invoice** button).
2. **Pick the customer** (or add a new one). Their GST details load automatically.
3. **Invoice number & dates** are pre-filled — adjust the due date / payment terms if needed.
4. **Add line items:**
   - Type or pick a **service** from your catalogue.
   - Set **quantity, rate, GST %** (usually 18% for services).
   - The app calculates **CGST + SGST** (same state) or **IGST** (other state) for you.
5. Check the **summary on the right** — taxable value, GST, total.
6. **Notes & terms** pre-fill from your defaults; edit if needed.
7. Click **Save draft** (keeps it editable) or **Send invoice**.

### Sending an invoice
- Click **Send** on the invoice — it emails a nicely formatted invoice + PDF to the client.
- Status changes to **Sent**.

### Special cases (handled automatically)
- **Foreign / export clients:** if the customer's treatment is **Overseas**, the invoice is **zero-rated** (no GST) and shows the export declaration. You'll be stopped if you accidentally add tax.
- **Different state client:** the app switches to **IGST** automatically.

---

## 4. Getting paid

Open any invoice → the right panel shows **Balance due**.
- Click **Record Payment** → enter amount, date, method (bank/UPI/cheque), reference. The balance updates.
- Partial payments are fine — status shows **Partially paid** until fully settled.

### If a client deducted TDS
Companies often pay you *minus* TDS (e.g. they keep 10% and deposit it to the govt against your PAN).
- On the invoice, click **Record TDS deducted** → pick the section (usually **194J** for professional fees) and rate.
- The app treats that TDS as **settled** (not outstanding), so the invoice closes correctly.
- You can see all such TDS under **Reports → TDS (26AS)** to reconcile with your Form 26AS at tax time.

---

## 5. Refunds & credit notes

Need to refund a client or reduce an invoice (returned service, post-sale discount, billing correction)?

1. Open the invoice → **Issue Credit Note**.
2. Enter the **amount to credit** (full or partial) + a **reason** + date.
3. The app builds a GST-compliant credit note, reduces the invoice balance, and (if fully credited) marks it **Credited**.
4. If money actually goes back to the client, click **Record Refund** on that credit note.

> Credit notes appear in your GST returns (GSTR-1 CDNR) automatically and reduce your tax — no manual adjustment.
> **Note:** GST law only lets a credit note adjust tax up to **30 November after the financial year**. The app blocks later ones.

All credit notes are listed under the **Credit Notes** menu.

---

## 6. Recording expenses (bills)

Click **Expenses → Record Bill**:
1. **Title** + **category** (marketing, software, travel, etc.).
2. **Paid to** — pick a saved vendor, or just type a name for a one-off.
3. **Amount** and **Tax/GST** (if the vendor charged GST).
4. **Dates**, notes, and upload the **receipt** (drag & drop — there's even an AI scan).
5. Save. If you're not a superadmin, it goes for **approval** first.

### GST input credit (ITC)
- **ITC eligibility** is auto-set by category. Petrol, food, and travel are **blocked** (you can't claim their GST) — the app handles this.
- To claim GST credit on a bill, the vendor must be **GST-registered** and you must enter their **invoice number** — the app reminds you.

### Reverse Charge (RCM) — e.g. Google/Facebook Ads
When you buy ads or software from a **foreign** vendor, *you* owe the GST (called Reverse Charge).
- The app **auto-detects** this when the vendor is set to **Overseas** and computes the IGST.
- It assigns a **self-invoice number** and puts it in your GSTR-3B automatically. You don't do anything extra.

### TDS you deduct (freelancers, contractors, rent)
When you pay a freelancer/contractor, you often must **deduct TDS** and deposit it.
- On the bill, pick a **TDS section** (e.g. **194J** professional, **194C** contractor) — the rate auto-fills.
- The app shows the **net amount to actually pay** the vendor and tracks the TDS for your **26Q** filing (Reports → TDS).

---

## 7. Reports (this is your compliance toolkit)

Go to **Reports** and pick a report; set the date range at the top.

| Report | Use it for |
|--------|-----------|
| **GST / Invoice Summary** | Quick view of all invoices + tax |
| **GSTR-1** | Outward supplies — B2B, B2C, exports, credit notes (CDNR) |
| **GSTR-3B** | Monthly summary return — tax payable, input credit |
| **HSN-wise** | Tax grouped by SAC/HSN code |
| **Profit & Loss** | Revenue minus expenses |
| **TDS — 26Q & 26AS** | TDS you deducted (to deposit/file) + TDS clients deducted from you |

### Filing your GST return
1. Open **GSTR-1** (or **GSTR-3B**) for the month.
2. Click the **download menu → "Govt JSON (GSTR-1/3B)"**.
3. This gives you a file in the exact format the **GST portal's offline tool** accepts — upload it there to file. No re-typing.

You can also export any report as **PDF / Excel / CSV**.

---

## 8. GSTR-2B matching (claim the right input credit)

Each month the govt publishes **GSTR-2B** — the list of purchases your vendors reported. You can only claim GST credit that appears there.

1. Download your **GSTR-2B JSON** from the GST portal (Returns → GSTR-2B → Download).
2. In MODUS, go to **GSTR-2B Match**, pick the period, and **upload the file**.
3. Click **Reconcile**. You'll see:
   - **Matched** — bills that agree with the portal.
   - **In books, not in 2B** — you claimed it but the vendor hasn't filed → **credit at risk**, chase the vendor.
   - **In 2B, not in books** — a purchase you forgot to record → add it to claim the credit.
   - **Mismatches** — tax amounts differ.

---

## 9. Other things

### Quotes
Make an estimate under **Quotes**; convert it to an invoice once the client agrees.

### Projects
Tag invoices and bills to a **Project** to see live profit/loss per client engagement.

### Audit Log
Every edit to invoices, bills, and payments is recorded permanently under **Audit Log** — who changed what, and when. This is a legal requirement for companies and can't be turned off or edited.

### Locking a filed period
After you file a month's GST return, a superadmin can set **Settings → "Books locked up to"** to that date. Locked invoices/bills can't be edited or deleted (you'd use a credit note instead) — this keeps your books matching what you filed.

---

## 10. Quick reference — common tasks

| I want to… | Do this |
|------------|---------|
| Bill a client | Receivables → New invoice |
| Email an invoice | Open invoice → Send |
| Mark an invoice paid | Open invoice → Record Payment |
| Refund a client | Open invoice → Issue Credit Note → Record Refund |
| Record client-deducted TDS | Open invoice → Record TDS deducted |
| Log an expense | Expenses → Record Bill |
| Deduct TDS on a freelancer | On the bill, pick a TDS section |
| File GSTR-1/3B | Reports → open it → download Govt JSON |
| Check my input credit | GSTR-2B Match → upload 2B → Reconcile |
| See who changed something | Audit Log |

---

## 11. Glossary — the tax terms, in plain English

New to GST/tax words? Here's every term in the app explained simply, with tiny examples. You don't need to memorise them — the app handles the hard parts.

### On an invoice — the three action buttons
You sent a client an invoice for **₹1,00,000**. Now:

- **Record Payment** — the client paid you. Log how much, when, and how (bank/UPI/cheque).
- **Issue Credit Note** — you need to **reduce or cancel** an invoice you already sent (client cancelled part of the work, you gave a post-billing discount, or you made a mistake). You can't legally edit a sent invoice, so you issue a credit note = an official *"reduce this invoice by ₹X"* document.
- **Record TDS deducted** — a company client often pays you **less than the full amount**: they keep a slice (say 10% = ₹10,000), pay you ₹90,000, and **deposit that ₹10,000 to the government against your PAN** as advance income-tax on your behalf. It's not unpaid money — it's parked with the govt in your name. This button tells the app *"the shortfall is TDS, not a pending payment,"* so the invoice closes correctly. You'll claim that ₹10,000 when you file your income tax.

> **Rule of thumb:** short-paid by a round % → **Record TDS**. Paid part of it → **Record Payment**. Need to undo/reduce → **Issue Credit Note**.

### "Reverse Charge Applicable" checkbox (on an invoice)
Normally **you** collect GST from the client and pay it to the govt. **Reverse charge** flips it — the **client** pays the GST directly to the govt instead. This is **rare** for normal service invoices. **Leave it unchecked** unless a CA specifically tells you a service needs it.

### Credit Notes page — why it's read-only
A credit note is a **legal GST document** (like a negative invoice). The law says invoices and credit notes **can't be edited** once issued — you **cancel and reissue**, never edit. The page just lists all credit notes for your records and GST filing. You *create* them from an invoice.

### On an expense (bill) — three tax settings

- **ITC eligibility (Input Tax Credit):** when you buy something for the business and pay GST, you can usually **subtract that GST from the GST you owe** on your sales — like getting the tax back.
  - **Eligible** = you can claim it (software, internet, marketing, equipment…).
  - **Ineligible** = the law blocks it (petrol, food, personal items).
  - **What to do:** leave it on **Auto** — the app picks correctly by category.
- **Reverse Charge (RCM):** when you buy from a **foreign** vendor (Google Ads, Meta Ads, Figma, AWS…), *you* owe the Indian GST (the foreign vendor can't charge it). The app **auto-detects** this when the vendor is marked "Overseas" and handles everything. You do nothing.
- **TDS section:** when **you pay a freelancer / contractor / consultant / rent**, you must **hold back a % as income tax** and deposit it to the govt. The "section" is just which rule/rate applies:
  - **194J** — professional/technical fees (designer, developer, consultant) — ~10%
  - **194C** — contractor doing a job — ~1–2%
  - **194H** — commission — ~2%
  - **194I** — rent — ~10%
  - **What to do:** paying a freelancer? Pick **194J**. The app shows the net amount to actually pay them and tracks the TDS for filing.

### The 6 Reports
1. **GST / Invoice Summary** — a plain list of all invoices with the tax on each.
2. **GSTR-1** — the monthly return where you **tell the govt about your sales**. Download the "Govt JSON" and upload it to the GST portal.
3. **GSTR-3B** — the monthly **summary return**: tax collected − tax credits = **how much to actually pay**.
4. **HSN-wise Summary** — your sales grouped by **service code** (the govt wants a code-wise summary).
5. **Profit & Loss** — sales minus expenses = are you making money.
6. **TDS — 26Q & 26AS** — **26Q** = TDS *you* deducted from freelancers (to deposit + file); **26AS** = TDS *clients* deducted from *you* (to claim in your income tax).

### GSTR-2B Match page
The govt only lets you claim GST credit (ITC) on a purchase if **your vendor also reported that sale**. Each month the govt publishes **GSTR-2B** = the list of purchases your vendors declared. Upload that file here and the app matches it to your recorded expenses:
- **Matched** — safe to claim.
- **You recorded it, vendor didn't** → your credit is **at risk**, chase the vendor.
- **Vendor reported it, you forgot** → add it so you don't lose the credit.

### Audit Log page
A **tamper-proof history** of every change to invoices, bills, and payments — who changed what, and when. It **can't be edited or switched off** — a legal requirement for companies. You rarely touch it; it's there for safety and audits.

---

*Questions or something not working? Contact your MODUS workspace administrator.*
