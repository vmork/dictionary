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

type DragState = {
  pointerId: number
  start: number
  total: number
  grabOffset: number
}

function clampPercent(value: number, minPercent: number, maxPercent: number) {
  const min = Math.max(0, Math.min(100, minPercent))
  const max = Math.max(min, Math.min(100, maxPercent))
  return Math.max(min, Math.min(value, max))
}

export function useResizableSplit({
  orientation,
  initialPercent = 40,
  minPercent,
  maxPercent,
  active = true,
}: Options) {
  const gridRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const previousBodyStyles = useRef<{ cursor: string; userSelect: string } | null>(null)
  const [primaryPercent, setPrimaryPercent] = useState(() =>
    clampPercent(initialPercent, minPercent, maxPercent)
  )

  const boundedPrimaryPercent = clampPercent(primaryPercent, minPercent, maxPercent)

  const setRef = useCallback((element: HTMLDivElement | null) => {
    gridRef.current = element
  }, [])

  const positionForEvent = (event: React.PointerEvent<HTMLDivElement>) =>
    orientation === "vertical" ? event.clientX : event.clientY

  function finishDrag(element?: HTMLDivElement, pointerId?: number) {
    const drag = dragRef.current
    if (!drag || (pointerId !== undefined && drag.pointerId !== pointerId)) return

    if (element?.hasPointerCapture(drag.pointerId)) {
      element.releasePointerCapture(drag.pointerId)
    }
    dragRef.current = null

    if (previousBodyStyles.current) {
      document.body.style.cursor = previousBodyStyles.current.cursor
      document.body.style.userSelect = previousBodyStyles.current.userSelect
      previousBodyStyles.current = null
    }
  }

  useEffect(() => () => finishDrag(), [])

  function onDividerPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!gridRef.current || !active || (event.pointerType === "mouse" && event.button !== 0)) return

    event.preventDefault()
    const rect = gridRef.current.getBoundingClientRect()
    const start = orientation === "vertical" ? rect.left : rect.top
    const total = orientation === "vertical" ? rect.width : rect.height
    if (total <= 0) return

    const position = positionForEvent(event)
    const dividerPosition = start + (boundedPrimaryPercent / 100) * total
    dragRef.current = {
      pointerId: event.pointerId,
      start,
      total,
      grabOffset: position - dividerPosition,
    }

    event.currentTarget.setPointerCapture(event.pointerId)
    previousBodyStyles.current = {
      cursor: document.body.style.cursor,
      userSelect: document.body.style.userSelect,
    }
    document.body.style.cursor = orientation === "vertical" ? "col-resize" : "row-resize"
    document.body.style.userSelect = "none"
  }

  function onDividerPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    event.preventDefault()
    const size = positionForEvent(event) - drag.start - drag.grabOffset
    setPrimaryPercent(clampPercent((size / drag.total) * 100, minPercent, maxPercent))
  }

  function onDividerPointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    finishDrag(event.currentTarget, event.pointerId)
  }

  function onDividerKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const decreaseKey = orientation === "vertical" ? "ArrowLeft" : "ArrowUp"
    const increaseKey = orientation === "vertical" ? "ArrowRight" : "ArrowDown"
    const step = event.shiftKey ? 10 : 4

    if (event.key === decreaseKey || event.key === increaseKey) {
      event.preventDefault()
      const direction = event.key === decreaseKey ? -1 : 1
      setPrimaryPercent((current) => clampPercent(current + direction * step, minPercent, maxPercent))
    } else if (event.key === "Home") {
      event.preventDefault()
      setPrimaryPercent(clampPercent(minPercent, minPercent, maxPercent))
    } else if (event.key === "End") {
      event.preventDefault()
      setPrimaryPercent(clampPercent(maxPercent, minPercent, maxPercent))
    }
  }

  const containerStyle = active
    ? orientation === "vertical"
      ? ({ gridTemplateColumns: `${boundedPrimaryPercent}% minmax(0, 1fr)` } as React.CSSProperties)
      : ({ gridTemplateRows: `${boundedPrimaryPercent}% minmax(0, 1fr)` } as React.CSSProperties)
    : undefined

  const dividerStyle = orientation === "vertical"
    ? ({ left: `${boundedPrimaryPercent}%` } as React.CSSProperties)
    : ({ top: `${boundedPrimaryPercent}%` } as React.CSSProperties)

  return {
    gridRef,
    setRef,
    containerStyle,
    dividerStyle,
    primaryPercent: boundedPrimaryPercent,
    onDividerPointerDown,
    onDividerPointerMove,
    onDividerPointerEnd,
    onDividerKeyDown,
  }
}
