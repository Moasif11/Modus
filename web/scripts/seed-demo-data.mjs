import { neon } from '@neondatabase/serverless';
import argon2 from 'argon2';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env
const envPath = path.resolve(__dirname, '../.env');
let databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl && fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  const match = content.match(/^DATABASE_URL=(.+)$/m);
  if (match) databaseUrl = match[1].trim();
}

if (!databaseUrl) {
  console.error('Error: DATABASE_URL is not set.');
  process.exit(1);
}

console.log('Connecting to database for demo data seeding...');
const sql = neon(databaseUrl);

async function seed() {
  try {
    console.log('Seeding realistic demo data across all MODUS ERP modules...\n');

    // ──────────────────────────────────────────────────────────────────────────
    // 1. Company Settings / Branding
    // ──────────────────────────────────────────────────────────────────────────
    console.log('1. Ensuring company profile & branding...');
    await sql`
      INSERT INTO company_settings (
        id, legal_name, trade_name, registered_name,
        gstin, pan, cin, email, phone, website,
        address_line1, address_line2, city, state, state_code, pincode, country,
        invoice_prefix, next_invoice_number, invoice_format,
        quote_prefix, next_quote_number,
        proforma_prefix, next_proforma_number,
        self_invoice_prefix, next_self_invoice_number,
        credit_note_prefix, next_credit_note_number,
        default_terms, default_declaration,
        brand_color, brand_color_dark, app_name, tagline
      )
      VALUES (
        1,
        'Modus Digital Solutions Private Limited',
        'Modus Technologies',
        'Modus Digital Solutions Pvt Ltd',
        '27AABCM9988C1Z4',
        'AABCM9988C',
        'U72900MH2023PTC123456',
        'accounts@modus.local',
        '+91 98200 12345',
        'https://modus.local',
        'Level 9, Tech Park One, Bandra Kurla Complex',
        'Bandra East',
        'Mumbai',
        'Maharashtra',
        '27',
        '400051',
        'India',
        'INV', 6, 'fy',
        'QT', 4,
        'PI', 3,
        'SI', 2,
        'CN', 2,
        'Payment is due within 30 days from date of invoice. Late payments attract 1.5% interest per month.',
        'We declare that this invoice shows the actual price of the services described and that all particulars are true and correct.',
        '#E11D2C',
        '#991B1B',
        'MODUS ERP',
        'Enterprise Studio Management & GST Invoicing'
      )
      ON CONFLICT (id) DO UPDATE SET
        legal_name = EXCLUDED.legal_name,
        trade_name = EXCLUDED.trade_name,
        gstin = EXCLUDED.gstin,
        pan = EXCLUDED.pan,
        brand_color = EXCLUDED.brand_color,
        app_name = EXCLUDED.app_name,
        tagline = EXCLUDED.tagline,
        updated_at = NOW();
    `;
    console.log('✓ Company settings verified.');

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Users & Team Members
    // ──────────────────────────────────────────────────────────────────────────
    console.log('2. Seeding team members...');
    const defaultPasswordHash = await argon2.hash('Modus@2026Admin');
    const teamPasswordHash = await argon2.hash('Modus@Team2026');

    // Ensure superadmin
    await sql`
      INSERT INTO users (username, name, full_name, email, role, password_hash, must_reset_password, is_active, designation, department)
      VALUES ('admin', 'Admin', 'Modus Administrator', 'admin@modus.local', 'superadmin', ${defaultPasswordHash}, false, true, 'System Administrator', 'Operations')
      ON CONFLICT (email) DO UPDATE SET
        role = 'superadmin',
        is_active = true,
        updated_at = NOW();
    `;

    const demoUsers = [
      { username: 'priya', name: 'Priya Sharma', fullName: 'Priya Sharma', email: 'priya.sharma@modus.local', role: 'admin', designation: 'VP Finance & Controller', department: 'Finance' },
      { username: 'arjun', name: 'Arjun Mehta', fullName: 'Arjun Mehta', email: 'arjun.mehta@modus.local', role: 'user', designation: 'Senior Client Partner', department: 'Client Accounts' },
      { username: 'kavita', name: 'Kavita Rao', fullName: 'Kavita Rao', email: 'kavita.rao@modus.local', role: 'user', designation: 'Principal Architect', department: 'Engineering' },
      { username: 'rohit', name: 'Rohit Verma', fullName: 'Rohit Verma', email: 'rohit.verma@modus.local', role: 'user', designation: 'Creative Director', department: 'Design' },
    ];

    for (const u of demoUsers) {
      await sql`
        INSERT INTO users (username, name, full_name, email, role, password_hash, must_reset_password, is_active, designation, department)
        VALUES (${u.username}, ${u.name}, ${u.fullName}, ${u.email}, ${u.role}, ${teamPasswordHash}, false, true, ${u.designation}, ${u.department})
        ON CONFLICT (email) DO UPDATE SET
          name = EXCLUDED.name,
          full_name = EXCLUDED.full_name,
          designation = EXCLUDED.designation,
          department = EXCLUDED.department,
          is_active = true,
          updated_at = NOW();
      `;
    }
    console.log('✓ 5 Team members active.');

    // Fetch user IDs
    const userRows = await sql`SELECT id, email FROM users`;
    const userMap = Object.fromEntries(userRows.map(u => [u.email, u.id]));
    const adminId = userMap['admin@modus.local'] || 1;

    // ──────────────────────────────────────────────────────────────────────────
    // 3. Customers / Clients
    // ──────────────────────────────────────────────────────────────────────────
    console.log('3. Seeding corporate clients...');
    const demoCustomers = [
      {
        name: 'Nexus Interactive Technologies',
        companyName: 'Nexus Interactive Technologies Pvt Ltd',
        gstin: '27AABCN1234F1Z5',
        pan: 'AABCN1234F',
        email: 'billing@nexusinteractive.com',
        phone: '+91 22 4567 8900',
        website: 'https://nexusinteractive.com',
        customerType: 'business',
        gstTreatment: 'registered_regular',
        creditLimit: 2500000,
        billingAddress: 'Tower B, 14th Floor, Mindspace Tech Park, Malad West',
        city: 'Mumbai',
        state: 'Maharashtra',
        stateCode: '27',
        pincode: '400064',
        contactPerson: 'Siddharth Nair (VP Technology)',
      },
      {
        name: 'Zenith Global Media',
        companyName: 'Zenith Global Media & Ventures LLC',
        gstin: null,
        pan: null,
        email: 'finance@zenithmedia.io',
        phone: '+1 415 890 2345',
        website: 'https://zenithmedia.io',
        customerType: 'business',
        gstTreatment: 'overseas',
        creditLimit: 5000000,
        billingAddress: '548 Market Street, Suite 3200',
        city: 'San Francisco',
        state: 'California',
        stateCode: '96',
        pincode: '94104',
        country: 'United States',
        contactPerson: 'Elena Rostova (Managing Partner)',
      },
      {
        name: 'CloudScale Solutions India',
        companyName: 'CloudScale Solutions India Pvt Ltd',
        gstin: '29AAACF5678J1Z2',
        pan: 'AAACF5678J',
        email: 'accounts@cloudscale.in',
        phone: '+91 80 6789 0123',
        website: 'https://cloudscale.in',
        customerType: 'business',
        gstTreatment: 'registered_regular',
        creditLimit: 2000000,
        billingAddress: 'Embassy Tech Village, Outer Ring Road, Devarabeesanahalli',
        city: 'Bengaluru',
        state: 'Karnataka',
        stateCode: '29',
        pincode: '560103',
        contactPerson: 'Anand Sundaram (Director of Engineering)',
      },
      {
        name: 'UrbanPulse Retail Ventures',
        companyName: 'UrbanPulse Retail Ventures LLP',
        gstin: '07AABCU9012K1Z8',
        pan: 'AABCU9012K',
        email: 'payables@urbanpulse.in',
        phone: '+91 11 2345 6789',
        website: 'https://urbanpulse.in',
        customerType: 'business',
        gstTreatment: 'registered_regular',
        creditLimit: 1500000,
        billingAddress: 'Barakhamba Road, Connaught Place',
        city: 'New Delhi',
        state: 'Delhi',
        stateCode: '07',
        pincode: '110001',
        contactPerson: 'Meera Kapoor (Head of Procurement)',
      },
      {
        name: 'Apex Mobility & Logistics',
        companyName: 'Apex Mobility Solutions Limited',
        gstin: '33AABCA3456M1Z1',
        pan: 'AABCA3456M',
        email: 'vendor-desk@apexmobility.com',
        phone: '+91 44 2890 1234',
        website: 'https://apexmobility.com',
        customerType: 'business',
        gstTreatment: 'registered_regular',
        creditLimit: 3000000,
        billingAddress: 'Old Mahabalipuram Road (OMR), Taramani',
        city: 'Chennai',
        state: 'Tamil Nadu',
        stateCode: '33',
        pincode: '600113',
        contactPerson: 'Ramanathan Iyer (VP Supply Chain)',
      },
    ];

    const customerMap = {};
    for (const c of demoCustomers) {
      const existing = await sql`SELECT id FROM customers WHERE company_name = ${c.companyName} LIMIT 1`;
      let custId;
      if (existing.length > 0) {
        custId = existing[0].id;
        await sql`
          UPDATE customers SET
            name = ${c.name},
            email = ${c.email},
            phone = ${c.phone},
            website = ${c.website},
            credit_limit = ${c.creditLimit},
            gstin = ${c.gstin},
            pan = ${c.pan},
            gst_treatment = ${c.gstTreatment},
            billing_address = ${c.billingAddress},
            city = ${c.city},
            state = ${c.state},
            state_code = ${c.stateCode},
            pincode = ${c.pincode},
            country = ${c.country || 'India'},
            contact_person = ${c.contactPerson},
            is_archived = false,
            updated_at = NOW()
          WHERE id = ${custId}
        `;
      } else {
        const ins = await sql`
          INSERT INTO customers (
            name, company_name, gstin, pan, email, phone, website, customer_type,
            credit_limit, billing_address, city, state, state_code, pincode,
            country, contact_person, gst_treatment
          )
          VALUES (
            ${c.name}, ${c.companyName}, ${c.gstin}, ${c.pan}, ${c.email}, ${c.phone}, ${c.website}, ${c.customerType},
            ${c.creditLimit}, ${c.billingAddress}, ${c.city}, ${c.state}, ${c.stateCode}, ${c.pincode},
            ${c.country || 'India'}, ${c.contactPerson}, ${c.gstTreatment}
          )
          RETURNING id
        `;
        custId = ins[0].id;
      }
      customerMap[c.name] = custId;

      // Sync customer folder
      await sql`
        INSERT INTO document_folders (name, customer_id, created_by)
        VALUES (${c.companyName}, ${custId}, ${adminId})
        ON CONFLICT (customer_id) WHERE customer_id IS NOT NULL DO NOTHING;
      `;
    }
    console.log('✓ 5 Corporate clients & document folders synchronized.');

    // ──────────────────────────────────────────────────────────────────────────
    // 4. Projects
    // ──────────────────────────────────────────────────────────────────────────
    console.log('4. Seeding active and completed projects...');
    const demoProjects = [
      { name: 'Nexus Enterprise Cloud Portal', clientName: 'Nexus Interactive Technologies', budget: 1850000, status: 'active', start: '2026-01-15', end: '2026-08-30' },
      { name: 'Zenith Global Design System & Web', clientName: 'Zenith Global Media', budget: 2400000, status: 'active', start: '2026-02-01', end: '2026-07-31' },
      { name: 'CloudScale Telemetry Ingestion Hub', clientName: 'CloudScale Solutions India', budget: 1200000, status: 'completed', start: '2025-09-01', end: '2026-03-31' },
      { name: 'UrbanPulse Mobile Commerce Experience', clientName: 'UrbanPulse Retail Ventures', budget: 1550000, status: 'active', start: '2026-03-10', end: '2026-09-15' },
    ];

    const projectMap = {};
    for (const p of demoProjects) {
      const clientId = customerMap[p.clientName];
      const existing = await sql`SELECT id FROM projects WHERE name = ${p.name} LIMIT 1`;
      let projId;
      if (existing.length > 0) {
        projId = existing[0].id;
        await sql`
          UPDATE projects SET
            client_id = ${clientId},
            budget = ${p.budget},
            status = ${p.status},
            start_date = ${p.start},
            end_date = ${p.end},
            updated_at = NOW()
          WHERE id = ${projId}
        `;
      } else {
        const ins = await sql`
          INSERT INTO projects (name, client_id, budget, status, start_date, end_date, created_by)
          VALUES (${p.name}, ${clientId}, ${p.budget}, ${p.status}, ${p.start}, ${p.end}, ${adminId})
          RETURNING id
        `;
        projId = ins[0].id;
      }
      projectMap[p.name] = projId;
    }
    console.log('✓ 4 Strategic projects created.');

    // ──────────────────────────────────────────────────────────────────────────
    // 5. Services Catalog
    // ──────────────────────────────────────────────────────────────────────────
    console.log('5. Ensuring agency services catalog...');
    const demoServices = [
      { name: 'Full-Stack Web Engineering', description: 'Next.js & Node production engineering with automated testing and CI/CD pipelines', price: 85000, gstRate: 18, sac: '998314' },
      { name: 'Cloud Infrastructure & DevOps Advisory', description: 'Kubernetes, AWS/GCP architecture, Terraform automation, and observability', price: 95000, gstRate: 18, sac: '998311' },
      { name: 'Enterprise UI/UX Design System', description: 'Comprehensive design tokens, component library, accessibility WCAG audit, and Figma system', price: 65000, gstRate: 18, sac: '998314' },
      { name: 'Brand Strategy & Identity Guidelines', description: 'Visual positioning, logo suite, typography hierarchy, and brand narrative book', price: 45000, gstRate: 18, sac: '998311' },
      { name: 'Quarterly Maintenance & SLA Support', description: '24/7 uptime monitoring, security patching, database optimization, and on-call response', price: 35000, gstRate: 18, sac: '998313' },
    ];

    for (const s of demoServices) {
      await sql`
        INSERT INTO services (name, description, default_price, gst_rate, hsn_sac_code)
        VALUES (${s.name}, ${s.description}, ${s.price}, ${s.gstRate}, ${s.sac})
        ON CONFLICT (name) DO UPDATE SET
          description = EXCLUDED.description,
          default_price = EXCLUDED.default_price,
          gst_rate = EXCLUDED.gst_rate,
          hsn_sac_code = EXCLUDED.hsn_sac_code,
          updated_at = NOW();
      `;
    }
    console.log('✓ 5 Agency services cataloged.');

    // ──────────────────────────────────────────────────────────────────────────
    // 6. Invoices, Line Items & Payments
    // ──────────────────────────────────────────────────────────────────────────
    console.log('6. Seeding interconnected invoices, tax breakdowns & payments...');

    const demoInvoices = [
      {
        number: 'INV/2025-26/001',
        clientName: 'Nexus Interactive Technologies',
        projectName: 'Nexus Enterprise Cloud Portal',
        date: '2026-02-15',
        dueDate: '2026-03-17',
        status: 'paid',
        paymentTerms: 'Net 30',
        placeOfSupply: 'Maharashtra',
        placeOfSupplyCode: '27',
        isInterstate: false,
        treatment: 'registered_regular',
        items: [
          { name: 'Phase 1 Architecture & Foundation', sac: '998314', qty: 1, rate: 200000, gstRate: 18 },
          { name: 'API Contract & Database Modeling', sac: '998314', qty: 1, rate: 150000, gstRate: 18 },
        ],
        payments: [
          { amount: 413000, date: '2026-03-10', method: 'bank_transfer', ref: 'NEFT-NEXUS-098231', notes: 'Full settlement via HDFC Bank' },
        ],
      },
      {
        number: 'INV/2025-26/002',
        clientName: 'Zenith Global Media',
        projectName: 'Zenith Global Design System & Web',
        date: '2026-03-01',
        dueDate: '2026-03-31',
        status: 'paid',
        paymentTerms: 'Due on Receipt',
        placeOfSupply: 'Other Territory / Overseas',
        placeOfSupplyCode: '96',
        isInterstate: true,
        treatment: 'overseas',
        lutNumber: 'AD270324000123M',
        currency: 'USD',
        exchangeRate: 85.0,
        items: [
          { name: 'Global Brand Guidelines & Design Tokens', sac: '998311', qty: 1, rate: 10000, gstRate: 0 },
        ],
        payments: [
          { amount: 850000, date: '2026-03-25', method: 'wire', ref: 'SWIFT-CITI-US-77123', notes: 'Inward wire remittance under LUT' },
        ],
      },
      {
        number: 'INV/2026-27/001',
        clientName: 'CloudScale Solutions India',
        projectName: 'CloudScale Telemetry Ingestion Hub',
        date: '2026-04-05',
        dueDate: '2026-05-05',
        status: 'paid',
        paymentTerms: 'Net 30',
        placeOfSupply: 'Karnataka',
        placeOfSupplyCode: '29',
        isInterstate: true,
        treatment: 'registered_regular',
        items: [
          { name: 'Production Cutover & Load Testing Benchmark', sac: '998314', qty: 1, rate: 500000, gstRate: 18 },
        ],
        payments: [
          { amount: 590000, date: '2026-04-28', method: 'bank_transfer', ref: 'RTGS-KRN-445129', notes: 'Final project milestone payment' },
        ],
      },
      {
        number: 'INV/2026-27/002',
        clientName: 'UrbanPulse Retail Ventures',
        projectName: 'UrbanPulse Mobile Commerce Experience',
        date: '2026-05-10',
        dueDate: '2026-06-10',
        status: 'partially_paid',
        paymentTerms: 'Net 30',
        placeOfSupply: 'Delhi',
        placeOfSupplyCode: '07',
        isInterstate: true,
        treatment: 'registered_regular',
        items: [
          { name: 'Mobile App Wireframes & Interactive Prototypes', sac: '998314', qty: 1, rate: 175000, gstRate: 18 },
          { name: 'Checkout UX Optimization & Cart Redesign', sac: '998314', qty: 1, rate: 100000, gstRate: 18 },
        ],
        payments: [
          { amount: 200000, date: '2026-05-25', method: 'bank_transfer', ref: 'IMPS-URB-662319', notes: 'First tranche advance payment' },
        ],
      },
      {
        number: 'INV/2026-27/003',
        clientName: 'Apex Mobility & Logistics',
        projectName: null,
        date: '2026-06-01',
        dueDate: '2026-07-01',
        status: 'sent',
        paymentTerms: 'Net 30',
        placeOfSupply: 'Tamil Nadu',
        placeOfSupplyCode: '33',
        isInterstate: true,
        treatment: 'registered_regular',
        items: [
          { name: 'Quarterly Maintenance & Security Hardening (Q1)', sac: '998313', qty: 1, rate: 600000, gstRate: 18 },
        ],
        payments: [],
      },
      {
        number: 'INV/2026-27/004',
        clientName: 'Nexus Interactive Technologies',
        projectName: 'Nexus Enterprise Cloud Portal',
        date: '2026-05-01',
        dueDate: '2026-05-31',
        status: 'overdue',
        paymentTerms: 'Net 30',
        placeOfSupply: 'Maharashtra',
        placeOfSupplyCode: '27',
        isInterstate: false,
        treatment: 'registered_regular',
        items: [
          { name: 'Enterprise Single Sign-On & RBAC Implementation', sac: '998314', qty: 1, rate: 200000, gstRate: 18 },
        ],
        payments: [],
      },
      {
        number: 'INV/2026-27/005',
        clientName: 'CloudScale Solutions India',
        projectName: null,
        date: '2026-06-15',
        dueDate: '2026-07-15',
        status: 'draft',
        paymentTerms: 'Net 30',
        placeOfSupply: 'Karnataka',
        placeOfSupplyCode: '29',
        isInterstate: true,
        treatment: 'registered_regular',
        items: [
          { name: 'Architecture Discovery & Cloud Audit Assessment', sac: '998311', qty: 1, rate: 400000, gstRate: 18 },
        ],
        payments: [],
      },
    ];

    for (const inv of demoInvoices) {
      const custId = customerMap[inv.clientName];
      const projId = inv.projectName ? projectMap[inv.projectName] : null;

      // Compute invoice totals
      let subtotal = 0;
      let taxableAmount = 0;
      let cgstAmount = 0;
      let sgstAmount = 0;
      let igstAmount = 0;

      for (const item of inv.items) {
        const itemTotal = item.qty * item.rate;
        subtotal += itemTotal;
        taxableAmount += itemTotal;

        if (item.gstRate > 0) {
          if (inv.isInterstate) {
            igstAmount += (itemTotal * item.gstRate) / 100;
          } else {
            cgstAmount += (itemTotal * (item.gstRate / 2)) / 100;
            sgstAmount += (itemTotal * (item.gstRate / 2)) / 100;
          }
        }
      }

      const totalTax = cgstAmount + sgstAmount + igstAmount;
      const grandTotal = taxableAmount + totalTax;

      // Check existing invoice
      const existingInv = await sql`SELECT id FROM invoices WHERE invoice_number = ${inv.number} LIMIT 1`;
      let invoiceId;

      if (existingInv.length > 0) {
        invoiceId = existingInv[0].id;
        await sql`
          UPDATE invoices SET
            customer_id = ${custId},
            project_id = ${projId},
            invoice_date = ${inv.date},
            due_date = ${inv.dueDate},
            status = ${inv.status},
            payment_terms = ${inv.paymentTerms},
            place_of_supply = ${inv.placeOfSupply},
            place_of_supply_code = ${inv.placeOfSupplyCode},
            is_interstate = ${inv.isInterstate},
            gst_treatment = ${inv.treatment},
            subtotal = ${subtotal},
            taxable_amount = ${taxableAmount},
            cgst_amount = ${cgstAmount},
            sgst_amount = ${sgstAmount},
            igst_amount = ${igstAmount},
            total_tax = ${totalTax},
            grand_total = ${grandTotal},
            currency = ${inv.currency || 'INR'},
            exchange_rate = ${inv.exchangeRate || 1.0},
            updated_at = NOW()
          WHERE id = ${invoiceId}
        `;
        // Clear items to re-insert clean lines
        await sql`DELETE FROM invoice_items WHERE invoice_id = ${invoiceId}`;
      } else {
        const ins = await sql`
          INSERT INTO invoices (
            invoice_number, customer_id, project_id, invoice_date, due_date, status,
            payment_terms, place_of_supply, place_of_supply_code, is_interstate,
            gst_treatment, subtotal, taxable_amount, cgst_amount, sgst_amount,
            igst_amount, total_tax, grand_total, currency, exchange_rate, created_by
          )
          VALUES (
            ${inv.number}, ${custId}, ${projId}, ${inv.date}, ${inv.dueDate}, ${inv.status},
            ${inv.paymentTerms}, ${inv.placeOfSupply}, ${inv.placeOfSupplyCode}, ${inv.isInterstate},
            ${inv.treatment}, ${subtotal}, ${taxableAmount}, ${cgstAmount}, ${sgstAmount},
            ${igstAmount}, ${totalTax}, ${grandTotal}, ${inv.currency || 'INR'}, ${inv.exchangeRate || 1.0}, ${adminId}
          )
          RETURNING id
        `;
        invoiceId = ins[0].id;
      }

      // Insert line items
      for (let i = 0; i < inv.items.length; i++) {
        const it = inv.items[i];
        const lineTotal = it.qty * it.rate;
        const lineCgst = !inv.isInterstate && it.gstRate > 0 ? (lineTotal * (it.gstRate / 2)) / 100 : 0;
        const lineSgst = !inv.isInterstate && it.gstRate > 0 ? (lineTotal * (it.gstRate / 2)) / 100 : 0;
        const lineIgst = inv.isInterstate && it.gstRate > 0 ? (lineTotal * it.gstRate) / 100 : 0;

        await sql`
          INSERT INTO invoice_items (
            invoice_id, position, item_name, hsn_sac_code, quantity, unit,
            unit_price, taxable_value, gst_rate,
            cgst_rate, sgst_rate, igst_rate,
            cgst_amount, sgst_amount, igst_amount, total_tax, line_total
          )
          VALUES (
            ${invoiceId}, ${i}, ${it.name}, ${it.sac}, ${it.qty}, 'Nos',
            ${it.rate}, ${lineTotal}, ${it.gstRate},
            ${!inv.isInterstate ? it.gstRate / 2 : 0},
            ${!inv.isInterstate ? it.gstRate / 2 : 0},
            ${inv.isInterstate ? it.gstRate : 0},
            ${lineCgst}, ${lineSgst}, ${lineIgst},
            ${lineCgst + lineSgst + lineIgst},
            ${lineTotal + lineCgst + lineSgst + lineIgst}
          )
        `;
      }

      // Insert Payments
      for (const p of inv.payments) {
        const existingPmt = await sql`
          SELECT id FROM payments WHERE invoice_id = ${invoiceId} AND reference_number = ${p.ref} LIMIT 1
        `;
        if (existingPmt.length === 0) {
          await sql`
            INSERT INTO payments (invoice_id, amount, payment_date, payment_method, reference_number, notes)
            VALUES (${invoiceId}, ${p.amount}, ${p.date}, ${p.method}, ${p.ref}, ${p.notes})
          `;
        }
      }
    }
    console.log('✓ 7 Invoices seeded across all lifecycle statuses with verified payments.');

    // ──────────────────────────────────────────────────────────────────────────
    // 7. Credit Note & Refund
    // ──────────────────────────────────────────────────────────────────────────
    console.log('7. Seeding Credit Note & Refund Disbursement...');
    const nexusCustId = customerMap['Nexus Interactive Technologies'];
    const nexusInv = (await sql`SELECT id FROM invoices WHERE invoice_number = 'INV/2025-26/001' LIMIT 1`)[0];

    if (nexusInv) {
      const existingCn = await sql`SELECT id FROM credit_notes WHERE credit_note_number = 'CN/2026-27/001' LIMIT 1`;
      let cnId;
      if (existingCn.length > 0) {
        cnId = existingCn[0].id;
      } else {
        const insCn = await sql`
          INSERT INTO credit_notes (
            credit_note_number, credit_note_date, invoice_id, customer_id,
            reason_code, reason_text, currency, taxable_amount,
            cgst_amount, sgst_amount, total_tax, total_amount, status, created_by
          )
          VALUES (
            'CN/2026-27/001', '2026-04-10', ${nexusInv.id}, ${nexusCustId},
            '01', 'Scope SLA performance discount credit', 'INR', 50000,
            4500, 4500, 9000, 59000, 'issued', ${adminId}
          )
          RETURNING id
        `;
        cnId = insCn[0].id;

        await sql`
          INSERT INTO credit_note_items (
            credit_note_id, item_name, quantity, rate, taxable_value,
            gst_rate, cgst_amount, sgst_amount, total_tax, line_total
          )
          VALUES (
            ${cnId}, 'SLA Adjustment & Rebate', 1, 50000, 50000,
            18, 4500, 4500, 9000, 59000
          )
        `;

        await sql`
          INSERT INTO refund_disbursements (
            credit_note_id, invoice_id, amount, refund_date, method, reference_number, notes, created_by
          )
          VALUES (
            ${cnId}, ${nexusInv.id}, 59000, '2026-04-15', 'bank_transfer', 'REF-NEFT-99120', 'Credit balance refunded to client bank account', ${adminId}
          )
        `;
      }
    }
    console.log('✓ Credit note & refund disbursement recorded.');

    // ──────────────────────────────────────────────────────────────────────────
    // 8. Quotes & Proforma Invoices
    // ──────────────────────────────────────────────────────────────────────────
    console.log('8. Seeding Quotations and Proforma Invoices...');
    const demoQuotes = [
      {
        number: 'QT/2026-27/001',
        clientName: 'Zenith Global Media',
        date: '2026-05-15',
        validUntil: '2026-06-15',
        status: 'accepted',
        subtotal: 1200000,
        taxable: 1200000,
        totalTax: 0,
        grandTotal: 1200000,
        notes: 'Phase 2 International Media Platform expansion',
      },
      {
        number: 'QT/2026-27/002',
        clientName: 'Apex Mobility & Logistics',
        date: '2026-06-01',
        validUntil: '2026-07-01',
        status: 'sent',
        subtotal: 550000,
        taxable: 550000,
        totalTax: 99000,
        grandTotal: 649000,
        notes: 'Driver Partner Experience Mobile Application redesign',
      },
      {
        number: 'QT/2026-27/003',
        clientName: 'UrbanPulse Retail Ventures',
        date: '2026-06-18',
        validUntil: '2026-07-18',
        status: 'draft',
        subtotal: 350000,
        taxable: 350000,
        totalTax: 63000,
        grandTotal: 413000,
        notes: 'Omnichannel inventory integration module',
      },
    ];

    for (const q of demoQuotes) {
      const custId = customerMap[q.clientName];
      const existingQ = await sql`SELECT id FROM quotes WHERE quote_number = ${q.number} LIMIT 1`;
      let qId;
      if (existingQ.length > 0) {
        qId = existingQ[0].id;
      } else {
        const ins = await sql`
          INSERT INTO quotes (
            quote_number, customer_id, quote_date, valid_until, status,
            subtotal, taxable_amount, total_tax, grand_total, notes, created_by
          )
          VALUES (
            ${q.number}, ${custId}, ${q.date}, ${q.validUntil}, ${q.status},
            ${q.subtotal}, ${q.taxable}, ${q.totalTax}, ${q.grandTotal}, ${q.notes}, ${adminId}
          )
          RETURNING id
        `;
        qId = ins[0].id;

        await sql`
          INSERT INTO quote_items (quote_id, position, item_name, quantity, unit_price, taxable_value, gst_rate, total_tax, line_total)
          VALUES (${qId}, 0, ${q.notes}, 1, ${q.subtotal}, ${q.taxable}, 18, ${q.totalTax}, ${q.grandTotal})
        `;
      }
    }

    const demoProformas = [
      {
        number: 'PI/2026-27/001',
        clientName: 'UrbanPulse Retail Ventures',
        date: '2026-05-02',
        validUntil: '2026-06-02',
        status: 'sent',
        subtotal: 423728.81,
        totalTax: 76271.19,
        grandTotal: 500000,
      },
      {
        number: 'PI/2026-27/002',
        clientName: 'CloudScale Solutions India',
        date: '2026-03-20',
        validUntil: '2026-04-20',
        status: 'paid',
        subtotal: 300000,
        totalTax: 54000,
        grandTotal: 354000,
      },
    ];

    for (const pi of demoProformas) {
      const custId = customerMap[pi.clientName];
      const existingPi = await sql`SELECT id FROM proforma WHERE proforma_number = ${pi.number} LIMIT 1`;
      if (existingPi.length === 0) {
        const ins = await sql`
          INSERT INTO proforma (
            proforma_number, customer_id, proforma_date, valid_until, status,
            subtotal, taxable_amount, total_tax, grand_total, created_by
          )
          VALUES (
            ${pi.number}, ${custId}, ${pi.date}, ${pi.validUntil}, ${pi.status},
            ${pi.subtotal}, ${pi.subtotal}, ${pi.totalTax}, ${pi.grandTotal}, ${adminId}
          )
          RETURNING id
        `;
        const piId = ins[0].id;
        await sql`
          INSERT INTO proforma_items (proforma_id, position, item_name, quantity, unit_price, taxable_value, gst_rate, total_tax, line_total)
          VALUES (${piId}, 0, 'Advance Service Mobilization Milestone', 1, ${pi.subtotal}, ${pi.subtotal}, 18, ${pi.totalTax}, ${pi.grandTotal})
        `;
      }
    }
    console.log('✓ 3 Quotations & 2 Proforma invoices created.');

    // ──────────────────────────────────────────────────────────────────────────
    // 9. Vendors & AP Expenses
    // ──────────────────────────────────────────────────────────────────────────
    console.log('9. Seeding Vendors and AP Bills...');
    const demoVendors = [
      { name: 'Amazon Web Services India', company: 'Amazon Web Services India Pvt Ltd', category: 'infrastructure', gstin: '27AABCA3314F1Z8', pan: 'AABCA3314F', email: 'aws-india@amazon.com', city: 'Mumbai' },
      { name: 'WeWork India Workspace', company: 'WeWork India Management Pvt Ltd', category: 'facility', gstin: '29AABCW9876P1Z3', pan: 'AABCW9876P', email: 'billing@wework.co.in', city: 'Bengaluru' },
      { name: 'Figma Software Inc', company: 'Figma Inc.', category: 'software', gstin: null, pan: null, email: 'ar@figma.com', city: 'San Francisco' },
      { name: 'Razorpay Software', company: 'Razorpay Software Pvt Ltd', category: 'payment_gateway', gstin: '29AADCR8813P1ZW', pan: 'AADCR8813P', email: 'support@razorpay.com', city: 'Bengaluru' },
    ];

    const vendorMap = {};
    for (const v of demoVendors) {
      const existing = await sql`SELECT id FROM vendors WHERE name = ${v.name} LIMIT 1`;
      let vId;
      if (existing.length > 0) {
        vId = existing[0].id;
      } else {
        const ins = await sql`
          INSERT INTO vendors (name, company_name, category, gstin, pan, email, city)
          VALUES (${v.name}, ${v.company}, ${v.category}, ${v.gstin}, ${v.pan}, ${v.email}, ${v.city})
          RETURNING id
        `;
        vId = ins[0].id;
      }
      vendorMap[v.name] = vId;
    }

    const demoBills = [
      {
        billNumber: 'BILL-2026-001',
        title: 'AWS Production Cloud Compute & RDS Cluster',
        category: 'infrastructure',
        vendorName: 'Amazon Web Services India',
        amount: 48500,
        amountPaid: 48500,
        billDate: '2026-05-01',
        dueDate: '2026-05-20',
        status: 'paid',
        tax: 7398.3,
        paymentRef: 'NEFT-AWS-009123',
      },
      {
        billNumber: 'BILL-2026-002',
        title: 'Studio Headquarters Coworking Space Lease',
        category: 'rent',
        vendorName: 'WeWork India Workspace',
        amount: 125000,
        amountPaid: 125000,
        billDate: '2026-05-05',
        dueDate: '2026-05-25',
        status: 'paid',
        tax: 19067.8,
        paymentRef: 'RTGS-WEWORK-88129',
      },
      {
        billNumber: 'BILL-2026-003',
        title: 'Figma Enterprise Organization 25-Seat License',
        category: 'software',
        vendorName: 'Figma Software Inc',
        amount: 40320,
        amountPaid: 0,
        billDate: '2026-06-01',
        dueDate: '2026-06-30',
        status: 'approved',
        tax: 0,
      },
      {
        billNumber: 'BILL-2026-004',
        title: 'Monthly Gateway Transaction Settlement Fees',
        category: 'bank_charges',
        vendorName: 'Razorpay Software',
        amount: 8400,
        amountPaid: 8400,
        billDate: '2026-05-31',
        dueDate: '2026-06-15',
        status: 'paid',
        tax: 1281.35,
        paymentRef: 'AUTO-DEBIT-RZP-991',
      },
    ];

    for (const b of demoBills) {
      const vId = vendorMap[b.vendorName];
      const existingB = await sql`SELECT id FROM bills WHERE bill_number = ${b.billNumber} LIMIT 1`;
      let bId;
      if (existingB.length > 0) {
        bId = existingB[0].id;
      } else {
        const ins = await sql`
          INSERT INTO bills (
            bill_number, title, category, vendor_id, amount, amount_paid,
            bill_date, due_date, status, tax, created_by
          )
          VALUES (
            ${b.billNumber}, ${b.title}, ${b.category}, ${vId}, ${b.amount}, ${b.amountPaid},
            ${b.billDate}, ${b.dueDate}, ${b.status}, ${b.tax}, ${adminId}
          )
          RETURNING id
        `;
        bId = ins[0].id;

        if (b.amountPaid > 0 && b.paymentRef) {
          await sql`
            INSERT INTO bill_payments (bill_id, amount, payment_date, payment_method, reference_number, notes)
            VALUES (${bId}, ${b.amountPaid}, ${b.billDate}, 'bank_transfer', ${b.paymentRef}, 'Accounts payable settlement')
          `;
        }
      }
    }
    console.log('✓ 4 Vendors and 4 AP Bills recorded with payment receipts.');

    // ──────────────────────────────────────────────────────────────────────────
    // 10. Employees / Payroll
    // ──────────────────────────────────────────────────────────────────────────
    console.log('10. Seeding Employee records for payroll...');
    const demoEmployees = [
      { name: 'Sameer Kulkarni', empId: 'MOD-001', designation: 'Principal Architect', department: 'Engineering', salary: 180000, email: 'sameer.k@modus.local', joinDate: '2024-01-15' },
      { name: 'Ananya Deshmukh', empId: 'MOD-002', designation: 'Lead UX Designer', department: 'Design', salary: 140000, email: 'ananya.d@modus.local', joinDate: '2024-03-01' },
      { name: 'Vikramaditya Nair', empId: 'MOD-003', designation: 'Senior Fullstack Engineer', department: 'Engineering', salary: 150000, email: 'vikram.n@modus.local', joinDate: '2024-06-10' },
      { name: 'Sunita Patel', empId: 'MOD-004', designation: 'Finance & Compliance Associate', department: 'Finance', salary: 95000, email: 'sunita.p@modus.local', joinDate: '2024-08-01' },
    ];

    for (const emp of demoEmployees) {
      await sql`
        INSERT INTO employees (name, employee_id, designation, department, email, salary_amount, join_date, status)
        VALUES (${emp.name}, ${emp.empId}, ${emp.designation}, ${emp.department}, ${emp.email}, ${emp.salary}, ${emp.joinDate}, 'active')
        ON CONFLICT DO NOTHING;
      `;
    }
    console.log('✓ 4 Employees enrolled in active roster.');

    // ──────────────────────────────────────────────────────────────────────────
    // 11. In-App Notifications
    // ──────────────────────────────────────────────────────────────────────────
    console.log('11. Generating operational notifications...');
    const demoNotifs = [
      { title: 'Payment Confirmed — ₹5,90,000 received', body: 'CloudScale Solutions India settled INV/2026-27/001 via RTGS', type: 'payment', link: '/invoices' },
      { title: 'Invoice Overdue Notice — ₹2,36,000', body: 'INV/2026-27/004 for Nexus Interactive has crossed its due date', type: 'invoice_overdue', link: '/invoices?status=overdue' },
      { title: 'Quote Accepted by Zenith Global Media', body: 'QT/2026-27/001 (₹12,00,000) was approved and is ready for invoicing', type: 'quote', link: '/quotes' },
      { title: 'Cloud Infrastructure Bill Settled', body: 'BILL-2026-001 (AWS) of ₹48,500 has been marked as paid', type: 'payable', link: '/payables' },
    ];

    for (const n of demoNotifs) {
      const existingN = await sql`SELECT id FROM notifications WHERE title = ${n.title} LIMIT 1`;
      if (existingN.length === 0) {
        await sql`
          INSERT INTO notifications (user_id, type, title, body, link, is_read)
          VALUES (${adminId}, ${n.type}, ${n.title}, ${n.body}, ${n.link}, false)
        `;
      }
    }
    console.log('✓ In-app notifications generated.');

    // ──────────────────────────────────────────────────────────────────────────
    // 12. Audit Trail Log
    // ──────────────────────────────────────────────────────────────────────────
    console.log('12. Writing immutable compliance audit log...');
    const auditEvents = [
      { action: 'invoice_create', type: 'invoice', id: '1', meta: { invoiceNumber: 'INV/2026-27/001', grandTotal: 590000 } },
      { action: 'payment_received', type: 'payment', id: '1', meta: { amount: 590000, referenceNumber: 'RTGS-KRN-445129' } },
      { action: 'credit_note_issued', type: 'credit_note', id: '1', meta: { creditNoteNumber: 'CN/2026-27/001', amount: 59000 } },
      { action: 'settings_update', type: 'company_settings', id: '1', meta: { updatedFields: ['legal_name', 'brand_color', 'app_name'] } },
    ];

    for (const a of auditEvents) {
      await sql`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata_json, ip_address)
        VALUES (${adminId}, ${a.action}, ${a.type}, ${a.id}, ${JSON.stringify(a.meta)}, '127.0.0.1')
      `;
    }
    console.log('✓ Audit trail initialized.');

    console.log('\n🎉 SUCCESS: MODUS ERP is now richly populated with production-grade demo data!');
    process.exit(0);
  } catch (error) {
    console.error('Demo seeding failed:', error);
    process.exit(1);
  }
}

seed();
