import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, RefreshCw, Trash2 } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// Expense logging: data table + add/delete dialogs.
// Expenses feed the dashboard's monthly profit view.
export default function Expenses() {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)

  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ category: '', description: '', amount: '', expense_date: '' })
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const loadExpenses = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/expenses')
      setExpenses(data)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not load expenses')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadExpenses()
  }, [])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleAdd = async () => {
    if (!form.category) {
      toast.error('Expense category is required')
      return
    }
    try {
      await api.post('/expenses', {
        category: form.category,
        description: form.description || null,
        amount: Number(form.amount) || 0,
        expense_date: form.expense_date || null,
      })
      toast.success('Expense recorded')
      setAddOpen(false)
      setForm({ category: '', description: '', amount: '', expense_date: '' })
      loadExpenses()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not add expense')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/expenses/${deleteTarget.id}`)
      toast.success('Expense deleted')
      setDeleteTarget(null)
      loadExpenses()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not delete expense')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Expenses</h1>
        <Button variant="outline" size="icon" onClick={loadExpenses} title="Refresh">
          <RefreshCw className="size-4" />
        </Button>
        <Button className="ml-auto" onClick={() => setAddOpen(true)}>
          <Plus className="size-4" /> Add Expense
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading expenses…</p>
      ) : (
        <div className="rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-muted-foreground">{e.expense_date || '—'}</TableCell>
                  <TableCell className="font-medium">{e.category}</TableCell>
                  <TableCell className="text-muted-foreground">{e.description || '—'}</TableCell>
                  <TableCell className="text-right">${Number(e.amount).toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      title="Delete expense"
                      onClick={() => setDeleteTarget(e)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ---------- Add expense dialog ---------- */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
            <DialogDescription>Record a business cost (rent, utilities, …).</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="x-cat">Category *</Label>
              <Input id="x-cat" value={form.category} onChange={set('category')} placeholder="Utilities" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="x-amount">Amount</Label>
              <Input id="x-amount" type="number" step="0.01" value={form.amount} onChange={set('amount')} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="x-desc">Description</Label>
              <Input id="x-desc" value={form.description} onChange={set('description')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="x-date">Date</Label>
              <Input id="x-date" type="date" value={form.expense_date} onChange={set('expense_date')} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd}>Save Expense</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Delete confirmation dialog ---------- */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this expense?</DialogTitle>
            <DialogDescription>
              {deleteTarget ? `${deleteTarget.category} — $${Number(deleteTarget.amount).toFixed(2)}` : ''}
              {' '}will be removed permanently.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}