import { useState } from 'react'

export function Counter({ start = 0 }) {
  const [count, setCount] = useState(start)
  return (
    <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', fontFamily: 'sans-serif' }}>
      <button onClick={() => setCount(c => c - 1)}>−</button>
      <strong>{count}</strong>
      <button onClick={() => setCount(c => c + 1)}>+</button>
    </div>
  )
}
