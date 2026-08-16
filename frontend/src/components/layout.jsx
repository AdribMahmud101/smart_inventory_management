import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  UserCog,
  Wallet,
  Receipt,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

// Navigation entries. The `roles` field decides visibility:
//   'all'  -> every authenticated user
//   'admin'-> administrators only
// This powers the conditional sidebar rendering (Admin vs. Employee).
const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin'] },
  { to: '/pos', label: 'POS Terminal', icon: ShoppingCart, roles: ['all'] },
  { to: '/products', label: 'Products', icon: Package, roles: ['admin'] },
  { to: '/customers', label: 'Customers', icon: Users, roles: ['all'] },
  { to: '/employees', label: 'Employees', icon: UserCog, roles: ['all'] },
  { to: '/expenses', label: 'Expenses', icon: Wallet, roles: ['all'] },
  { to: '/sales', label: 'Sales History', icon: Receipt, roles: ['all'] },
]

export default function Layout() {
  const { user, isAdmin, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const visibleItems = NAV_ITEMS.filter(
    (item) => item.roles.includes('all') || item.roles.includes(user?.role),
  )

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const sidebar = (
    <div className="flex h-full w-64 flex-col border-r bg-sidebar">
      {/* Brand */}
      <div className="flex items-center justify-between px-6 py-5">
        <div>
          <p className="text-base font-semibold text-foreground">Smart Inventory</p>
          <p className="text-xs text-muted-foreground">Business Management</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="size-4" />
        </Button>
      </div>

      <Separator />

      {/* Role-aware navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )
            }
          >
            <item.icon className="size-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <Separator />

      {/* Session footer */}
      <div className="space-y-2 px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{user?.username}</p>
            <p className="text-xs text-muted-foreground">
              {isAdmin ? 'Administrator' : 'Employee'}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} title="Log out">
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Desktop sidebar (always visible) */}
      <aside className="hidden md:block">{sidebar}</aside>

      {/* Mobile sidebar (toggled via hamburger) */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute inset-y-0 left-0">{sidebar}</aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b bg-background px-4 py-3 md:hidden">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="size-5" />
          </Button>
          <p className="font-semibold">Smart Inventory</p>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
