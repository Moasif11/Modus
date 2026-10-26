import { useState, useEffect } from "react";
import AppShell from "@/components/AppShell";
import InvoiceEditor from "@/components/InvoiceEditor";
import { api } from "@/utils/api";

export default function EditInvoicePage({ params }) {
  const id = params?.id;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api
      .get(`/api/invoices/${id}`)
      .then((res) => {
        setData({
          invoiceNumber: res.invoice.invoiceNumber,
          invoiceDate: res.invoice.invoiceDate,
          dueDate: res.invoice.dueDate,
          poNumber: res.invoice.poNumber,
          paymentTerms: res.invoice.paymentTerms,
          placeOfSupply: res.invoice.placeOfSupply,
          placeOfSupplyCode: res.invoice.placeOfSupplyCode,
          reverseCharge: res.invoice.reverseCharge,
          templateId: res.invoice.templateId,
          notes: res.invoice.notes,
          terms: res.invoice.terms,
          declaration: res.invoice.declaration,
          paymentMethod: res.invoice.paymentMethod || "bank_transfer",
          servicePeriodFrom: res.invoice.servicePeriodFrom,
          servicePeriodTo: res.invoice.servicePeriodTo,
          gstCategory: res.invoice.gstCategory || "B2B",
          projectId: res.invoice.projectId || "",
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
        invoiceId={id}
        initialData={data}
        backHref={`/invoices/${id}`}
      />
    </AppShell>
  );
}
