'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ShoppingBag,
  CreditCard,
  LogOut,
  Moon,
  Sun,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const routes = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    href: '/admin',
  },
  {
    label: '訂單查詢',
    icon: ShoppingBag,
    href: '/admin/orders',
  },
  {
    label: 'Payment Log',
    icon: CreditCard,
    href: '/admin/payment-log',
  },
]

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="border-b border-border p-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold">Space8 Admin</span>
              <span className="text-xs text-muted-foreground">管理後台</span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarMenu>
            {routes.map((route) => {
              const isActive = pathname === route.href
              const Icon = route.icon

              return (
                <SidebarMenuItem key={route.href}>
                  <SidebarMenuButton
                    render={<Link href={route.href} />}
                    isActive={isActive}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{route.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarContent>

        <div className="mt-auto border-t border-border p-4">
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="secondary" size="default" className="w-full">
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme('light')}>
                Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')}>
                Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')}>
                System
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Link href="/api/auth/signout" className="mt-2 block">
            <Button
              variant="ghost"
              className="w-full justify-start"
            >
              <LogOut className="mr-2 h-4 w-4" />
              登出
            </Button>
          </Link>
        </div>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-16 items-center gap-4 border-b border-border px-6">
          <SidebarTrigger>
            <span className="sr-only">Toggle Sidebar</span>
          </SidebarTrigger>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
