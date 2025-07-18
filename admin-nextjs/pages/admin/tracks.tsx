import { useState, useEffect } from 'react'
import { useAuth } from '../../components/AuthProvider'
import Layout from '../../components/Layout'

interface Track {
  artist: string
  album: string
  track: string
  plays: number
  events: Record<string, number>
  url: string
}

export default function TracksPage() {
  const { isAuthenticated } = useAuth()
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'plays' | 'artist' | 'track'>('plays')

  useEffect(() => {
    if (isAuthenticated) {
      loadTracks()
    }
  }, [isAuthenticated])

  const loadTracks = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch('/api/admin/tracks', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setTracks(data.tracks)
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

  const filteredTracks = tracks.filter(track =>
    track.track.toLowerCase().includes(searchTerm.toLowerCase()) ||
    track.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
    track.album.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const sortedTracks = [...filteredTracks].sort((a, b) => {
    switch (sortBy) {
      case 'plays':
        return b.plays - a.plays
      case 'artist':
        return a.artist.localeCompare(b.artist)
      case 'track':
        return a.track.localeCompare(b.track)
      default:
        return 0
    }
  })

  if (!isAuthenticated) {
    return <div>Не авторизован</div>
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Статистика по композициям</h1>
          <p className="mt-2 text-sm text-gray-600">
            Детальная информация о прослушиваниях треков
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="search" className="block text-sm font-medium text-gray-700">
                Поиск
              </label>
              <input
                type="text"
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="Поиск по треку, исполнителю или альбому"
              />
            </div>
            <div>
              <label htmlFor="sort" className="block text-sm font-medium text-gray-700">
                Сортировка
              </label>
              <select
                id="sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'plays' | 'artist' | 'track')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="plays">По прослушиваниям</option>
                <option value="artist">По исполнителю</option>
                <option value="track">По названию</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tracks Table */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Найдено треков: {sortedTracks.length}
            </h3>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">Загрузка...</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Трек
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Исполнитель
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Альбом
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Прослушивания
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      События
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedTracks.map((track, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {track.track}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {track.artist}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {track.album}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {track.plays.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {Object.entries(track.events).map(([event, count]) => (
                          <div key={event} className="text-xs">
                            {event}: {count}
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
