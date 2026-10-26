import { neon } from '@neondatabase/serverless';
import argon2 from 'argon2';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env if present
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

console.log('Connecting to database...');
const sql = neon(databaseUrl);

async function run() {
  try {
    console.log('Creating schema tables from schema.sql...');
    let schemaSql = fs.readFileSync(path.resolve(__dirname, '../schema.sql'), 'utf8');

    // Strip line comments
    schemaSql = schemaSql.replace(/--.*$/gm, '');

    // Split SQL by semicolons, ignoring empty chunks
    const statements = schemaSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      await sql(statement);
    }
    console.log('✓ Tables created successfully.');

    // Seed Superadmin user
    const existingUsers = await sql`SELECT COUNT(*) as count FROM users`;
    if (parseInt(existingUsers[0].count, 10) === 0) {
      console.log('Seeding superadmin user...');
      const passwordHash = await argon2.hash('Modus@2026Admin');
      await sql`
        INSERT INTO users (username, name, full_name, email, role, password_hash, must_reset_password, is_active)
        VALUES ('admin', 'Admin', 'Modus Administrator', 'admin@modus.local', 'superadmin', ${passwordHash}, true, true)
      `;
      console.log('✓ Superadmin user created (admin@modus.local / Modus@2026Admin).');
    } else {
      console.log('Users already exist, skipping user seeding.');
    }

    // Seed Company Settings
    const existingSettings = await sql`SELECT COUNT(*) as count FROM company_settings`;
    if (parseInt(existingSettings[0].count, 10) === 0) {
      console.log('Seeding company settings...');
      await sql`
        INSERT INTO company_settings (
          legal_name,
          trade_name,
          website,
          invoice_prefix,
          next_invoice_number,
          quote_prefix,
          next_quote_number,
          proforma_prefix,
          next_proforma_number,
          self_invoice_prefix,
          next_self_invoice_number,
          credit_note_prefix,
          next_credit_note_number,
          invoice_format,
          default_terms,
          default_declaration,
          country
        )
        VALUES (
          'Modus Technologies',
          'Modus',
          'modus.local',
          'INV',
          1,
          'QT',
          1,
          'PI',
          1,
          'SI',
          1,
          'CN',
          1,
          'fy',
          'Payment is due within 30 days from the date of invoice. Please make payment to the bank details mentioned above.',
          'We declare that this invoice shows the actual price of the goods/services described and that all particulars are true and correct.',
          'India'
        )
      `;
      console.log('✓ Company settings initialized.');
    } else {
      console.log('Company settings already exist, skipping.');
    }

    // Seed Templates
    const existingTemplates = await sql`SELECT COUNT(*) as count FROM templates`;
    if (parseInt(existingTemplates[0].count, 10) === 0) {
      console.log('Seeding invoice templates...');
      const templates = [
        {
          name: 'Minimal Corporate',
          slug: 'minimal-corporate',
          description: 'Clean black & white design with lots of whitespace and thin dividers. Perfect for modern businesses.',
          is_default: true,
          is_active: true,
        },
        {
          name: 'Premium Executive',
          slug: 'premium-executive',
          description: 'Dark header band with elegant two-column layout. Ideal for high-end service providers.',
          is_default: false,
          is_active: true,
        },
        {
          name: 'Modern Gradient',
          slug: 'modern-gradient',
          description: 'Soft gradient header with modern card-style line items. Contemporary and eye-catching.',
          is_default: false,
          is_active: true,
        },
        {
          name: 'Clean Professional',
          slug: 'clean-professional',
          description: 'Traditional layout with all GST columns visible. Perfect for detailed tax documentation.',
          is_default: false,
          is_active: true,
        },
        {
          name: 'Tax Compliant India GST',
          slug: 'tax-compliant-india-gst',
          description: 'Formal compliance-focused design with full GST breakdown. Meets all regulatory requirements.',
          is_default: false,
          is_active: true,
        },
      ];

      for (const t of templates) {
        await sql`
          INSERT INTO templates (name, slug, description, is_default, is_active, config_json)
          VALUES (${t.name}, ${t.slug}, ${t.description}, ${t.is_default}, ${t.is_active}, '{}'::jsonb)
        `;
      }
      console.log('✓ Invoice templates seeded.');
    } else {
      console.log('Templates already exist, skipping.');
    }

    // Seed default services
    const existingServices = await sql`SELECT COUNT(*) as count FROM services`;
    if (parseInt(existingServices[0].count, 10) === 0) {
      console.log('Seeding default services...');
      const services = [
        {
          name: 'Website Design',
          description: 'Professional website design, UI mockups, layout wireframes, and branding guidelines.',
          default_price: 50000,
          gst_rate: 18,
          hsn_sac_code: '998314',
        },
        {
          name: 'Website Development',
          description: 'Full-stack development, CMS/WordPress integration, performance optimization, and server deployment.',
          default_price: 75000,
          gst_rate: 18,
          hsn_sac_code: '998314',
        },
        {
          name: 'UI/UX Design',
          description: 'Interactive visual prototyping, user journey mapping, design systems creation, and usability testing.',
          default_price: 40000,
          gst_rate: 18,
          hsn_sac_code: '998314',
        },
        {
          name: 'Brand Identity',
          description: 'Logo design, typography guide, color palette, brand book, and stationery design.',
          default_price: 35000,
          gst_rate: 18,
          hsn_sac_code: '998314',
        },
        {
          name: 'Consulting & Strategy',
          description: 'Digital transformation consulting, architecture review, technical roadmap, and growth planning.',
          default_price: 60000,
          gst_rate: 18,
          hsn_sac_code: '998311',
        },
      ];

      for (const s of services) {
        await sql`
          INSERT INTO services (name, description, default_price, gst_rate, hsn_sac_code)
          VALUES (${s.name}, ${s.description}, ${s.default_price}, ${s.gst_rate}, ${s.hsn_sac_code})
        `;
      }
      console.log('✓ Default services seeded.');
    }

    console.log('\n🎉 MODUS database initialized successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Initialization error:', err);
    process.exit(1);
  }
}

run();
