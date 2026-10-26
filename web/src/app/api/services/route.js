import sql from "@/app/api/utils/sql";
import { requireAuth, logAudit } from "@/app/api/utils/auth";

async function ensureServicesTable() {
  try {
    // 1. Create table if not exists
    await sql`
      CREATE TABLE IF NOT EXISTS services (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        default_price NUMERIC NOT NULL DEFAULT 0,
        gst_rate NUMERIC NOT NULL DEFAULT 18,
        hsn_sac_code TEXT DEFAULT '9983',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // 2. Check if table is empty
    const counts = await sql`SELECT COUNT(*) as count FROM services`;
    const count = parseInt(counts[0].count);

    if (count === 0) {
      // 3. Seed default digital agency services with correct specific SAC codes
      const defaults = [
        {
          name: "Website Design",
          description: "Professional website design, UI mockups, layout wireframes, and branding guidelines.",
          default_price: 50000,
          gst_rate: 18,
          hsn_sac_code: "998314"
        },
        {
          name: "Website Development",
          description: "Full-stack development, CMS/WordPress integration, performance optimization, and server deployment.",
          default_price: 75000,
          gst_rate: 18,
          hsn_sac_code: "998314"
        },
        {
          name: "UI/UX Design",
          description: "Interactive visual prototyping, user journey mapping, design systems creation, and usability testing.",
          default_price: 40000,
          gst_rate: 18,
          hsn_sac_code: "998314"
        },
        {
          name: "Branding",
          description: "Corporate logo design, visual brand identity guidelines, typography palettes, and brand assets creation.",
          default_price: 30000,
          gst_rate: 18,
          hsn_sac_code: "998314"
        },
        {
          name: "SEO",
          description: "Comprehensive SEO audit, keyword research, on-page optimization, backlink building, and monthly search rankings.",
          default_price: 20000,
          gst_rate: 18,
          hsn_sac_code: "998314"
        },
        {
          name: "Social Media Management",
          description: "Monthly content calendar planning, custom creative designs, captions writing, community engagement, and analytics reporting.",
          default_price: 25000,
          gst_rate: 18,
          hsn_sac_code: "998314"
        },
        {
          name: "Ad Campaign Management",
          description: "Setup and optimization of Meta/Google/LinkedIn Ads campaigns, budget management, conversion tracking, and monthly ROI reports.",
          default_price: 30000,
          gst_rate: 18,
          hsn_sac_code: "998361"
        },
        {
          name: "Video Editing",
          description: "High-quality video editing, color grading, sound design, transitions, typography overlays, and platform-specific formats.",
          default_price: 15000,
          gst_rate: 18,
          hsn_sac_code: "999613"
        },
        {
          name: "Content Creation",
          description: "SEO blog post writing, newsletters drafting, custom digital graphics creation, and content marketing strategy.",
          default_price: 15000,
          gst_rate: 18,
          hsn_sac_code: "998314"
        },
        {
          name: "Hosting & Maintenance",
          description: "Premium cloud hosting fee, monthly backups, standard plugin/theme updates, and security monitoring.",
          default_price: 5000,
          gst_rate: 18,
          hsn_sac_code: "998315"
        },
        {
          name: "Consulting",
          description: "Strategic consulting hourly rate covering tech stack selection, digital transformation roadmap, and business growth advice.",
          default_price: 10000,
          gst_rate: 18,
          hsn_sac_code: "998311"
        }
      ];

      for (const svc of defaults) {
        await sql`
          INSERT INTO services (name, description, default_price, gst_rate, hsn_sac_code)
          VALUES (${svc.name}, ${svc.description}, ${svc.default_price}, ${svc.gst_rate}, ${svc.hsn_sac_code})
          ON CONFLICT (name) DO NOTHING
        `;
      }
    }
  } catch (error) {
    console.error("Error checking/seeding services table:", error);
  }
}

export async function GET(request) {
  try {
    await requireAuth(request);

    // Auto-migration check
    await ensureServicesTable();

    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    
    let services;
    if (search) {
      services = await sql`
        SELECT * FROM services
        WHERE LOWER(name) LIKE LOWER(${"%" + search + "%"})
           OR LOWER(description) LIKE LOWER(${"%" + search + "%"})
        ORDER BY name ASC
      `;
    } else {
      services = await sql`
        SELECT * FROM services
        ORDER BY name ASC
      `;
    }

    return Response.json({
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        defaultPrice: parseFloat(s.default_price),
        gstRate: parseFloat(s.gst_rate),
        hsnSacCode: s.hsn_sac_code,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
      }))
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Get services error:", error);
    return Response.json(
      { error: "Failed to get services" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    const {
      name,
      description,
      defaultPrice,
      gstRate,
      hsnSacCode,
    } = body;

    if (!name) {
      return Response.json({ error: "Name is required" }, { status: 400 });
    }

    await ensureServicesTable();

    const result = await sql`
      INSERT INTO services (name, description, default_price, gst_rate, hsn_sac_code)
      VALUES (${name}, ${description || null}, ${defaultPrice || 0}, ${gstRate || 18}, ${hsnSacCode || "9983"})
      RETURNING *
    `;

    const service = result[0];

    // Log audit
    await logAudit({
      userId: user.id,
      action: "create",
      entityType: "service",
      entityId: service.id,
      metadata: { name: service.name },
      request,
    });

    return Response.json({
      id: service.id,
      name: service.name,
      description: service.description,
      defaultPrice: parseFloat(service.default_price),
      gstRate: parseFloat(service.gst_rate),
      hsnSacCode: service.hsn_sac_code,
      createdAt: service.created_at,
      updatedAt: service.updated_at,
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Create service error:", error);
    return Response.json(
      { error: "Failed to create service" },
      { status: 500 },
    );
  }
}
