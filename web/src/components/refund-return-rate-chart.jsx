import { Link } from "react-router";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRightIcon, AlertCircleIcon } from "lucide-react";
import { formatINRk } from "@/utils/format";

export function RefundReturnRateChart({ ap = {} }) {
  const { totalPayable = 0, overduePayable = 0, paidThisMonth = 0 } = ap;
  const overdueRatio = totalPayable > 0 ? (overduePayable / totalPayable) * 100 : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <CardTitle>Payables</CardTitle>
          <p className="text-muted-foreground text-xs mt-1">AP summary</p>
        </div>
        {overduePayable > 0 && (
          <span className="flex items-center gap-1 text-rose-500 text-xs font-medium">
            <AlertCircleIcon className="size-3" />
            Overdue
          </span>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <StatRow label="Total payable" value={formatINRk(totalPayable)} color="text-foreground" />
        <StatRow
          label="Overdue"
          value={formatINRk(overduePayable)}
          color={overduePayable > 0 ? "text-rose-500" : "text-foreground"}
          sub={overdueRatio > 0 ? `${overdueRatio.toFixed(0)}% of total` : undefined}
        />
        <StatRow label="Paid this month" value={formatINRk(paidThisMonth)} color="text-emerald-600" />
        <Button asChild className="text-muted-foreground mt-2 w-full" size="sm" variant="outline">
          <Link to="/payables">
            View payables
            <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function StatRow({ label, value, color = "text-foreground", sub }) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <p className="text-muted-foreground text-xs">{label}</p>
        {sub && <p className="text-muted-foreground text-[10px]">{sub}</p>}
      </div>
      <p className={`font-semibold tabular-nums text-sm ${color}`}>{value}</p>
    </div>
  );
}
