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

// Customer management: data table + add/delete dialogs.
export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)

  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', address: '', loyalty_points: 0 })
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const loadCustomers = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/customers')
      setCustomers(data)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not load customers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCustomers()
  }, [])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleAdd = async () => {
    if (!form.full_name) {
      toast.error('Customer name is required')
      return
    }
    try {
      await api.post('/customers', {
        full_name: form.full_name,
        email: form.email || null,
        phone: form.phone || null,
        address: form.address || null,
        loyalty_points: Number(form.loyalty_points) || 0,
      })
      toast.success(`"${form.full_name}" added`)
      setAddOpen(false)
      setForm({ full_name: '', email: '', phone: '', address: '', loyalty_points: 0 })
      loadCustomers()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not add customer')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/customers/${deleteTarget.id}`)
      toast.success(`"${deleteTarget.full_name}" deleted`)
      setDeleteTarget(null)
      loadCustomers()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not delete customer')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Customers</h1>
        <Button variant="outline" size="icon" onClick={loadCustomers} title="Refresh">
          <RefreshCw className="size-4" />
        </Button>
        <Button className="ml-auto" onClick={() => setAddOpen(true)}>
          <Plus className="size-4" /> Add Customer
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading customers…</p>
      ) : (
        <div className="rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Address</TableHead>
                <TableHead className="text-right">Loyalty Points</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.full_name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.email || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{c.phone || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{c.address || '—'}</TableCell>
                  <TableCell className="text-right">{c.loyalty_points}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      title={`Delete ${c.full_name}`}
                      onClick={() => setDeleteTarget(c)}
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

      {/* ---------- Add customer dialog ---------- */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Customer</DialogTitle>
            <DialogDescription>Create a new customer record.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="c-name">Full Name *</Label>
              <Input id="c-name" value={form.full_name} onChange={set('full_name')} placeholder="Jane Doe" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-email">Email</Label>
              <Input id="c-email" type="email" value={form.email} onChange={set('email')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-phone">Phone</Label>
              <Input id="c-phone" value={form.phone} onChange={set('phone')} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="c-address">Address</Label>
              <Input id="c-address" value={form.address} onChange={set('address')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-points">Loyalty Points</Label>
              <Input id="c-points" type="number" value={form.loyalty_points} onChange={set('loyalty_points')} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd}>Save Customer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Delete confirmation dialog ---------- */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete "{deleteTarget?.full_name}"?</DialogTitle>
            <DialogDescription>
              This removes the customer record permanently. Customers with past sales
              cannot be deleted.
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