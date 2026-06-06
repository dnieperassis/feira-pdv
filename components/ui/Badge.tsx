import { ReactNode } from 'react'

type Color = 'green' | 'red' | 'amber' | 'blue' | 'slate' | 'purple'

const colorClass: Record<Color, string> = {
  green:  'bg-green-500/20 text-green-400 border-green-500/30',
  red:    'bg-red-500/20 text-red-400 border-red-500/30',
  amber:  'bg-amber-500/20 text-amber-400 border-amber-500/30',
  blue:   'bg-blue-500/20 text-blue-400 border-blue-500/30',
  slate:  'bg-slate-500/20 text-slate-400 border-slate-500/30',
  purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
}

interface Props {
  color: Color
  children: ReactNode
  className?: string
}

export function Badge({ color, children, className = '' }: Props) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass[color]} ${className}`}>
      {children}
    </span>
  )
}
