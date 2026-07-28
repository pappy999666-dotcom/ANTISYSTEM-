import { useEffect, useRef, useCallback } from 'react'

export function useAnimationFrame(callback: (delta: number) => void, active = true) {
  const rafRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)
  const cbRef = useRef(callback)
  cbRef.current = callback

  const loop = useCallback((time: number) => {
    if (document.hidden) {
      rafRef.current = requestAnimationFrame(loop)
      return
    }
    const delta = lastTimeRef.current ? time - lastTimeRef.current : 0
    lastTimeRef.current = time
    cbRef.current(delta)
    rafRef.current = requestAnimationFrame(loop)
  }, [])

  useEffect(() => {
    if (!active) return
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [active, loop])
}
