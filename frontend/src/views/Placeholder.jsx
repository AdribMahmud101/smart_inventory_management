import { Construction } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// Generic "Coming Soon" view used by the pending features
// (Customers, Employees, Expenses). No API calls yet — the backend
// endpoints for these entities are planned for a later phase.
export default function Placeholder({ title }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md border-dashed text-center">
        <CardHeader className="items-center">
          <div className="mb-2 flex size-14 items-center justify-center rounded-full bg-muted">
            <Construction className="size-7 text-muted-foreground" />
          </div>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>
            This module is under construction and will be available in a future
            phase of the course project.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Visual placeholder — integrated with the layout, no API calls yet.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
