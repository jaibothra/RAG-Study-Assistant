import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import type { QuizData, QuizQuestion } from '../types'

type OptionKey = 'A' | 'B' | 'C' | 'D'

interface QuestionState {
  selected?: OptionKey
  revealed: boolean
}

interface QuizCardProps {
  quiz: QuizData
}

const OPTION_KEYS: OptionKey[] = ['A', 'B', 'C', 'D']

const toTitleCase = (value: string): string =>
  value
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
const getRevisionConcept = (question: QuizQuestion): string => {
  const concept = typeof question.concept === 'string' ? question.concept.trim() : ''
  if (concept) {
    return concept
  }
  return question.question.trim().split(/\s+/).slice(0, 3).join(' ')
}

export default function QuizCard({ quiz }: QuizCardProps) {
  const [questionState, setQuestionState] = useState<Record<number, QuestionState>>({})
  const displayTopic = toTitleCase(quiz.topic)

  const handleSelectOption = (questionId: number, option: OptionKey) => {
    setQuestionState((prev) => {
      const current = prev[questionId]
      if (current?.revealed) {
        return prev
      }
      return {
        ...prev,
        [questionId]: {
          selected: option,
          revealed: true,
        },
      }
    })
  }

  const summary = useMemo(() => {
    const total = quiz.questions.length
    const revealedQuestions = quiz.questions.filter((question) => questionState[question.id]?.revealed)
    const allRevealed = total > 0 && revealedQuestions.length === total

    if (!allRevealed) {
      return null
    }

    const correctCount = quiz.questions.filter((question) => {
      const state = questionState[question.id]
      return state?.revealed && state.selected === question.correct
    }).length

    const wrongConcepts = Array.from(
      new Set(
        quiz.questions
          .filter((question) => {
            const state = questionState[question.id]
            return state?.revealed && state.selected !== question.correct
          })
          .map((question) => getRevisionConcept(question)),
      ),
    )

    return {
      total,
      correctCount,
      wrongConcepts,
      allCorrect: correctCount === total,
    }
  }, [quiz.questions, questionState])

  const getOptionClassName = (question: QuizQuestion, option: OptionKey): string => {
    const state = questionState[question.id]
    const selected = state?.selected
    const revealed = state?.revealed

    if (revealed) {
      if (option === question.correct) {
        return 'border-green-500 bg-green-500/10'
      }
      if (option === selected && option !== question.correct) {
        return 'border-red-500 bg-red-500/10'
      }
      return 'border-[#2a2a2a]'
    }

    if (selected === option) {
      return 'border-[#6366f1]'
    }

    return 'border-[#2a2a2a]'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full rounded-2xl border border-[#2a2a35] bg-[#111118] px-5 py-4 shadow-lg shadow-black/20 max-h-[70vh] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#2f2f2f_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#2f2f2f] [&::-webkit-scrollbar-track]:bg-transparent"
    >
      <div className="mb-4">
        <p className="text-sm font-medium text-[#6366f1]">{displayTopic}</p>
        <p className="text-xs text-[#9ca3af]">
          {quiz.questions.length} {quiz.questions.length === 1 ? 'question' : 'questions'}
        </p>
      </div>

      {quiz.questions.map((question, index) => {
        const state = questionState[question.id]
        const isRevealed = state?.revealed ?? false

        return (
          <div
            key={`${question.id}-${index}`}
            className={index === 0 ? '' : 'mt-4 border-t border-[#1e1e1e] pt-4'}
          >
            <p className="text-sm font-medium text-[#e5e5e5]">{question.question}</p>
            <div className="mt-3 space-y-2">
              {OPTION_KEYS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleSelectOption(question.id, option)}
                  disabled={isRevealed}
                  className={`w-full rounded-lg border bg-[#1a1a1a] px-4 py-2 text-left text-sm text-[#e5e5e5] transition-colors duration-200 ${
                    getOptionClassName(question, option)
                  } ${isRevealed ? 'cursor-not-allowed opacity-90' : 'hover:bg-[#222222]'}`}
                >
                  <span className="mr-2 text-[#9ca3af]">{option}.</span>
                  {question.options[option]}
                </button>
              ))}
            </div>

            {isRevealed ? (
              <div className="mt-2">
                <p className="text-[12.5px] text-[#9ca3af] italic">{question.explanation}</p>
              </div>
            ) : null}
          </div>
        )
      })}

      {summary ? (
        <div className="mt-6 border-t border-[#1e1e1e] pt-4 text-sm">
          {summary.allCorrect ? (
            <p className="text-green-400">Perfect score — strong understanding of {quiz.topic}</p>
          ) : (
            <>
              <p className="text-[#e5e5e5]">
                You got {summary.correctCount} / {summary.total} correct
              </p>
              <p className="mt-1 text-sm italic text-[#9ca3af]">
                Worth revisiting: {summary.wrongConcepts.join(', ')}
              </p>
            </>
          )}
        </div>
      ) : null}
    </motion.div>
  )
}
