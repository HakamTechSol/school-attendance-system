import { useEffect, useRef, useState } from 'react'
import { toDateKey } from './format'

export function usePageTitle(title) {
  const previous = useRef(document.title)
  useEffect(() => {
    if (!title) return undefined
    document.title = `${title} · School Attendance`
    return () => {
      document.title = previous.current
    }
  }, [title])
}

/** setInterval that stays in sync with React state without re-registering. */
export function useInterval(callback, delay) {
  const saved = useRef(callback)
  useEffect(() => {
    saved.current = callback
  }, [callback])
  useEffect(() => {
    if (delay == null) return undefined
    const id = setInterval(() => saved.current(), delay)
    return () => clearInterval(id)
  }, [delay])
}

/** Current time, refreshed on `tickMs`. */
export function useNow(tickMs = 1000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), tickMs)
    return () => clearInterval(id)
  }, [tickMs])
  return now
}

/** The current date key (YYYY-MM-DD) in a timezone; recomputed when it rolls over. */
export function useTodayKey(timezone, tickMs = 60_000) {
  const [key, setKey] = useState(() => toDateKey(new Date(), timezone))
  useEffect(() => {
    const check = () => {
      const next = toDateKey(new Date(), timezone)
      setKey((current) => (current === next ? current : next))
    }
    const id = setInterval(check, tickMs)
    return () => clearInterval(id)
  }, [timezone, tickMs])
  return key
}

/** Locks background scrolling while a mobile sheet / dialog is open. */
export function useBodyScrollLock(locked) {
  useEffect(() => {
    if (!locked) return undefined
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [locked])
}