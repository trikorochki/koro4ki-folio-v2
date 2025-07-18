import { ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAuth } from './AuthProvider'
import { 
  ChartBarIcon, 
  MusicalNoteIcon, 
  UsersIcon, 
  ArrowRightOnRectangleIcon 
} from '@heroicons/react/24/outline'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { logout } = useAuth()
  const router = useRouter()

  const navigation = [
    { name: 'Общие метрики', href: '/admin', icon: ChartBarIcon },
    { name: 'Композиции', href: '/admin/tracks', icon: MusicalNoteIcon },
    { name: 'Аудитория', href: '/admin/audience', icon: UsersIcon },
  ]

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="flex flex-col w-64 bg-white shadow-lg">
        <div className="flex items-center justify-center h-16 bg-blue-600">
          <h1 className="text-white text-xl font-bold">Админка 2.0</h1>
        </div>
        
        <nav className="mt-5 flex-1 px-2 space-y-1">
          {navigation.map((item) => {
            const isActive = router.pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`
                  group flex items-center px-2 py-2 text-sm font-medium rounded-md
                  ${isActive 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
              >
                <item.icon className="mr-3 h-6 w-6" />
                {item.name}
              </Link>
            )
          })}
        </nav>
        
        <div className="p-4 border-t">
          <button
            onClick={logout}
            className="flex items-center w-full px-2 py-2 text-sm font-medium text-red-600 rounded-md hover:bg-red-50"
          >
            <ArrowRightOnRectangleIcon className="mr-3 h-6 w-6" />
            Выход
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
