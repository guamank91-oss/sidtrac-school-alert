'use client'

import type { CSSProperties } from 'react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      style={
        {
          '--normal-bg': 'rgba(12, 28, 56, 0.96)',
          '--normal-text': '#f8fafc',
          '--normal-border': 'rgba(255, 255, 255, 0.22)',
          '--success-bg': 'rgba(8, 47, 28, 0.92)',
          '--error-bg': 'rgba(69, 10, 10, 0.92)',
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            'glass-panel border border-white/20 shadow-[var(--shadow-elevated)] backdrop-blur-xl',
          title: 'text-slate-50',
          description: 'text-slate-300',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
