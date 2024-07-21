"use client"

import { ReactNode, ButtonHTMLAttributes } from "react"
import { cn } from "../lib/utils"

export function Button({
  children,
  className,
  ...props
}: Readonly<
  {
    children?: ReactNode
    className?: string
  } & ButtonHTMLAttributes<HTMLButtonElement>
>) {
  return (
    <button
      className={cn(
        "rounded p-2 bg-primary transition text-center",
        props.disabled ? "opacity-50 cursor-not-allowed" : "hover:brightness-110",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
