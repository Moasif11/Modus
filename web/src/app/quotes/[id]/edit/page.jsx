import { useState, useEffect } from "react";
import AppShell from "@/components/AppShell";
import InvoiceEditor from "@/components/InvoiceEditor";
import { api } from "@/utils/api";

export default function EditQuotePage({ params }) {
  const id = params?.id;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api
      .get(`/api/quotes/${id}`)
      .then((res) => {
        setData({
          invoiceNumber: res.quote.quoteNumber,
          invoiceDate: res.quote.quoteDate,
          dueDate: res.quote.validUntil,
          placeOfSupply: res.quote.placeOfSupply,
          placeOfSupplyCode: res.quote.placeOfSupplyCode,
          reverseCharge: res.quote.reverseCharge,
          templateId: res.quote.templateId,
          notes: res.quote.notes,
          terms: res.quote.terms,
          declaration: res.quote.declaration,
          paymentMethod: res.quote.paymentMethod || "bank_transfer",
          servicePeriodFrom: res.quote.servicePeriodFrom,
          servicePeriodTo: res.quote.servicePeriodTo,
          gstCategory: res.quote.gstCategory || "B2B",
          projectId: res.quote.projectId || "",
          customer: res.customer,
          items: res.items.map((it) => ({
            itemName: it.itemName,
            description: it.description || "",
            hsnSacCode: it.hsnSacCode || "",
            quantity: it.quantity,
            unit: it.unit || "Hrs",
            unitPrice: it.unitPrice,
            discountPercent: it.discountPercent || 0,
            gstRate: it.gstRate,
          })),
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading)
    return (
      <AppShell>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              border: "3px solid #E11D2C",
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "spin 0.7s linear infinite",
            }}
          />
        </div>
      </AppShell>
    );

  return (
    <AppShell>
      <InvoiceEditor
        mode="edit"
        docType="quote"
        invoiceId={id}
        initialData={data}
        backHref={`/quotes/${id}`}
      />
    </AppShell>
  );
}
