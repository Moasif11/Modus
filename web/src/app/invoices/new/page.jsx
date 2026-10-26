import AppShell from "@/components/AppShell";
import InvoiceEditor from "@/components/InvoiceEditor";

export default function NewInvoicePage() {
  return (
    <AppShell>
      <InvoiceEditor mode="new" backHref="/invoices" />
    </AppShell>
  );
}
