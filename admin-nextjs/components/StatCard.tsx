interface StatCardProps {
  title: string
  value: string | number
  change?: string
  icon?: React.ReactNode
}

export default function StatCard({ title, value, change, icon }: StatCardProps) {
  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            {icon}
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">
                {title}
              </dt>
              <dd className="text-lg font-medium text-gray-900">
                {value}
              </dd>
            </dl>
          </div>
        </div>
        {change && (
          <div className="mt-4">
            <div className="text-sm text-gray-500">
              {change}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
