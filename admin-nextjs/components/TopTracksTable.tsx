interface Track {
  name: string
  plays: number
  artist: string
  album: string
}

interface TopTracksTableProps {
  tracks: Track[]
}

export default function TopTracksTable({ tracks }: TopTracksTableProps) {
  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-md">
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900">
          Топ треки
        </h3>
      </div>
      <ul className="divide-y divide-gray-200">
        {tracks.map((track, index) => (
          <li key={index} className="px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0 h-10 w-10">
                  <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
                    <span className="text-white font-medium">{index + 1}</span>
                  </div>
                </div>
                <div className="ml-4">
                  <div className="text-sm font-medium text-gray-900">
                    {track.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {track.artist} • {track.album}
                  </div>
                </div>
              </div>
              <div className="text-sm text-gray-900 font-medium">
                {track.plays.toLocaleString()} прослушиваний
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
