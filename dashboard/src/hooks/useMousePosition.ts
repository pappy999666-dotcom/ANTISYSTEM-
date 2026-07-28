import { useEffect, useRef } from 'react'

export function useMousePosition() {
  const pos = useRef({ x: 0, y: 0, nx: 0, ny: 0 })

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      pos.current.x = e.clientX
      pos.current.y = e.clientY
      pos.current.nx = (e.clientX / window.innerWidth)  * 2 - 1
      pos.current.ny = (e.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('mousemove', handler, { passive: true })
    return () => window.removeEventListener('mousemove', handler)
  }, [])

  return pos
}
