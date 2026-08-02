import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Minus, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react'
import api from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'

// Cart state: productId -> quantity. Prices always come from the server
// response (unit_price), never typed by the cashier.
export default function Pos() {
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState({}) // { productId: quantity }
  const [loading, setLoading] = useState(true)
  const [checkingOut, setCheckingOut] = useState(false)

  const loadProducts = async () => {
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

  // Filter the catalog by the search box (name, sku, or category).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q),
    )
  }, [products, search])

  // Cart helpers
  const addToCart = (product) => {
    if (product.quantity_in_stock <= (cart[product.id] || 0)) {
      toast.error(`No more stock for "${product.name}"`)
      return
    }
    setCart((c) => ({ ...c, [product.id]: (c[product.id] || 0) + 1 }))
  }

  const changeQty = (productId, delta) => {
    setCart((c) => {
      const next = (c[productId] || 0) + delta
      const copy = { ...c }
      if (next <= 0) delete copy[productId]
      else copy[productId] = next
      return copy
    })
  }

  const cartLines = Object.entries(cart)
    .map(([id, qty]) => {
      const product = products.find((p) => p.id === Number(id))
      return product ? { product, qty } : null
    })
    .filter(Boolean)

  // Subtotal computed live from server-side unit prices.
  const subtotal = cartLines.reduce(
    (sum, { product, qty }) => sum + Number(product.unit_price) * qty,
    0,
  )

  const checkout = async () => {
    if (cartLines.length === 0) return
    setCheckingOut(true)
    try {
      // POST /sales fires the database triggers server-side
      // (stock reduction, audit logging, low-stock status).
      const { data } = await api.post('/sales', {
        payment_method: 'cash',
        items: cartLines.map(({ product, qty }) => ({
          product_id: product.id,
          quantity: qty,
        })),
      })
      toast.success(`Sale #${data.sale_id} completed — total $${data.total_amount}`)
      setCart({})
      loadProducts() // refresh stock levels shown in the catalog
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Checkout failed')
    } finally {
      setCheckingOut(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      {/* ---------------- Catalog ---------------- */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">POS Terminal</h1>
          <div className="relative ml-auto w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products…"
              className="pl-9"
            />
          </div>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading products…</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((product) => {
              const inCart = cart[product.id] || 0
              const soldOut = product.quantity_in_stock <= inCart
              return (
                <Card key={product.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {product.sku || 'no sku'}
                      </p>
                    </div>
                    <Badge variant={product.status === 'Low Stock' ? 'destructive' : 'outline'}>
                      {product.quantity_in_stock} left
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-lg font-semibold">${Number(product.unit_price).toFixed(2)}</p>
                    <Button size="sm" onClick={() => addToCart(product)} disabled={soldOut}>
                      <Plus className="size-4" /> Add
                    </Button>
                  </div>
                </Card>
              )
            })}
            {filtered.length === 0 && (
              <p className="text-muted-foreground">No products match your search.</p>
            )}
          </div>
        )}
      </div>

      {/* ---------------- Cart / Checkout ---------------- */}
      <Card className="h-fit lg:sticky lg:top-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="size-4" /> Current Cart
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {cartLines.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Cart is empty — add products from the catalog.
            </p>
          ) : (
            <>
              {cartLines.map(({ product, qty }) => (
                <div key={product.id} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      ${Number(product.unit_price).toFixed(2)} each
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-7"
                      onClick={() => changeQty(product.id, -1)}
                    >
                      <Minus className="size-3" />
                    </Button>
                    <span className="w-6 text-center text-sm font-medium">{qty}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-7"
                      onClick={() => changeQty(product.id, 1)}
                      disabled={product.quantity_in_stock <= qty}
                    >
                      <Plus className="size-3" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-destructive"
                    onClick={() => changeQty(product.id, -qty)}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              ))}

              <Separator />

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="text-lg font-semibold">${subtotal.toFixed(2)}</span>
              </div>

              <Button className="w-full" size="lg" disabled={checkingOut} onClick={checkout}>
                {checkingOut ? 'Processing…' : `Checkout $${subtotal.toFixed(2)}`}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
