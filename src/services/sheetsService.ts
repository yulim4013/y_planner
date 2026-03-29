import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { auth } from '../config/firebase'
import { useAuthStore } from '../store/authStore'
import { getBudgetCategory } from '../utils/constants'
import type { Transaction } from '../types'

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets'

// Firestore에 스프레드시트 ID 저장 용도
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../config/firebase'

async function getSheetsAccessToken(): Promise<string | null> {
  if (!auth) return null

  const provider = new GoogleAuthProvider()
  provider.addScope(SHEETS_SCOPE)

  try {
    const result = await signInWithPopup(auth, provider)
    const credential = GoogleAuthProvider.credentialFromResult(result)
    return credential?.accessToken || null
  } catch (error) {
    console.error('Sheets 권한 요청 실패:', error)
    return null
  }
}

async function getSpreadsheetId(): Promise<string | null> {
  const uid = useAuthStore.getState().user?.uid
  if (!uid || !db) return null

  const ref = doc(db, 'users', uid, 'settings', 'sheets')
  const snap = await getDoc(ref)
  return snap.exists() ? snap.data().spreadsheetId || null : null
}

async function saveSpreadsheetId(spreadsheetId: string) {
  const uid = useAuthStore.getState().user?.uid
  if (!uid || !db) return

  await setDoc(doc(db, 'users', uid, 'settings', 'sheets'), { spreadsheetId })
}

async function createSpreadsheet(token: string): Promise<string | null> {
  const res = await fetch(SHEETS_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title: '나의 하루 - 가계부' },
      sheets: [{ properties: { title: '요약' } }],
    }),
  })

  if (!res.ok) {
    console.error('스프레드시트 생성 실패:', await res.text())
    return null
  }

  const data = await res.json()
  return data.spreadsheetId
}

async function ensureMonthSheet(
  token: string,
  spreadsheetId: string,
  sheetTitle: string,
) {
  // 시트 목록 확인
  const res = await fetch(
    `${SHEETS_API}/${spreadsheetId}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${token}` } },
  )

  if (!res.ok) return false

  const data = await res.json()
  const exists = data.sheets?.some(
    (s: { properties: { title: string } }) => s.properties.title === sheetTitle,
  )

  if (!exists) {
    await fetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: sheetTitle } } }],
      }),
    })
  }

  return true
}

function formatDate(ts: { toDate: () => Date }): string {
  const d = ts.toDate()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function syncToSheets(
  yearMonth: string,
  transactions: Transaction[],
): Promise<{ success: boolean; url?: string; error?: string }> {
  const token = await getSheetsAccessToken()
  if (!token) return { success: false, error: '구글 시트 권한을 얻지 못했습니다' }

  let spreadsheetId = await getSpreadsheetId()

  if (!spreadsheetId) {
    spreadsheetId = await createSpreadsheet(token)
    if (!spreadsheetId) return { success: false, error: '스프레드시트 생성 실패' }
    await saveSpreadsheetId(spreadsheetId)
  }

  const [year, month] = yearMonth.split('-')
  const sheetTitle = `${year}년 ${Number(month)}월`

  const ok = await ensureMonthSheet(token, spreadsheetId, sheetTitle)
  if (!ok) return { success: false, error: '시트 생성 실패' }

  // 데이터 준비: 헤더 + 거래 내역
  const sorted = [...transactions].sort(
    (a, b) => a.date.toDate().getTime() - b.date.toDate().getTime(),
  )

  const rows: (string | number)[][] = [
    ['날짜', '구분', '분류', '카테고리', '금액', '메모'],
  ]

  for (const txn of sorted) {
    const cat = getBudgetCategory(txn.category)
    rows.push([
      formatDate(txn.date),
      txn.type === 'income' ? '수입' : '지출',
      txn.subType === 'fixed' ? '고정' : txn.subType === 'variable' ? '변동' : '-',
      `${cat?.icon || ''} ${txn.category}`,
      txn.type === 'income' ? txn.amount : -txn.amount,
      txn.memo,
    ])
  }

  // 수입/지출 합계
  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0)
  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0)

  rows.push([])
  rows.push(['', '', '', '총 수입', totalIncome, ''])
  rows.push(['', '', '', '총 지출', -totalExpense, ''])
  rows.push(['', '', '', '잔액', totalIncome - totalExpense, ''])

  // 시트에 쓰기 (기존 내용 덮어쓰기)
  const range = `'${sheetTitle}'!A1`
  const clearRes = await fetch(
    `${SHEETS_API}/${spreadsheetId}/values/'${encodeURIComponent(sheetTitle)}'!A:F:clear`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    },
  )

  if (!clearRes.ok) {
    console.warn('시트 클리어 실패 (새 시트일 수 있음)')
  }

  const writeRes = await fetch(
    `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: rows }),
    },
  )

  if (!writeRes.ok) {
    const err = await writeRes.text()
    console.error('시트 쓰기 실패:', err)
    return { success: false, error: '데이터 쓰기 실패' }
  }

  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
  return { success: true, url }
}
