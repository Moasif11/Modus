import AppShell from "@/components/AppShell";
import InvoiceEditor from "@/components/InvoiceEditor";

export default function NewQuotePage() {
  return (
    <AppShell>
      <InvoiceEditor mode="new" docType="quote" backHref="/quotes" />
    </AppShell>
  );
}
