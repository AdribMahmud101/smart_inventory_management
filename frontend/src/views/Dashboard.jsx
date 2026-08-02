import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import api from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// Bar chart palette (shared between the two charts).
const COLORS = ['#2563eb', '#7c3aed', '#0891b2', '#059669', '#d97706', '#dc2626']

export default function Dashboard() {
  const [monthly, setMonthly] = useState([])
  const [topSellers, setTopSellers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Admin-only endpoints — this view is guarded by AdminRoute.
    const load = async () => {
      try {
        const [profitRes, sellersRes] = await Promise.all([
          api.get('/analytics/monthly-profit'),
          api.get('/analytics/top-selling-products'),
        ])
        setMonthly(profitRes.data)
        setTopSellers(sellersRes.data)
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Could not load analytics')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const totals = useMemo(() => {
    const sales = monthly.reduce((sum, m) => sum + Number(m.total_sales), 0)
    const expenses = monthly.reduce((sum, m) => sum + Number(m.total_expenses), 0)
    const profit = monthly.reduce((sum, m) => sum + Number(m.profit), 0)
    const sold = topSellers.reduce((sum, t) => sum + Number(t.total_sold), 0)
    return { sales, expenses, profit, sold }
  }, [monthly, topSellers])

  // Recharts wants month labels like "Aug 2026" — format from the view's date.
  const monthlyData = monthly.map((m) => ({
    name: new Date(m.month + 'T00:00:00').toLocaleDateString(undefined, {
      month: 'short',
      year: '2-digit',
    }),
    Sales: Number(m.total_sales),
    Expenses: Number(m.total_expenses),
    Profit: Number(m.profit),
  }))

  const topData = topSellers.map((t) => ({
    name: t.product_name,
    value: Number(t.total_sold),
  }))

  if (loading) {
    return <p className="text-muted-foreground">Loading dashboard…</p>
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total Sales" value={totals.sales} />
        <SummaryCard label="Total Expenses" value={totals.expenses} />
        <SummaryCard label="Net Profit" value={totals.profit} />
        <SummaryCard label="Units Sold" value={totals.sold} currency={false} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Monthly profit: sales vs expenses bars */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Sales vs Expenses</CardTitle>
            <CardDescription>Source: monthly_profit_view</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Sales" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top selling products pie */}
        <Card>
          <CardHeader>
            <CardTitle>Top Selling Products</CardTitle>
            <CardDescription>Source: top_selling_products_view</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {topData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sales recorded yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={topData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="55%"
                    outerRadius="85%"
                    paddingAngle={2}
                  >
                    {topData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, currency = true }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">
          {currency ? `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : Number(value).toLocaleString()}
        </p>
      </CardContent>
    </Card>
  )
}
