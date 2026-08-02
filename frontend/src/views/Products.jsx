import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, RefreshCw, Trash2 } from 'lucide-react'
import api from '@/lib/api'
import { Badge } from '@/components/ui/badge'
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

// Admin-only product management: data table + add/delete dialogs.
export default function Products() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  // Add-product dialog state
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({
    name: '',
    sku: '',
    category: '',
    unit_price: '',
    cost_price: '',
    quantity_in_stock: 0,
    reorder_level: 0,
  })

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const loadProducts = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/products')
      setProducts(data)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not load products')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProducts()
  }, [])

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleAdd = async () => {
    if (!form.name) {
      toast.error('Product name is required')
      return
    }
    try {
      await api.post('/products', {
        name: form.name,
        sku: form.sku || null,
        category: form.category || null,
        unit_price: Number(form.unit_price) || 0,
        cost_price: Number(form.cost_price) || 0,
        quantity_in_stock: Number(form.quantity_in_stock) || 0,
        reorder_level: Number(form.reorder_level) || 0,
      })
      toast.success(`"${form.name}" added`)
      setAddOpen(false)
      setForm({ name: '', sku: '', category: '', unit_price: '', cost_price: '', quantity_in_stock: 0, reorder_level: 0 })
      loadProducts()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not add product')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/products/${deleteTarget.id}`)
      toast.success(`"${deleteTarget.name}" deleted`)
      setDeleteTarget(null)
      loadProducts()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not delete product')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Products</h1>
        <Button variant="outline" size="icon" onClick={loadProducts} title="Refresh">
          <RefreshCw className="size-4" />
        </Button>
        <Button className="ml-auto" onClick={() => setAddOpen(true)}>
          <Plus className="size-4" /> Add Product
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading products…</p>
      ) : (
        <div className="rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-muted-foreground">{p.sku || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{p.category || '—'}</TableCell>
                  <TableCell className="text-right">${Number(p.unit_price).toFixed(2)}</TableCell>
                  <TableCell className="text-right">{p.quantity_in_stock}</TableCell>
                  <TableCell>
                    <Badge variant={p.status === 'Low Stock' ? 'destructive' : 'outline'}>
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      title={`Delete ${p.name}`}
                      onClick={() => setDeleteTarget(p)}
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

      {/* ---------- Add product dialog ---------- */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Product</DialogTitle>
            <DialogDescription>Create a new catalog entry.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="p-name">Name *</Label>
              <Input id="p-name" value={form.name} onChange={set('name')} placeholder="Wireless Mouse" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-sku">SKU</Label>
              <Input id="p-sku" value={form.sku} onChange={set('sku')} placeholder="WM-001" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-cat">Category</Label>
              <Input id="p-cat" value={form.category} onChange={set('category')} placeholder="Electronics" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-price">Unit Price</Label>
              <Input id="p-price" type="number" step="0.01" value={form.unit_price} onChange={set('unit_price')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-cost">Cost Price</Label>
              <Input id="p-cost" type="number" step="0.01" value={form.cost_price} onChange={set('cost_price')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-qty">Stock</Label>
              <Input id="p-qty" type="number" value={form.quantity_in_stock} onChange={set('quantity_in_stock')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-reorder">Reorder Level</Label>
              <Input id="p-reorder" type="number" value={form.reorder_level} onChange={set('reorder_level')} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd}>Save Product</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Delete confirmation dialog ---------- */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete "{deleteTarget?.name}"?</DialogTitle>
            <DialogDescription>
              This removes the product from the catalog permanently. Products referenced by
              past sales cannot be deleted.
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
