import AppShell from "@/components/AppShell";
import InvoiceEditor from "@/components/InvoiceEditor";

export default function NewProformaPage() {
  return (
    <AppShell>
      <InvoiceEditor mode="new" docType="proforma" backHref="/proforma" />
    </AppShell>
  );
}
