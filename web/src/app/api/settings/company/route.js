import sql from "@/app/api/utils/sql";
import { requireAuth, requireSuperAdmin, logAudit, handleRouteError } from "@/app/api/utils/auth";
import { isValidGstin } from "@/app/api/utils/gstValidation";

// Masks an API key for safe display: shows first 6 and last 4 chars, rest as bullets.
function maskKey(key) {
  if (!key) return null;
  const str = String(key);
  if (str.length <= 10) return "••••••••••";
  return str.slice(0, 6) + "••••••••" + str.slice(-4);
}

// Self-healing schema — must run before BOTH read and write (a fresh DB may be
// written via PUT before any GET ever ran).
async function ensureCompanySettingsColumns() {
  await sql`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS logo_dark_url TEXT`.catch(() => {});
  await sql`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS quote_prefix VARCHAR DEFAULT 'QT'`.catch(() => {});
  await sql`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS next_quote_number INTEGER DEFAULT 1`.catch(() => {});
  await sql`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS proforma_prefix VARCHAR DEFAULT 'PI'`.catch(() => {});
  await sql`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS next_proforma_number INTEGER DEFAULT 1`.catch(() => {});
  await sql`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS invoice_format VARCHAR DEFAULT 'fy'`.catch(() => {});
  await sql`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS registered_name VARCHAR`.catch(() => {});
  await sql`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS notification_prefs JSONB`.catch(() => {});
  await sql`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS lut_number VARCHAR`.catch(() => {});
  await sql`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS turnover_above_5cr BOOLEAN DEFAULT false`.catch(() => {});
  await sql`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS einvoice_applicable_from DATE`.catch(() => {});
  await sql`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS self_invoice_prefix VARCHAR DEFAULT 'SI'`.catch(() => {});
  await sql`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS next_self_invoice_number INTEGER DEFAULT 1`.catch(() => {});
  await sql`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS credit_note_prefix VARCHAR DEFAULT 'CN'`.catch(() => {});
  await sql`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS next_credit_note_number INTEGER DEFAULT 1`.catch(() => {});
  await sql`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS books_locked_until DATE`.catch(() => {});
  await sql`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS openrouter_api_key VARCHAR`.catch(() => {});
  await sql`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS openrouter_model VARCHAR DEFAULT 'google/gemini-2.5-flash'`.catch(() => {});
  await sql`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS nvidia_api_key VARCHAR`.catch(() => {});
  await sql`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS nvidia_model VARCHAR DEFAULT 'meta/llama-3.1-405b-instruct'`.catch(() => {});
  await sql`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS unstructured_api_key VARCHAR`.catch(() => {});
}

export async function GET(request) {
  try {
    const user = await requireAuth(request);
    const isSuperadmin = user.role === "superadmin";

    await ensureCompanySettingsColumns();

    const settings = await sql`
      SELECT * FROM company_settings LIMIT 1
    `;

    if (settings.length === 0) {
      return Response.json(
        { error: "Company settings not found" },
        { status: 404 },
      );
    }

    const s = settings[0];

    return Response.json({
      id: s.id,
      legalName: s.legal_name,
      registeredName: s.registered_name,
      notificationPrefs: s.notification_prefs || null,
      gstin: s.gstin,
      pan: s.pan,
      addressLine1: s.address_line1,
      addressLine2: s.address_line2,
      city: s.city,
      state: s.state,
      stateCode: s.state_code,
      pincode: s.pincode,
      country: s.country,
      phone: s.phone,
      email: s.email,
      website: s.website,
      bankName: s.bank_name,
      accountNumber: s.account_number,
      ifsc: s.ifsc,
      accountHolderName: s.account_holder_name,
      upiId: s.upi_id,
      upiQrUrl: s.upi_qr_url,
      logoUrl: s.logo_url,
      logoDarkUrl: s.logo_dark_url,
      signatureUrl: s.signature_url,
      stampUrl: s.stamp_url,
      defaultTerms: s.default_terms,
      defaultNotes: s.default_notes,
      defaultDeclaration: s.default_declaration,
      invoicePrefix: s.invoice_prefix,
      invoiceFormat: s.invoice_format || "fy",
      nextInvoiceNumber: s.next_invoice_number,
      quotePrefix: s.quote_prefix,
      nextQuoteNumber: s.next_quote_number,
      proformaPrefix: s.proforma_prefix || "PI",
      nextProformaNumber: s.next_proforma_number,
      lutNumber: s.lut_number || null,
      turnoverAbove5cr: !!s.turnover_above_5cr,
      einvoiceApplicableFrom: s.einvoice_applicable_from || null,
      selfInvoicePrefix: s.self_invoice_prefix || "SI",
      nextSelfInvoiceNumber: s.next_self_invoice_number || 1,
      creditNotePrefix: s.credit_note_prefix || "CN",
      nextCreditNoteNumber: s.next_credit_note_number || 1,
      booksLockedUntil: s.books_locked_until || null,
      
      // Return MASKED API keys ONLY to superadmins — raw keys never leave the server
      ...(isSuperadmin ? {
        openrouterApiKeyMasked: maskKey(s.openrouter_api_key),
        openrouterApiKeySet: !!s.openrouter_api_key,
        openrouterModel: s.openrouter_model,
        nvidiaApiKeyMasked: maskKey(s.nvidia_api_key),
        nvidiaApiKeySet: !!s.nvidia_api_key,
        nvidiaModel: s.nvidia_model,
        unstructuredApiKeyMasked: maskKey(s.unstructured_api_key),
        unstructuredApiKeySet: !!s.unstructured_api_key,
      } : {}),

      updatedAt: s.updated_at,
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Get company settings error:", error);
    return Response.json(
      { error: "Failed to get company settings" },
      { status: 500 },
    );
  }
}

export async function PUT(request) {
  try {
    // Only the superadmin may change company details. Team members cannot edit.
    const user = await requireSuperAdmin(request);
    await ensureCompanySettingsColumns();
    const body = await request.json();

    const {
      legalName,
      registeredName,
      notificationPrefs,
      gstin,
      pan,
      addressLine1,
      addressLine2,
      city,
      state,
      stateCode,
      pincode,
      country,
      phone,
      email,
      website,
      bankName,
      accountNumber,
      ifsc,
      accountHolderName,
      upiId,
      upiQrUrl,
      logoUrl,
      logoDarkUrl,
      signatureUrl,
      stampUrl,
      defaultTerms,
      defaultNotes,
      defaultDeclaration,
      invoicePrefix,
      invoiceFormat,
      quotePrefix,
      proformaPrefix,
      lutNumber,
      turnoverAbove5cr,
      einvoiceApplicableFrom,
      selfInvoicePrefix,
      creditNotePrefix,
      booksLockedUntil,
      openrouterApiKey,
      openrouterModel,
      nvidiaApiKey,
      nvidiaModel,
      unstructuredApiKey,
    } = body;

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (legalName !== undefined) {
      updates.push(`legal_name = $${paramIndex++}`);
      values.push(legalName);
    }
    if (registeredName !== undefined) {
      updates.push(`registered_name = $${paramIndex++}`);
      values.push(registeredName);
    }
    if (notificationPrefs !== undefined) {
      updates.push(`notification_prefs = $${paramIndex++}`);
      values.push(JSON.stringify(notificationPrefs));
    }
    if (gstin !== undefined) {
      if (gstin && !isValidGstin(gstin)) {
        return Response.json({ error: "Invalid company GSTIN — failed format/checksum validation" }, { status: 400 });
      }
      updates.push(`gstin = $${paramIndex++}`);
      values.push(gstin);
    }
    if (pan !== undefined) {
      updates.push(`pan = $${paramIndex++}`);
      values.push(pan);
    }
    if (addressLine1 !== undefined) {
      updates.push(`address_line1 = $${paramIndex++}`);
      values.push(addressLine1);
    }
    if (addressLine2 !== undefined) {
      updates.push(`address_line2 = $${paramIndex++}`);
      values.push(addressLine2);
    }
    if (city !== undefined) {
      updates.push(`city = $${paramIndex++}`);
      values.push(city);
    }
    if (state !== undefined) {
      updates.push(`state = $${paramIndex++}`);
      values.push(state);
    }
    if (stateCode !== undefined) {
      updates.push(`state_code = $${paramIndex++}`);
      values.push(stateCode);
    }
    if (pincode !== undefined) {
      updates.push(`pincode = $${paramIndex++}`);
      values.push(pincode);
    }
    if (country !== undefined) {
      updates.push(`country = $${paramIndex++}`);
      values.push(country);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      values.push(phone);
    }
    if (email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      values.push(email);
    }
    if (website !== undefined) {
      updates.push(`website = $${paramIndex++}`);
      values.push(website);
    }
    if (bankName !== undefined) {
      updates.push(`bank_name = $${paramIndex++}`);
      values.push(bankName);
    }
    if (accountNumber !== undefined) {
      updates.push(`account_number = $${paramIndex++}`);
      values.push(accountNumber);
    }
    if (ifsc !== undefined) {
      updates.push(`ifsc = $${paramIndex++}`);
      values.push(ifsc);
    }
    if (accountHolderName !== undefined) {
      updates.push(`account_holder_name = $${paramIndex++}`);
      values.push(accountHolderName);
    }
    if (upiId !== undefined) {
      updates.push(`upi_id = $${paramIndex++}`);
      values.push(upiId);
    }
    if (upiQrUrl !== undefined) {
      updates.push(`upi_qr_url = $${paramIndex++}`);
      values.push(upiQrUrl);
    }
    if (logoUrl !== undefined) {
      updates.push(`logo_url = $${paramIndex++}`);
      values.push(logoUrl);
    }
    if (logoDarkUrl !== undefined) {
      updates.push(`logo_dark_url = $${paramIndex++}`);
      values.push(logoDarkUrl);
    }
    if (signatureUrl !== undefined) {
      updates.push(`signature_url = $${paramIndex++}`);
      values.push(signatureUrl);
    }
    if (stampUrl !== undefined) {
      updates.push(`stamp_url = $${paramIndex++}`);
      values.push(stampUrl);
    }
    if (defaultTerms !== undefined) {
      updates.push(`default_terms = $${paramIndex++}`);
      values.push(defaultTerms);
    }
    if (defaultNotes !== undefined) {
      updates.push(`default_notes = $${paramIndex++}`);
      values.push(defaultNotes);
    }
    if (defaultDeclaration !== undefined) {
      updates.push(`default_declaration = $${paramIndex++}`);
      values.push(defaultDeclaration);
    }
    if (invoicePrefix !== undefined) {
      updates.push(`invoice_prefix = $${paramIndex++}`);
      values.push(invoicePrefix);
    }
    if (invoiceFormat !== undefined) {
      updates.push(`invoice_format = $${paramIndex++}`);
      values.push(invoiceFormat);
    }
    if (quotePrefix !== undefined) {
      updates.push(`quote_prefix = $${paramIndex++}`);
      values.push(quotePrefix);
    }
    if (proformaPrefix !== undefined) {
      updates.push(`proforma_prefix = $${paramIndex++}`);
      values.push(proformaPrefix);
    }
    if (lutNumber !== undefined) {
      updates.push(`lut_number = $${paramIndex++}`);
      values.push(lutNumber);
    }
    if (turnoverAbove5cr !== undefined) {
      updates.push(`turnover_above_5cr = $${paramIndex++}`);
      values.push(turnoverAbove5cr);
    }
    if (einvoiceApplicableFrom !== undefined) {
      updates.push(`einvoice_applicable_from = $${paramIndex++}`);
      values.push(einvoiceApplicableFrom);
    }
    if (selfInvoicePrefix !== undefined) {
      updates.push(`self_invoice_prefix = $${paramIndex++}`);
      values.push(selfInvoicePrefix);
    }
    if (creditNotePrefix !== undefined) {
      updates.push(`credit_note_prefix = $${paramIndex++}`);
      values.push(creditNotePrefix);
    }
    if (booksLockedUntil !== undefined) {
      updates.push(`books_locked_until = $${paramIndex++}`);
      values.push(booksLockedUntil || null);
    }
    if (openrouterApiKey !== undefined && openrouterApiKey !== "") {
      // Validate the key by making a minimal API call
      const orModel = openrouterModel || (await sql`SELECT openrouter_model FROM company_settings LIMIT 1`)[0]?.openrouter_model || "google/gemini-2.5-flash";
      try {
        const testRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${openrouterApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: orModel, messages: [{ role: "user", content: "hi" }], max_tokens: 1 }),
          signal: AbortSignal.timeout(10000),
        });
        if (testRes.status === 401) throw new Error("OpenRouter API key is invalid or unauthorized.");
        if (testRes.status === 404) throw new Error(`OpenRouter model '${orModel}' was not found. Please check the model name.`);
      } catch (err) {
        if (err.message.startsWith("OpenRouter")) throw err;
        // Network errors are not treated as key failures
      }
      updates.push(`openrouter_api_key = $${paramIndex++}`);
      values.push(openrouterApiKey);
    }
    if (openrouterModel !== undefined) {
      updates.push(`openrouter_model = $${paramIndex++}`);
      values.push(openrouterModel);
    }
    if (nvidiaApiKey !== undefined && nvidiaApiKey !== "") {
      // Validate the key by making a minimal API call
      const nvModel = nvidiaModel || (await sql`SELECT nvidia_model FROM company_settings LIMIT 1`)[0]?.nvidia_model || "meta/llama-3.1-70b-instruct";
      try {
        const testRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${nvidiaApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: nvModel, messages: [{ role: "user", content: "hi" }], max_tokens: 1 }),
          signal: AbortSignal.timeout(10000),
        });
        if (testRes.status === 401) throw new Error("NVIDIA API key is invalid or unauthorized.");
        if (testRes.status === 404) throw new Error(`NVIDIA model '${nvModel}' was not found. Please check the model name.`);
      } catch (err) {
        if (err.message.startsWith("NVIDIA")) throw err;
      }
      updates.push(`nvidia_api_key = $${paramIndex++}`);
      values.push(nvidiaApiKey);
    }
    if (nvidiaModel !== undefined) {
      updates.push(`nvidia_model = $${paramIndex++}`);
      values.push(nvidiaModel);
    }
    if (unstructuredApiKey !== undefined && unstructuredApiKey !== "") {
      // Validate by making a lightweight HEAD-equivalent check
      try {
        const testRes = await fetch("https://api.unstructuredapp.io/general/v0/general", {
          method: "POST",
          headers: { "unstructured-api-key": unstructuredApiKey },
          body: new FormData(), // empty form — will 422 on valid key, 401 on invalid
          signal: AbortSignal.timeout(10000),
        });
        if (testRes.status === 401 || testRes.status === 403) throw new Error("Unstructured API key is invalid or unauthorized.");
      } catch (err) {
        if (err.message.startsWith("Unstructured")) throw err;
      }
      updates.push(`unstructured_api_key = $${paramIndex++}`);
      values.push(unstructuredApiKey);
    }

    updates.push(`updated_at = NOW()`);

    if (updates.length === 1) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }

    const query = `UPDATE company_settings SET ${updates.join(", ")} WHERE id = 1 RETURNING *`;
    const result = await sql(query, values);

    // Log audit — never persist raw API keys in audit metadata
    const auditMetadata = { ...body };
    for (const k of ["openrouterApiKey", "nvidiaApiKey", "unstructuredApiKey"]) {
      if (auditMetadata[k] !== undefined) auditMetadata[k] = "[REDACTED]";
    }
    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "company_settings",
      entityId: 1,
      metadata: auditMetadata,
      request,
    });

    const s = result[0];

    return Response.json({
      id: s.id,
      legalName: s.legal_name,
      registeredName: s.registered_name,
      notificationPrefs: s.notification_prefs || null,
      gstin: s.gstin,
      pan: s.pan,
      addressLine1: s.address_line1,
      addressLine2: s.address_line2,
      city: s.city,
      state: s.state,
      stateCode: s.state_code,
      pincode: s.pincode,
      country: s.country,
      phone: s.phone,
      email: s.email,
      website: s.website,
      bankName: s.bank_name,
      accountNumber: s.account_number,
      ifsc: s.ifsc,
      accountHolderName: s.account_holder_name,
      upiId: s.upi_id,
      upiQrUrl: s.upi_qr_url,
      logoUrl: s.logo_url,
      logoDarkUrl: s.logo_dark_url,
      signatureUrl: s.signature_url,
      stampUrl: s.stamp_url,
      defaultTerms: s.default_terms,
      defaultNotes: s.default_notes,
      defaultDeclaration: s.default_declaration,
      invoicePrefix: s.invoice_prefix,
      invoiceFormat: s.invoice_format || "fy",
      nextInvoiceNumber: s.next_invoice_number,
      quotePrefix: s.quote_prefix,
      nextQuoteNumber: s.next_quote_number,
      proformaPrefix: s.proforma_prefix || "PI",
      nextProformaNumber: s.next_proforma_number,
      lutNumber: s.lut_number || null,
      turnoverAbove5cr: !!s.turnover_above_5cr,
      einvoiceApplicableFrom: s.einvoice_applicable_from || null,
      selfInvoicePrefix: s.self_invoice_prefix || "SI",
      nextSelfInvoiceNumber: s.next_self_invoice_number || 1,
      creditNotePrefix: s.credit_note_prefix || "CN",
      nextCreditNoteNumber: s.next_credit_note_number || 1,
      booksLockedUntil: s.books_locked_until || null,
      // Raw keys never leave the server — return masked display values only
      openrouterApiKeyMasked: maskKey(s.openrouter_api_key),
      openrouterApiKeySet: !!s.openrouter_api_key,
      openrouterModel: s.openrouter_model,
      nvidiaApiKeyMasked: maskKey(s.nvidia_api_key),
      nvidiaApiKeySet: !!s.nvidia_api_key,
      nvidiaModel: s.nvidia_model,
      unstructuredApiKeyMasked: maskKey(s.unstructured_api_key),
      unstructuredApiKeySet: !!s.unstructured_api_key,
      updatedAt: s.updated_at,
    });
  } catch (error) {
    const handled = handleRouteError(error);
    if (handled) return handled;
    // API key validation failures → 400 with the specific reason
    if (/^(OpenRouter|NVIDIA|Unstructured)/.test(error.message || "")) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error("Update company settings error:", error);
    return Response.json(
      { error: "Failed to update company settings" },
      { status: 500 },
    );
  }
}
