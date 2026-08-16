import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/lib/auth'
import { AdminRoute, ProtectedRoute } from '@/components/guards'
import Layout from '@/components/layout'
import Login from '@/views/Login'
import Dashboard from '@/views/Dashboard'
import Pos from '@/views/Pos'
import Products from '@/views/Products'
import Customers from '@/views/Customers'
import Employees from '@/views/Employees'
import Expenses from '@/views/Expenses'
import Sales from '@/views/Sales'

// Main router: maps every URL to a view.
//  - /login        public
//  - everything else requires a valid bearer token (ProtectedRoute)
//  - /dashboard, /products are admin-only (AdminRoute)
//  - customers/employees/expenses/sales are full CRUD modules
export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/pos" replace />} />
            <Route path="/pos" element={<Pos />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/sales" element={<Sales />} />

            <Route element={<AdminRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/products" element={<Products />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/pos" replace />} />
      </Routes>
    </AuthProvider>
  )
}
