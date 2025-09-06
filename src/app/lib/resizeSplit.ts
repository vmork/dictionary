"use client"

import { useCallback, useEffect, useRef, useState } from "react"

type Orientation = "vertical" | "horizontal"

type Options = {
  orientation: Orientation
  initialPercent?: number // 0-100, default 40
  minPercent: number // 0-100
  maxPercent: number // 0-100
  active?: boolean
}

export function useResizableSplit({
  orientation,
  initialPercent = 40,
  minPercent,
  maxPercent,
  active = true,
}: Options) {
  const gridRef = useRef<HTMLDivElement>(null)
  const [primaryPx, setPrimaryPx] = useState<number>(0)

  // Ensure bounds on mount/orientation change/window resize
  useEffect(() => {
    if (!gridRef.current || !active) return
    const ensureBounds = () => {
      const rect = gridRef.current!.getBoundingClientRect()
      const total = orientation === "vertical" ? rect.width : rect.height
      const minPx = (Math.max(0, Math.min(100, minPercent)) / 100) * total
      const maxPx = (Math.max(0, Math.min(100, maxPercent)) / 100) * total
      // If size not set yet (0), initialize from initialPercent
      setPrimaryPx((prev) => {
        const initialPx = (Math.max(0, Math.min(100, initialPercent)) / 100) * total
        const base = prev > 0 ? prev : initialPx
        return Math.max(minPx, Math.min(base, maxPx))
      })
    }
    ensureBounds()
    window.addEventListener("resize", ensureBounds)
    return () => window.removeEventListener("resize", ensureBounds)
  }, [active, minPercent, maxPercent, initialPercent, orientation])

  function startDrag(pos: number) {
    if (!gridRef.current || !active) return
  const rect = gridRef.current.getBoundingClientRect()
    const start = orientation === "vertical" ? rect.left : rect.top

    const onMove = (p: number) => {
  const total = orientation === "vertical" ? rect.width : rect.height
  let newSize = p - start
  const minPx = (Math.max(0, Math.min(100, minPercent)) / 100) * total
  const maxPx = (Math.max(0, Math.min(100, maxPercent)) / 100) * total
  newSize = Math.max(minPx, Math.min(newSize, maxPx))
  setPrimaryPx(newSize)
    }
    onMove(pos)

    const handleMouseMove = (e: MouseEvent) => onMove(orientation === "vertical" ? e.clientX : e.clientY)
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) onMove(orientation === "vertical" ? e.touches[0].clientX : e.touches[0].clientY)
    }
    const end = () => {
      document.body.style.userSelect = ""
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", end)
      window.removeEventListener("touchmove", handleTouchMove)
      window.removeEventListener("touchend", end)
    }
    document.body.style.userSelect = "none"
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", end)
    window.addEventListener("touchmove", handleTouchMove, { passive: false })
    window.addEventListener("touchend", end)
  }

  function onDividerMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault()
    startDrag(orientation === "vertical" ? e.clientX : e.clientY)
  }
  function onDividerTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    e.preventDefault()
    const t = e.touches[0]
    if (t) startDrag(orientation === "vertical" ? t.clientX : t.clientY)
  }

  const containerStyle = active
    ? (orientation === "vertical"
        ? ({ gridTemplateColumns: `${primaryPx}px 1fr` } as React.CSSProperties)
        : ({ gridTemplateRows: `${primaryPx}px 1fr` } as React.CSSProperties))
    : undefined

  const dividerStyle = orientation === "vertical"
    ? ({ left: primaryPx - 0.5 } as React.CSSProperties)
    : ({ top: primaryPx - 0.5 } as React.CSSProperties)

  const setRef = useCallback((el: HTMLDivElement | null) => {
    (gridRef as any).current = el
  }, [])

  return {
    gridRef,
    setRef,
    containerStyle,
    dividerStyle,
    onDividerMouseDown,
    onDividerTouchStart,
  }
}
