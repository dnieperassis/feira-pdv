'use client'

import { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success'
type Size = 'sm' | 'md' | 'lg' | 'xl'

const variantClass: Record<Variant, string> = {
  primary:   'bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-gray-950 font-semibold',
  secondary: 'bg-slate-700 hover:bg-slate-600 active:bg-slate-800 text-white',
  danger:    'bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-semibold',
  success:   'bg-green-600 hover:bg-green-500 active:bg-green-700 text-white font-semibold',
  ghost:     'bg-transparent hover:bg-slate-800 active:bg-slate-700 text-slate-300 border border-slate-600',
}

const sizeClass: Record<Size, string> = {
  sm:  'px-3 py-1.5 text-sm rounded-lg min-h-[36px]',
  md:  'px-4 py-2.5 text-base rounded-xl min-h-[44px]',
  lg:  'px-6 py-3 text-lg rounded-xl min-h-[52px]',
  xl:  'px-8 py-4 text-xl rounded-2xl min-h-[64px]',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  fullWidth?: boolean
  children: ReactNode
}

export function Button({ variant = 'primary', size = 'md', fullWidth, className = '', children, ...rest }: Props) {
  return (
    <button
      className={[
        'inline-flex items-center justify-center gap-2 transition-colors duration-100',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        variantClass[variant],
        sizeClass[size],
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </button>
  )
}
