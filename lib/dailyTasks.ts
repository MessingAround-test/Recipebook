import { useState, useEffect, useCallback, useMemo } from 'react'

export type TaskDetect = 'symptoms' | 'exercise' | 'foodNames'

export type TaskAction = 'symptoms' | 'exercise' | 'quicklog'

export type DailyTaskDef = {
    id: string
    label: string
    emoji: string
    detect?: TaskDetect
    matchNames?: string[]
    target?: number
    allowManual: boolean
    action?: TaskAction
    cta?: string
    title?: string
    symptomName?: string
}

export type DailyTaskState = DailyTaskDef & {
    target: number
    count: number
    done: boolean
    autoDone: boolean
    manual: boolean
}

export const FRUIT_NAMES = [
    'apple', 'banana', 'orange', 'mandarin', 'berry', 'blueberr', 'strawberr', 'raspberr', 'blackberr',
    'grape', 'grapefruit', 'mango', 'kiwi', 'peach', 'nectarine', 'apricot', 'pear', 'plum', 'fig',
    'watermelon', 'melon', 'pineapple', 'pomegranate', 'coconut', 'papaya', 'lychee', 'fruit', 'date fruit'
]

export const VEGGIE_NAMES = [
    'carrot', 'broccoli', 'broccolini', 'spinach', 'lettuce', 'rocket', 'tomato', 'cucumber',
    'capsicum', 'bell pepper', 'onion', 'shallot', 'zucchini', 'cauliflower', 'cabbage', 'kale',
    'pumpkin', 'sweet potato', 'peas', 'green bean', 'asparagus', 'celery', 'leek', 'mushroom',
    'eggplant', 'avocado', 'corn', 'bok choy', 'pak choy', 'snow peas', 'brussels', 'beetroot',
    'radish', 'squash', 'artichoke', 'okra', 'vegetable', 'greens'
]

export const VITAMIN_NAMES = [
    'vitamin', 'multivitamin', 'supplement', 'omega', 'magnesium', 'zinc', 'iron tablet', 'b complex'
]

export const DEFAULT_DAILY_TASKS: DailyTaskDef[] = [
    { id: 'vitamins', label: 'Vitamins', emoji: '💊', detect: 'foodNames', matchNames: VITAMIN_NAMES, allowManual: true, action: 'quicklog', cta: 'Log', symptomName: 'Took vitamins' },
    { id: 'water', label: 'Water', emoji: '💧', target: 4, allowManual: true, symptomName: 'Drank water' },
    { id: 'fruit', label: 'Fruit', emoji: '🍎', detect: 'foodNames', matchNames: FRUIT_NAMES, allowManual: true, action: 'quicklog', cta: 'Log', symptomName: 'Ate fruit' },
    { id: 'veggies', label: 'Vegetables', emoji: '🥬', detect: 'foodNames', matchNames: VEGGIE_NAMES, allowManual: true, action: 'quicklog', cta: 'Log', symptomName: 'Ate vegetables' },
    { id: 'exercise', label: 'Exercise', emoji: '🏃', detect: 'exercise', allowManual: true, action: 'exercise', cta: 'Track', title: 'Exercise or rest day — tap the medal to mark it as a rest day', symptomName: 'Exercised' },
    { id: 'symptoms', label: 'Log symptoms', emoji: '🤒', detect: 'symptoms', allowManual: false, action: 'symptoms', cta: 'Track' },
]

export const TASK_SYMPTOM_NAMES: string[] = DEFAULT_DAILY_TASKS
    .filter(t => t.symptomName)
    .map(t => t.symptomName!)

function detectTaskDone(def: DailyTaskDef, todayLog: any, symptomLog: any): boolean {
    switch (def.detect) {
        case 'symptoms': {
            const manualSymptoms = (symptomLog?.symptoms || []).filter((s: any) => !s.auto)
            return !!symptomLog && (symptomLog.mood != null || manualSymptoms.length > 0)
        }
        case 'exercise':
            return !!todayLog && Number(todayLog.exercise_kcal || 0) > 0
        case 'foodNames': {
            const names = (todayLog?.items || []).map((it: any) => String(it.name || '').toLowerCase())
            if (!names.length) return false
            const matches = def.matchNames || []
            return names.some(n => matches.some(m => n.includes(m.toLowerCase())))
        }
        default:
            return false
    }
}

export function useDailyTasks(date: string, todayLog: any, symptomLog: any) {
    const storageKey = `dailyTasks.${date}`

    const [manualProgress, setManualProgress] = useState<Record<string, number>>(() => {
        if (typeof window === 'undefined') return {}
        try {
            return JSON.parse(localStorage.getItem(storageKey) || '{}')
        } catch {
            return {}
        }
    })

    useEffect(() => {
        if (typeof window === 'undefined') return
        try {
            setManualProgress(JSON.parse(localStorage.getItem(storageKey) || '{}'))
        } catch {
            setManualProgress({})
        }
    }, [storageKey])

    const toggle = useCallback((id: string) => {
        setManualProgress(prev => {
            const def = DEFAULT_DAILY_TASKS.find(t => t.id === id)
            const target = def?.target || 1
            const cur = prev[id] || 0
            const next = cur >= target ? 0 : cur + 1
            const updated = { ...prev, [id]: next }
            if (typeof window !== 'undefined') {
                try {
                    localStorage.setItem(storageKey, JSON.stringify(updated))
                } catch {
                    /* ignore */
                }
            }
            return updated
        })
    }, [storageKey])

    const tasks: DailyTaskState[] = useMemo(() => {
        return DEFAULT_DAILY_TASKS.map(def => {
            const autoDone = detectTaskDone(def, todayLog, symptomLog)
            const target = def.target || 1
            const count = manualProgress[def.id] || 0
            const manual = count > 0
            const done = autoDone || count >= target
            return { ...def, target, count, done, autoDone, manual }
        })
    }, [todayLog, symptomLog, manualProgress])

    const allDone = tasks.length > 0 && tasks.every(t => t.done)

    return { tasks, allDone, toggle }
}
