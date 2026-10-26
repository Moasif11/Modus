import { requireAuth } from "@/app/api/utils/auth";
import sql from "@/app/api/utils/sql";

export async function POST(request) {
  try {
    // 1. Authenticate user
    await requireAuth(request);

    // 2. Parse FormData
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    // Fetch settings
    const settings = await sql`SELECT * FROM company_settings LIMIT 1`;
    const s = settings[0] || {};

    // 3. Unstructured.io Text Extraction
    console.log("📄 Extracting receipt text via Unstructured.io...");
    const unstructuredKey = s.unstructured_api_key || process.env.UNSTRUCTURED_API_KEY;
    const unstructuredUrl = process.env.UNSTRUCTURED_API_URL || "https://api.unstructuredapp.io/general/v0/general";

    if (!unstructuredKey) {
      throw new Error("UNSTRUCTURED_API_KEY is not defined in environment variables.");
    }

    const unstructuredFormData = new FormData();
    unstructuredFormData.append("files", file);

    const unstructuredResponse = await fetch(unstructuredUrl, {
      method: "POST",
      headers: {
        "unstructured-api-key": unstructuredKey,
      },
      body: unstructuredFormData,
    });

    if (!unstructuredResponse.ok) {
      const errorText = await unstructuredResponse.text();
      throw new Error(`Unstructured.io returned status ${unstructuredResponse.status}: ${errorText}`);
    }

    const elements = await unstructuredResponse.json();
    if (!Array.isArray(elements)) {
      throw new Error("Invalid response from Unstructured.io. Expected an array.");
    }

    // Combine extracted text elements
    const receiptText = elements
      .map((el) => el.text)
      .filter(Boolean)
      .join("\n");

    if (!receiptText.trim()) {
      throw new Error("No text content could be extracted from the receipt/bill document.");
    }

    console.log(`✅ Text successfully extracted! (${receiptText.length} characters)`);

    // 4. Structure data using LLMs (Nvidia NIM with fallback to OpenRouter)
    const systemPrompt = `You are a precise finance assistant. Your task is to extract billing details from the provided invoice, receipt, or bill text.
Output ONLY a single, valid JSON object matching the exact schema below. Do NOT write any conversational preambles, explanations, markdown formatting (like \`\`\`json), or extra text.

JSON Schema:
{
  "title": "Vendor/Company Name or description of purchase (required, string)",
  "category": "Strictly map to one of these slugs: 'travel', 'petrol', 'marketing', 'software', 'salary', 'freelancer', 'freelancer_payout', 'subscription', 'utility', 'equipment', 'internet', 'food', 'other' (required, string)",
  "amount": "Total amount due (number, numeric, required)",
  "tax": "Total tax / GST amount if mentioned (number, numeric, default 0)",
  "billDate": "Date the bill was issued in YYYY-MM-DD format (string, or today's date if not found)",
  "dueDate": "Due date in YYYY-MM-DD format (string, or null if not found)",
  "referenceNumber": "Invoice number, receipt ID, reference or UTR # if present (string, or null)",
  "notes": "Brief summary of the items purchased or general description (string, or null)"
}

Example response:
{
  "title": "Amazon Web Services",
  "category": "software",
  "amount": 12500.50,
  "tax": 2250.00,
  "billDate": "2026-05-10",
  "dueDate": "2026-06-10",
  "referenceNumber": "INV-897123",
  "notes": "Monthly cloud hosting fee and data transfer charge."
}`;

    let parsedResult = null;
    let successProvider = "";

    // ── TRY NVIDIA NIM API ───────────────────────────────────────────────────
    const nvidiaKey = s.nvidia_api_key || process.env.NVIDIA_API_KEY;
    const nvidiaModel = s.nvidia_model || process.env.NVIDIA_LLM_MODEL || "meta/llama-3.1-70b-instruct";

    if (nvidiaKey) {
      try {
        console.log(`🤖 Attempting receipt parsing via Nvidia NIM API (${nvidiaModel})...`);
        const nvidiaResponse = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${nvidiaKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: nvidiaModel,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: receiptText },
            ],
            temperature: 0.1,
            max_tokens: 1024,
          }),
        });

        if (nvidiaResponse.ok) {
          const resJson = await nvidiaResponse.json();
          const rawContent = resJson.choices?.[0]?.message?.content;
          parsedResult = cleanAndParseJSON(rawContent);
          successProvider = "Nvidia NIM";
          console.log("🎉 Nvidia NIM parsed successfully!");
        } else {
          console.warn(`⚠️ Nvidia NIM failed with status ${nvidiaResponse.status}`);
        }
      } catch (err) {
        console.warn("⚠️ Nvidia NIM threw an error:", err.message);
      }
    }

    // ── FALLBACK TO OPENROUTER API ──────────────────────────────────────────
    if (!parsedResult) {
      const openRouterKey = s.openrouter_api_key || process.env.OPENROUTER_API_KEY;
      if (openRouterKey) {
        const fallbackModels = [
          s.openrouter_model || "google/gemini-2.5-flash",
          "meta-llama/llama-3-8b-instruct:free",
        ];

        for (const model of fallbackModels) {
          try {
            console.log(`🤖 Attempting OpenRouter Fallback API (${model})...`);
            const orResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${openRouterKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:4000",
                "X-Title": "MODUS ERP",
              },
              body: JSON.stringify({
                model: model,
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: receiptText },
                ],
                temperature: 0.1,
                max_tokens: 1024,
              }),
            });

            if (orResponse.ok) {
              const resJson = await orResponse.json();
              const rawContent = resJson.choices?.[0]?.message?.content;
              parsedResult = cleanAndParseJSON(rawContent);
              successProvider = `OpenRouter (${model})`;
              console.log(`🎉 OpenRouter (${model}) parsed successfully!`);
              break;
            } else {
              console.warn(`⚠️ OpenRouter (${model}) failed with status ${orResponse.status}`);
            }
          } catch (err) {
            console.warn(`⚠️ OpenRouter (${model}) threw an error:`, err.message);
          }
        }
      }
    }

    // 5. If everything failed, throw
    if (!parsedResult) {
      throw new Error("Both Nvidia NIM and OpenRouter models failed to extract data from document.");
    }

    return Response.json({
      success: true,
      provider: successProvider,
      bill: parsedResult,
    });

  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Receipt parsing error:", error);
    return Response.json({ error: "Parsing failed: " + error.message }, { status: 500 });
  }
}

/**
 * Bulletproof helper to parse JSON content and sanitize Markdown blocks
 */
function cleanAndParseJSON(raw) {
  if (!raw) return null;
  let content = raw.trim();

  // Strip standard markdown blocks
  if (content.startsWith("```json")) {
    content = content.substring(7);
  } else if (content.startsWith("```")) {
    content = content.substring(3);
  }
  if (content.endsWith("```")) {
    content = content.substring(0, content.length - 3);
  }
  content = content.trim();

  try {
    return JSON.parse(content);
  } catch (err) {
    console.error("Failed to parse cleaned LLM response:", content);
    throw new Error("LLM did not return a valid JSON object matching the requested schema.");
  }
}
