import { useState, useEffect } from 'react'
import { useAuth } from '../../components/AuthProvider'
import Layout from '../../components/Layout'
import StatCard from '../../components/StatCard'
import TopTracksTable from '../../components/TopTracksTable'
import { 
  ChartBarIcon, 
  MusicalNoteIcon, 
  UsersIcon,
  GlobeAltIcon 
} from '@heroicons/react/24/outline'

interface GeneralStats {
  totalListens: number
  topTracks: Array<{
    name: string
    plays: number
    artist: string
    album: string
  }>
  countries: Record<string, number>
  devices: Record<string, number>
  browsers: Record<string, number>
}

export default function AdminDashboard() {
  const { isAuthenticated, login, loading } = useAuth()
  const [stats, setStats] = useState<GeneralStats | null>(null)
  const [authToken, setAuthToken] = useState('')
  const [authError, setAuthError] = useState('')
  const [statsLoading, setStatsLoading] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      loadStats()
    }
  }, [isAuthenticated])

  const loadStats = async () => {
    setStatsLoading(true)
    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch('/api/admin/general', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      } else {
        console.error('Failed to load stats')
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setStatsLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    
    const success = await login(authToken)
    if (!success) {
      setAuthError('Неверный токен')
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Загрузка...</div>
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Вход в админку
          </h2>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label htmlFor="token" className="block text-sm font-medium text-gray-700">
                  API Token
                </label>
                <div className="mt-1">
                  <input
                    id="token"
                    type="password"
                    value={authToken}
                    onChange={(e) => setAuthToken(e.target.value)}
                    required
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Введите STATS_API_SECRET"
                  />
                </div>
              </div>

              {authError && (
                <div className="text-red-600 text-sm">{authError}</div>
              )}

              <div>
                <button
                  type="submit"
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Войти
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )
  }

  const topCountries = Object.entries(stats?.countries || {})
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)

  const topDevices = Object.entries(stats?.devices || {})
    .sort(([,a], [,b]) => b - a)

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Общие метрики</h1>
          <p className="mt-2 text-sm text-gray-600">
            Обзор активности на сайте
          </p>
        </div>

        {statsLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Загрузка статистики...</div>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="Всего прослушиваний"
                value={stats?.totalListens.toLocaleString() || '0'}
                icon={<ChartBarIcon className="h-8 w-8 text-blue-500" />}
              />
              <StatCard
                title="Уникальных треков"
                value={stats?.topTracks.length || '0'}
                icon={<MusicalNoteIcon className="h-8 w-8 text-green-500" />}
              />
              <StatCard
                title="Стран"
                value={Object.keys(stats?.countries || {}).length}
                icon={<GlobeAltIcon className="h-8 w-8 text-purple-500" />}
              />
              <StatCard
                title="Устройств"
                value={Object.keys(stats?.devices || {}).length}
                icon={<UsersIcon className="h-8 w-8 text-orange-500" />}
              />
            </div>

            {/* Top Tracks Table */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TopTracksTable tracks={stats?.topTracks.slice(0, 10) || []} />
              
              {/* Countries & Devices Stats */}
              <div className="space-y-6">
                <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                  <div className="px-4 py-5 sm:px-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Топ страны
                    </h3>
                  </div>
                  <div className="px-4 py-5 sm:p-6">
                    <dl className="space-y-3">
                      {topCountries.map(([country, count]) => (
                        <div key={country} className="flex justify-between">
                          <dt className="text-sm font-medium text-gray-500">
                            {country}
                          </dt>
                          <dd className="text-sm text-gray-900">
                            {count}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>

                <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                  <div className="px-4 py-5 sm:px-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Устройства
                    </h3>
                  </div>
                  <div className="px-4 py-5 sm:p-6">
                    <dl className="space-y-3">
                      {topDevices.map(([device, count]) => (
                        <div key={device} className="flex justify-between">
                          <dt className="text-sm font-medium text-gray-500">
                            {device}
                          </dt>
                          <dd className="text-sm text-gray-900">
                            {count}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
