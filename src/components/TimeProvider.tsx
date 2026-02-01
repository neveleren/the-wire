'use client'

import { useEffect, useState } from 'react'
import { getTimeOfDay, type TimeOfDay } from '@/lib/time-theme'

export function TimeProvider({ children }: { children: React.ReactNode }) {
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('afternoon')

  useEffect(() => {
    // Set initial time
    setTimeOfDay(getTimeOfDay())

    // Update every minute
    const interval = setInterval(() => {
      setTimeOfDay(getTimeOfDay())
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-time', timeOfDay)
  }, [timeOfDay])

  return <>{children}</>
}
