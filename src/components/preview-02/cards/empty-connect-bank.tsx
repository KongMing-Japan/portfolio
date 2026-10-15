import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { CreditCardIcon } from "lucide-react"

export function EmptyConnectBank() {
  return (
    <Card>
      <CardContent>
        <Empty className="p-4">
          <EmptyMedia variant="icon">
            <CreditCardIcon />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>Connect Bank</EmptyTitle>
            <EmptyDescription>
              Link your payout method to receive monthly royalty distributions
              automatically.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button>Set Up Payouts</Button>
          </EmptyContent>
        </Empty>
      </CardContent>
    </Card>
  )
}
