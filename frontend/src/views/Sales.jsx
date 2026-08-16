import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'
import api from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// Sales history: the last 100 sales with customer/employee names.
export default function Sales() {
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)

  const loadSales = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/sales')
      setSales(data)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not load sales')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSales()
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Sales History</h1>
        <Button variant="outline" size="icon" onClick={loadSales} title="Refresh">
          <RefreshCw className="size-4" />
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading sales…</p>
      ) : sales.length === 0 ? (
        <p className="text-muted-foreground">No sales recorded yet — use the POS terminal.</p>
      ) : (
        <div className="rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sale #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">#{s.id}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(s.sale_date).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.customer_name || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{s.employee_name || '—'}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{s.payment_method}</TableCell>
                  <TableCell>
                    <Badge variant={s.status === 'completed' ? 'outline' : 'secondary'}>{s.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    ${Number(s.total_amount).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}