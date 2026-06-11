import { useEffect, useMemo, useRef, useState } from 'react'

type CharStatus = 'correct' | 'incorrect' | 'current' | 'pending'

export interface TypingStats {
  wpm: number
  accuracy: number
}

interface TypingExerciseProps {
  target: string
  onComplete: (stats: TypingStats) => void
}

export default function TypingExercise({ target, onComplete }: TypingExerciseProps) {
  const [typedValue, setTypedValue] = useState('')
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [finishedAt, setFinishedAt] = useState<number | null>(null)
  const [now, setNow] = useState<number>(() => Date.now())

  const inputRef = useRef<HTMLInputElement>(null)
  const isComplete = finishedAt !== null

  // Reset all state and refocus whenever a new target arrives.
  useEffect(() => {
    setTypedValue('')
    setStartedAt(null)
    setFinishedAt(null)
    setNow(Date.now())
    inputRef.current?.focus()
  }, [target])

  // Tick the clock while the user is actively typing.
  useEffect(() => {
    if (startedAt === null || isComplete) return
    const id = window.setInterval(() => setNow(Date.now()), 200)
    return () => window.clearInterval(id)
  }, [startedAt, isComplete])

  const statuses = useMemo<CharStatus[]>(() => {
    return target.split('').map((char, i) => {
      if (i < typedValue.length) {
        return typedValue[i] === char ? 'correct' : 'incorrect'
      }
      if (i === typedValue.length && !isComplete) {
        return 'current'
      }
      return 'pending'
    })
  }, [target, typedValue, isComplete])

  const correctCount = useMemo(() => {
    let count = 0
    for (let i = 0; i < typedValue.length; i++) {
      if (typedValue[i] === target[i]) count++
    }
    return count
  }, [typedValue, target])

  const typedCount = typedValue.length
  const mistakes = typedCount - correctCount
  const accuracy = typedCount === 0 ? 100 : Math.round((correctCount / typedCount) * 100)

  const elapsedMs = startedAt === null ? 0 : (finishedAt ?? now) - startedAt
  const elapsedSeconds = elapsedMs / 1000
  const wpm =
    elapsedSeconds > 0 ? Math.round(correctCount / 5 / (elapsedSeconds / 60)) : 0

  const progress = Math.round((typedCount / target.length) * 100)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (isComplete) return
    const value = e.target.value.slice(0, target.length)

    if (startedAt === null && value.length > 0) {
      const start = Date.now()
      setStartedAt(start)
      setNow(start)
    }

    setTypedValue(value)

    if (value.length === target.length) {
      const end = Date.now()
      setFinishedAt(end)
      // Compute final stats directly (state updates are async).
      let correct = 0
      for (let i = 0; i < value.length; i++) {
        if (value[i] === target[i]) correct++
      }
      const finalAccuracy = Math.round((correct / value.length) * 100)
      const seconds = (end - (startedAt ?? end)) / 1000
      const finalWpm = seconds > 0 ? Math.round(correct / 5 / (seconds / 60)) : 0
      onComplete({ wpm: finalWpm, accuracy: finalAccuracy })
    }
  }

  function formatTime(ms: number) {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="typing-exercise">
      <section className="stats" aria-live="polite">
        <Stat label="WPM" value={wpm.toString()} />
        <Stat label="Accuracy" value={`${accuracy}%`} />
        <Stat label="Time" value={formatTime(elapsedMs)} />
        <Stat label="Mistakes" value={mistakes.toString()} />
      </section>

      <div className="progress-bar" role="progressbar" aria-valuenow={progress}>
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div
        className="passage"
        onClick={() => inputRef.current?.focus()}
        role="textbox"
        tabIndex={0}
      >
        {target.split('').map((char, i) => (
          <span key={i} className={`char char--${statuses[i]}`}>
            {char}
          </span>
        ))}
        <input
          ref={inputRef}
          className="hidden-input"
          value={typedValue}
          onChange={handleChange}
          maxLength={target.length}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label="Typing input"
        />
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span className="stat__value">{value}</span>
      <span className="stat__label">{label}</span>
    </div>
  )
}
