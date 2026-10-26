import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Delta, DeltaIcon, DeltaValue } from "@/components/delta";
import { formatINRk } from "@/utils/format";

export function DashboardStats({ stats }) {
  const monthly = stats?.monthlyRevenue || [];
  const revenueYTD = monthly.reduce((s, m) => s + m.billed, 0);

  const curr = monthly[monthly.length - 1]?.billed ?? 0;
  const prev = monthly[monthly.length - 2]?.billed ?? 0;
  const revDelta = prev > 0 ? ((curr - prev) / prev) * 100 : 0;

  const cards = [
    {
      label: "Revenue YTD",
      value: formatINRk(revenueYTD || stats?.totalTaxable || 0),
      delta: revDelta,
      hint: "vs previous month",
    },
    {
      label: "AR Outstanding",
      value: formatINRk(stats?.arOutstanding || 0),
      hint: `${stats?.totalInvoices || 0} invoices tracked`,
    },
    {
      label: "GST Collected",
      value: formatINRk(stats?.totalGST || 0),
      hint: "CGST + SGST + IGST",
    },
    {
      label: "Payables Due",
      value: formatINRk(stats?.ap?.totalPayable || 0),
      hint: `${stats?.ap?.billsCount || 0} open bills`,
    },
  ];

  return (
    <>
      {cards.map((c) => (
        <StatCard key={c.label} stat={c} />
      ))}
    </>
  );
}

function StatCard({ stat }) {
  const { label, value, delta, hint } = stat;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-normal text-muted-foreground text-xs">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-balance font-semibold text-2xl tabular-nums tracking-tight t-digit-group is-animating">
          {value.split('').map((char, i) => (
            <span key={i} className="t-digit" data-stagger={i % 3 === 0 ? "1" : i % 3 === 1 ? "2" : "0"}>
              {char}
            </span>
          ))}
        </p>
      </CardContent>
      <CardFooter className="gap-1.5 text-xs">
        {delta !== undefined ? (
          <>
            <Delta value={delta} variant="default">
              <DeltaIcon />
              <DeltaValue />
            </Delta>
            <span className="text-pretty text-muted-foreground">{hint}</span>
          </>
        ) : (
          <span className="text-pretty text-muted-foreground">{hint}</span>
        )}
      </CardFooter>
    </Card>
  );
}
