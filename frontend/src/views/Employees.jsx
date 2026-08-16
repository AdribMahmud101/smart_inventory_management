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

// Employee management: data table + add/delete dialogs.
export default function Employees() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)

  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ full_name: '', position: '', hire_date: '', phone: '', salary: '' })
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const loadEmployees = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/employees')
      setEmployees(data)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not load employees')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEmployees()
  }, [])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleAdd = async () => {
    if (!form.full_name) {
      toast.error('Employee name is required')
      return
    }
    try {
      await api.post('/employees', {
        full_name: form.full_name,
        position: form.position || null,
        hire_date: form.hire_date || null,
        phone: form.phone || null,
        salary: Number(form.salary) || 0,
      })
      toast.success(`"${form.full_name}" added`)
      setAddOpen(false)
      setForm({ full_name: '', position: '', hire_date: '', phone: '', salary: '' })
      loadEmployees()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not add employee')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/employees/${deleteTarget.id}`)
      toast.success(`"${deleteTarget.full_name}" deleted`)
      setDeleteTarget(null)
      loadEmployees()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not delete employee')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Employees</h1>
        <Button variant="outline" size="icon" onClick={loadEmployees} title="Refresh">
          <RefreshCw className="size-4" />
        </Button>
        <Button className="ml-auto" onClick={() => setAddOpen(true)}>
          <Plus className="size-4" /> Add Employee
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading employees…</p>
      ) : (
        <div className="rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Hire Date</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Salary</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.full_name}</TableCell>
                  <TableCell className="text-muted-foreground">{e.position || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{e.hire_date || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{e.phone || '—'}</TableCell>
                  <TableCell className="text-right">${Number(e.salary).toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      title={`Delete ${e.full_name}`}
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

      {/* ---------- Add employee dialog ---------- */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Employee</DialogTitle>
            <DialogDescription>Create a new staff record.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="e-name">Full Name *</Label>
              <Input id="e-name" value={form.full_name} onChange={set('full_name')} placeholder="John Smith" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-pos">Position</Label>
              <Input id="e-pos" value={form.position} onChange={set('position')} placeholder="Cashier" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-hire">Hire Date</Label>
              <Input id="e-hire" type="date" value={form.hire_date} onChange={set('hire_date')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-phone">Phone</Label>
              <Input id="e-phone" value={form.phone} onChange={set('phone')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-salary">Salary</Label>
              <Input id="e-salary" type="number" step="0.01" value={form.salary} onChange={set('salary')} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd}>Save Employee</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Delete confirmation dialog ---------- */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete "{deleteTarget?.full_name}"?</DialogTitle>
            <DialogDescription>
              This removes the employee record permanently. Employees attached to
              sales or expenses cannot be deleted.
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