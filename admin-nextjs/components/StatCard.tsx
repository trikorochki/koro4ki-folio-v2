interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  icon?: React.ReactNode;
  loading?: boolean;
}

export default function StatCard({ title, value, change, icon, loading = false }: StatCardProps) {
  if (loading) {
    return (
      <>
        <div className="bg-white rounded-lg shadow p-6 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
        </div>

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
      </>
    );
  }


  
}
