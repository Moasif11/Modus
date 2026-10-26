import sql from "@/app/api/utils/sql";
import argon2 from "argon2";

export async function POST(request) {
  try {
    // Seeding is gated by a shared secret — a wiped DB must not let the first
    // anonymous visitor become superadmin. 403s when SEED_SECRET is unset.
    const body = await request.json().catch(() => ({}));
    if (!process.env.SEED_SECRET || body.secret !== process.env.SEED_SECRET) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if already seeded
    const existingUsers = await sql`SELECT COUNT(*) as count FROM users`;

    if (existingUsers[0].count > 0) {
      return Response.json({ message: "Database already seeded" });
    }

    // Create admin user
    const passwordHash = await argon2.hash("Modus@2026Admin");

    await sql`
      INSERT INTO users (email, password_hash, name, role, must_reset_password)
      VALUES ('admin@modus.local', ${passwordHash}, 'Admin', 'superadmin', true)
    `;

    // Create company settings
    await sql`
      INSERT INTO company_settings (
        legal_name, 
        website, 
        invoice_prefix, 
        next_invoice_number,
        logo_url,
        default_terms,
        default_declaration,
        country
      )
      VALUES (
        'Modus Technologies',
        'modus.local',
        'INV',
        1,
        '',
        'Payment is due within 30 days from the date of invoice. Please make payment to the bank details mentioned above.',
        'We declare that this invoice shows the actual price of the goods/services described and that all particulars are true and correct.',
        'India'
      )
    `;

    // Seed templates
    const templates = [
      {
        name: "Minimal Corporate",
        slug: "minimal-corporate",
        description:
          "Clean black & white design with lots of whitespace and thin dividers. Perfect for modern businesses.",
        is_default: true,
        is_active: true,
      },
      {
        name: "Premium Executive",
        slug: "premium-executive",
        description:
          "Dark header band with elegant two-column layout. Ideal for high-end service providers.",
        is_default: false,
        is_active: true,
      },
      {
        name: "Modern Gradient",
        slug: "modern-gradient",
        description:
          "Soft gradient header with modern card-style line items. Contemporary and eye-catching.",
        is_default: false,
        is_active: true,
      },
      {
        name: "Clean Professional",
        slug: "clean-professional",
        description:
          "Traditional layout with all GST columns visible. Perfect for detailed tax documentation.",
        is_default: false,
        is_active: true,
      },
      {
        name: "Tax Compliant India GST",
        slug: "tax-compliant-india-gst",
        description:
          "Formal compliance-focused design with full GST breakdown. Meets all regulatory requirements.",
        is_default: false,
        is_active: true,
      },
    ];

    for (const template of templates) {
      await sql`
        INSERT INTO templates (name, slug, description, is_default, is_active, config_json)
        VALUES (
          ${template.name},
          ${template.slug},
          ${template.description},
          ${template.is_default},
          ${template.is_active},
          '{}'::jsonb
        )
      `;
    }

    return Response.json({
      message: "Database seeded successfully",
      admin: {
        email: "admin@modus.local",
        password: "Modus@2026Admin",
        note: "Please change password on first login",
      },
    });
  } catch (error) {
    console.error("Seed error:", error);
    return Response.json(
      { error: "Failed to seed database" },
      { status: 500 },
    );
  }
}
