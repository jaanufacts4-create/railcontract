'use client'
import { useEffect, useState } from 'react'

type TrainStatus = {
  train_no:  string
  ac_count:  number
  nac_count: number
  done:      boolean
}

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

export default function TodayPanel({ date, currentTrain }: { date: string; currentTrain?: string }) {
  const [trains, setTrains] = useState<TrainStatus[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!date) { setTrains([]); return }
    setLoading(true)
    fetch(`/api/schedule?date=${date}`)
      .then(r => r.json())
      .then(data => { setTrains(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [date])

  if (!date) return null

  const [dy, dm, dd] = date.split('-').map(Number)
  const dow   = DAYS[new Date(Date.UTC(dy, dm - 1, dd)).getUTCDay()]
  const done  = trains.filter(t => t.done).length
  const total = trains.length

  return (
    <div className="bg-white border rounded-lg shadow-sm p-4 min-w-[220px]">
      <div className="font-semibold text-sm text-gray-700 mb-1">
        {dow}&apos;s Trains
      </div>
      <div className="text-xs text-gray-400 mb-3">
        {date.split('-').reverse().join('-')}
      </div>

      {loading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : total === 0 ? (
        <p className="text-xs text-gray-400">No trains scheduled.</p>
      ) : (
        <>
          {/* Summary bar */}
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${(done / total) * 100}%` }}
              />
            </div>
          </div>
          <div className="flex justify-between text-xs mb-3">
            <span className="font-semibold text-green-700">✓ {done} done</span>
            <span className="font-semibold text-orange-600">⏳ {total - done} pending</span>
          </div>

          {/* Train list */}
          <div className="space-y-1.5">
            {trains.map(t => {
              const isCurrent = t.train_no === currentTrain
              return (
                <div
                  key={t.train_no}
                  className={`flex items-center justify-between rounded px-2 py-1 text-xs
                    ${t.done      ? 'bg-green-50 text-green-700'  : 'bg-gray-50 text-gray-600'}
                    ${isCurrent   ? 'ring-2 ring-blue-400'        : ''}
                  `}
                >
                  <span className="font-medium">{t.train_no}</span>
                  <span className="text-gray-400">
                    {t.ac_count > 0 && <span className="mr-1">AC:{t.ac_count}</span>}
                    {t.nac_count > 0 && <span>NAC:{t.nac_count}</span>}
                  </span>
                  <span>{t.done ? '✅' : '⏳'}</span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
