import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ShoppingCart } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function Login() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  // Already signed in? Skip the login screen.
  if (isAuthenticated) {
    navigate('/pos', { replace: true })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const user = await login(username, password)
      toast.success(`Welcome back, ${user.username}!`)
      // Return to the page the user tried to open, else the dashboard/POS.
      const from = location.state?.from?.pathname
      navigate(user.role === 'admin' ? from || '/dashboard' : from || '/pos', { replace: true })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-primary/10">
            <ShoppingCart className="size-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Smart Inventory</CardTitle>
          <CardDescription>Sign in to the business management system</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin01"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
