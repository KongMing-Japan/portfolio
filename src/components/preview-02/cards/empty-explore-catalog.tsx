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
import { AudioLinesIcon } from "lucide-react"

export function EmptyExploreCatalog() {
  return (
    <Card>
      <CardContent>
        <Empty className="p-4">
          <EmptyMedia variant="icon">
            <AudioLinesIcon />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>Explore Catalog</EmptyTitle>
            <EmptyDescription>
              Check your ISRC codes, metadata, and visual assets before going
              live.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button>View Catalog</Button>
          </EmptyContent>
        </Empty>
      </CardContent>
    </Card>
  )
}
