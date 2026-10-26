import { useState, useEffect } from "react";
import AppShell from "@/components/AppShell";
import InvoiceEditor from "@/components/InvoiceEditor";
import { api } from "@/utils/api";

export default function EditProformaPage({ params }) {
  const id = params?.id;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api
      .get(`/api/proforma/${id}`)
      .then((res) => {
        setData({
          invoiceNumber: res.proforma.proformaNumber,
          invoiceDate: res.proforma.proformaDate,
          dueDate: res.proforma.validUntil,
          placeOfSupply: res.proforma.placeOfSupply,
          placeOfSupplyCode: res.proforma.placeOfSupplyCode,
          reverseCharge: res.proforma.reverseCharge,
          templateId: res.proforma.templateId,
          notes: res.proforma.notes,
          terms: res.proforma.terms,
          declaration: res.proforma.declaration,
          paymentMethod: res.proforma.paymentMethod || "bank_transfer",
          servicePeriodFrom: res.proforma.servicePeriodFrom,
          servicePeriodTo: res.proforma.servicePeriodTo,
          gstCategory: res.proforma.gstCategory || "B2B",
          projectId: res.proforma.projectId || "",
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
        docType="proforma"
        invoiceId={id}
        initialData={data}
        backHref={`/proforma/${id}`}
      />
    </AppShell>
  );
}
