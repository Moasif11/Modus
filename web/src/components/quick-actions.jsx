import { Link } from "react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import {
  FilePlusIcon,
  ReceiptIcon,
  BarChart2Icon,
  UsersIcon,
  ChevronRightIcon,
} from "lucide-react";

const actions = [
  {
    title: "New invoice",
    description: "Create and send an invoice",
    to: "/invoices/new",
    icon: <FilePlusIcon aria-hidden="true" />,
  },
  {
    title: "New payable",
    description: "Record a bill or expense",
    to: "/payables",
    icon: <ReceiptIcon aria-hidden="true" />,
  },
  {
    title: "GST reports",
    description: "GSTR-1, GSTR-3B, HSN",
    to: "/reports",
    icon: <BarChart2Icon aria-hidden="true" />,
  },
  {
    title: "Customers",
    description: "Manage client directory",
    to: "/customers",
    icon: <UsersIcon aria-hidden="true" />,
  },
];

export function QuickActions({ className }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Quick actions</CardTitle>
        <CardDescription>Shortcuts to common tasks</CardDescription>
      </CardHeader>
      <CardContent>
        <ItemGroup className="gap-0">
          {actions.map((a) => (
            <Item asChild key={a.title} size="sm">
              <Link to={a.to}>
                <ItemMedia variant="icon">{a.icon}</ItemMedia>
                <ItemContent>
                  <ItemTitle>{a.title}</ItemTitle>
                  <ItemDescription className="line-clamp-1">{a.description}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                </ItemActions>
              </Link>
            </Item>
          ))}
        </ItemGroup>
      </CardContent>
    </Card>
  );
}
