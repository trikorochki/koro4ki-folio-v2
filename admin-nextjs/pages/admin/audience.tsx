import { useState, useEffect } from 'react'
import { useAuth } from '../../components/AuthProvider'
import Layout from '../../components/Layout'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

interface AudienceStats {
  countries: Record<string, number>
  devices: Record<string, number>
  browsers: Record<string, number>
  os: Record<string, number>
  recentActivity: Array<{
    ip: string
    country: string
    userAgent: string
    trackId: string
    eventType: string
    timestamp: string
  }>
  totalEvents: number
}

export default function AudiencePage() {
  const { isAuthenticated } = useAuth()
  const [stats, setStats] = useState<AudienceStats | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      loadStats()
    }
  }, [isAuthenticated])

  const loadStats = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch('/api/admin/audience', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error loading audience stats:', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });
    }
  finally {
      setLoading(false)
    }
  }

  if (!isAuthenticated) {
    return <div>Не авторизован</div>
  }

  const renderStatsList = (data: Record<string, number>, title: string) => (
    <div className="bg-white shadow rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>
      <div className="space-y-2">
        {Object.entries(data)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 10)
          .map(([key, value]) => (
            <div key={key} className="flex justify-between items-center">
              <span className="text-sm text-gray-600">{key}</span>
              <span className="text-sm font-medium text-gray-900">{value}</span>
            </div>
          ))}
      </div>
    </div>
  )

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Анализ аудитории</h1>
          <p className="mt-2 text-sm text-gray-600">
            Информация о посетителях и их активности
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Загрузка...</div>
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {stats && renderStatsList(stats.countries, 'Страны')}
              {stats && renderStatsList(stats.devices, 'Устройства')}
              {stats && renderStatsList(stats.browsers, 'Браузеры')}
              {stats && renderStatsList(stats.os, 'Операционные системы')}
            </div>

            {/* Recent Activity */}
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Последняя активность
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  Последние {stats?.recentActivity.length} событий
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Время
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Страна
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Трек
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Событие
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        IP
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stats?.recentActivity.slice(0, 50).map((activity, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {format(new Date(activity.timestamp), 'dd MMM, HH:mm', { locale: ru })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {activity.country}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate">
                          {activity.trackId}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {activity.eventType}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {activity.ip}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
