import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import * as webpush from 'web-push'
import { google } from 'googleapis'

admin.initializeApp()

const db = admin.firestore()

// 환경변수
const SECRET = process.env.SHORTCUT_SECRET || ''
const USER_UID = process.env.USER_UID || ''
const GCAL_CLIENT_EMAIL = process.env.GCAL_CLIENT_EMAIL || ''
const GCAL_PRIVATE_KEY = (process.env.GCAL_PRIVATE_KEY || '').replace(/\\n/g, '\n')
const GCAL_CALENDAR_ID = process.env.GCAL_CALENDAR_ID || ''
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || ''

// Web Push VAPID 설정
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(
    'mailto:yulim4013@gmail.com',
    VAPID_PUBLIC,
    VAPID_PRIVATE,
  )
}

function cors(res: functions.Response) {
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type, x-secret')
}

function auth(req: functions.Request, res: functions.Response): boolean {
  const secret = req.headers['x-secret'] || req.body?.secret
  if (!SECRET || secret !== SECRET) {
    res.status(401).json({ error: 'Unauthorized' })
    return false
  }
  return true
}

/**
 * 수면 기록 (취침 / 기상)
 */
export const recordSleep = functions
  .region('asia-northeast3')
  .https.onRequest(async (req, res) => {
    cors(res)
    if (req.method === 'OPTIONS') { res.status(204).send(''); return }
    if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return }
    if (!auth(req, res)) return

    const { type, date, time } = req.body as {
      type: 'sleep' | 'wake'
      date: string
      time: string
    }

    if (!type || !date || !time) {
      res.status(400).json({ error: 'type, date, time 필수' })
      return
    }

    const [h, m] = time.split(':').map(Number)
    const dt = new Date(date + 'T' + time + ':00+09:00')

    await db.collection('users').doc(USER_UID).collection('sleepRecords').add({
      type, date, time,
      hour: h, minute: m,
      timestamp: admin.firestore.Timestamp.fromDate(dt),
      createdAt: admin.firestore.Timestamp.now(),
      source: 'shortcut',
    })

    res.status(200).json({ ok: true, type, date, time })
  })

/**
 * 운동 기록 (애플워치)
 */
export const recordWorkout = functions
  .region('asia-northeast3')
  .https.onRequest(async (req, res) => {
    cors(res)
    if (req.method === 'OPTIONS') { res.status(204).send(''); return }
    if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return }
    if (!auth(req, res)) return

    const { workoutType, date, durationMin, calories, heartRateAvg } = req.body as {
      workoutType: string
      date: string
      durationMin: number
      calories?: number
      heartRateAvg?: number
    }

    if (!workoutType || !date || !durationMin) {
      res.status(400).json({ error: 'workoutType, date, durationMin 필수' })
      return
    }

    await db.collection('users').doc(USER_UID).collection('workouts').add({
      workoutType, date,
      durationMin: Number(durationMin),
      calories: calories ? Number(calories) : null,
      heartRateAvg: heartRateAvg ? Number(heartRateAvg) : null,
      timestamp: admin.firestore.Timestamp.now(),
      source: 'appleWatch',
    })

    res.status(200).json({ ok: true, workoutType, date, durationMin })
  })

// ── 웹 푸시 알림 스케줄러 ──

interface PushSub {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

/**
 * 사용자의 푸시 구독 목록 가져오기
 */
async function getUserSubscriptions(uid: string): Promise<{ id: string; sub: PushSub }[]> {
  const snap = await db.collection('users').doc(uid).collection('pushSubscriptions').get()
  const allSubs = snap.docs.map((d) => ({
    id: d.id,
    sub: d.data() as PushSub,
  })).filter((s) => s.sub.endpoint && s.sub.keys)

  // endpoint 기준 중복 제거 (같은 endpoint = 같은 기기, 마지막 것만 유지)
  const byEndpoint = new Map<string, { id: string; sub: PushSub }>()
  const toDelete: string[] = []
  for (const s of allSubs) {
    const existing = byEndpoint.get(s.sub.endpoint)
    if (existing) {
      toDelete.push(existing.id)
    }
    byEndpoint.set(s.sub.endpoint, s)
  }

  // 중복 구독 삭제
  for (const id of toDelete) {
    await db.collection('users').doc(uid).collection('pushSubscriptions').doc(id).delete().catch(() => {})
  }

  const subs = Array.from(byEndpoint.values())
  if (toDelete.length > 0) {
    console.log(`[Push] Cleaned up ${toDelete.length} duplicate subscriptions`)
  }
  console.log(`[Push] Found ${subs.length} unique subscriptions`)
  return subs
}

/**
 * Web Push 알림 전송
 */
async function sendPush(subs: { id: string; sub: PushSub }[], title: string, body: string, tag?: string) {
  if (subs.length === 0) return

  const payload = JSON.stringify({
    notification: { title, body },
    data: { tag: tag || 'default' },
  })

  for (const { id, sub } of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        payload,
        { TTL: 5 * 60 }, // 5분 유효 (앱 재진입 시 stale 알림 방지)
      )
      console.log(`[Push] Sent to ${id}`)
    } catch (err: any) {
      console.error(`[Push] Failed for ${id}:`, err?.statusCode, err?.body, err?.message)
      // 410 Gone 또는 404 = 구독 만료 → 삭제
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        console.log(`[Push] Removing expired subscription: ${id}`)
        await db.collection('users').doc(USER_UID).collection('pushSubscriptions').doc(id).delete().catch(() => {})
      }
    }
  }
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

/**
 * Date → KST 날짜 문자열 (Cloud Functions는 UTC 서버이므로 +9시간 보정 필수)
 */
function toKSTDateStr(date: Date): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60000)
  return kst.toISOString().split('T')[0]
}

/**
 * 반복 일정/태스크가 특정 날짜에 해당하는지 확인 (KST 기준)
 */
function matchesRepeatDate(originalDate: Date, todayStr: string, repeat: string, repeatEndDate?: admin.firestore.Timestamp | null): boolean {
  if (!repeat || repeat === 'none') return false

  const origStr = toKSTDateStr(originalDate)
  if (todayStr <= origStr) return false // target은 원본 이후여야 함

  // 반복 종료일 체크
  if (repeatEndDate) {
    const endStr = toKSTDateStr(repeatEndDate.toDate())
    if (todayStr > endStr) return false
  }

  const [, om, od] = origStr.split('-').map(Number)
  const [ty, tm, td] = todayStr.split('-').map(Number)

  // 요일 비교용 Date (UTC로 생성해서 getUTCDay 사용, 월은 0-based)
  const [oy] = origStr.split('-').map(Number)
  const origDow = new Date(Date.UTC(oy, om - 1, od)).getUTCDay()
  const targetDow = new Date(Date.UTC(ty, tm - 1, td)).getUTCDay()

  switch (repeat) {
    case 'daily': return true
    case 'weekly': return origDow === targetDow
    case 'monthly': {
      const lastDay = new Date(Date.UTC(ty, tm, 0)).getUTCDate()
      return od > lastDay ? td === lastDay : od === td
    }
    case 'yearly': return om === tm && od === td
    default: return false
  }
}

/**
 * 매 분 실행: 루틴/일정/태스크 미리알림 시간에 맞춰 푸시 전송
 */
export const sendScheduledNotifications = functions
  .region('asia-northeast3')
  .pubsub.schedule('every 1 minutes')
  .timeZone('Asia/Seoul')
  .onRun(async () => {
    if (!USER_UID) {
      console.warn('[Push] USER_UID not set')
      return null
    }
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      console.warn('[Push] VAPID keys not set')
      return null
    }

    const subs = await getUserSubscriptions(USER_UID)
    if (subs.length === 0) {
      console.log('[Push] No subscriptions registered')
      return null
    }

    const now = new Date()
    const kstOffset = 9 * 60
    const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes()
    const kstMinutes = (utcMinutes + kstOffset) % (24 * 60)
    const kstHour = Math.floor(kstMinutes / 60)
    const kstMin = kstMinutes % 60

    const kstDate = new Date(now.getTime() + kstOffset * 60000)
    const todayStr = kstDate.toISOString().split('T')[0]
    const todayStart = new Date(todayStr + 'T00:00:00+09:00')
    const todayEnd = new Date(todayStr + 'T23:59:59+09:00')

    const userRef = db.collection('users').doc(USER_UID)
    const notifications: Array<{ title: string; body: string; tag: string }> = []

    // 1. 루틴 알림 (오늘 날짜 루틴만 조회)
    try {
      const snap = await userRef.collection('routines')
        .where('date', '==', todayStr)
        .get()
      snap.docs.forEach((doc) => {
        const data = doc.data()
        if (data.isCompleted || !data.time) return
        const [rh, rm] = data.time.split(':').map(Number)
        if (rh === kstHour && rm === kstMin) {
          notifications.push({
            title: data.title,
            body: '루틴을 시작할 시간이에요!',
            tag: `routine-${doc.id}`,
          })
        }
      })
    } catch (err) {
      console.error('[Push] Routine error:', err)
    }

    // 2. 일정 알림 (오늘 날짜 + 반복 일정)
    try {
      // 모든 이벤트 조회 후 코드에서 필터
      const eventSnap = await userRef.collection('events').get()
      const withReminder = eventSnap.docs.filter((d) => {
        const data = d.data()
        return !data.isAllDay && data.startTime && data.reminder != null
      })
      console.log(`[Push] Events: ${eventSnap.size} total, ${withReminder.length} with reminder+time`)

      withReminder.forEach((doc) => {
        const data = doc.data()
        const startDate = data.startDate.toDate()
        const startStr = toKSTDateStr(startDate)
        const isToday = startStr === todayStr
        const isRepeatMatch = !isToday && matchesRepeatDate(startDate, todayStr, data.repeat, data.repeatEndDate)

        console.log(`[Push] Event "${data.title}" startStr=${startStr} todayStr=${todayStr} isToday=${isToday} isRepeat=${isRepeatMatch} reminder=${data.reminder} startTime=${data.startTime}`)

        if (!isToday && !isRepeatMatch) return

        const alertMin = timeToMinutes(data.startTime) - (data.reminder as number)
        console.log(`[Push] Event "${data.title}" alertMin=${alertMin} kstMin=${kstMinutes}`)
        if (alertMin === kstMinutes) {
          const title = data.title === '(제목 없음)' ? '일정' : data.title
          notifications.push({
            title: `📅 ${title}`,
            body: data.reminder > 0 ? `${data.reminder}분 후 시작` : '지금 시작',
            tag: `event-${doc.id}`,
          })
        }
      })
    } catch (err) {
      console.error('[Push] Event error:', err)
    }

    // 3. 태스크 알림
    try {
      const snap = await userRef.collection('tasks').where('isCompleted', '==', false).get()
      const withReminder = snap.docs.filter((d) => d.data().reminder != null && d.data().dueTime)
      console.log(`[Push] Tasks: ${snap.size} total, ${withReminder.length} with reminder+time`)
      snap.docs.forEach((doc) => {
        const data = doc.data()
        if (data.reminder == null || !data.dueTime) return

        // dueDate가 없으면 오늘 기준으로 체크
        if (data.dueDate) {
          const d = data.dueDate.toDate()
          const ds = toKSTDateStr(d)
          if (ds !== todayStr) {
            // 반복 태스크인 경우 오늘 매칭 확인
            if (!matchesRepeatDate(d, todayStr, data.repeat, data.repeatEndDate)) return
          }
        }

        const alertMin = timeToMinutes(data.dueTime) - (data.reminder as number)
        console.log(`[Push] Task "${data.title}" alertMin=${alertMin} kstMin=${kstMinutes} reminder=${data.reminder} dueTime=${data.dueTime}`)

        if (alertMin === kstMinutes) {
          notifications.push({
            title: `✅ ${data.title}`,
            body: data.reminder > 0 ? `${data.reminder}분 후 시작` : '지금 시작',
            tag: `task-${doc.id}`,
          })
        }
      })
    } catch (err) {
      console.error('[Push] Task error:', err)
    }

    // 전송
    for (const n of notifications) {
      await sendPush(subs, n.title, n.body, n.tag)
    }

    if (notifications.length > 0) {
      console.log(`[Push] Sent ${notifications.length} at ${kstHour}:${String(kstMin).padStart(2, '0')} KST`)
    }

    return null
  })

/**
 * 푸시 구독 전체 초기화 (중복 정리용)
 */
export const cleanupPushSubs = functions
  .region('asia-northeast3')
  .https.onRequest(async (req, res) => {
    cors(res)
    if (req.method === 'OPTIONS') { res.status(204).send(''); return }
    if (!auth(req, res)) return

    const snap = await db.collection('users').doc(USER_UID).collection('pushSubscriptions').get()
    const count = snap.size
    for (const doc of snap.docs) {
      await doc.ref.delete()
    }
    console.log(`[Push] Cleaned up ALL ${count} subscriptions`)
    res.status(200).json({ ok: true, deleted: count })
  })

/**
 * 사진 업로드 (클라이언트 → Cloud Function → Storage)
 */
export const uploadPhoto = functions
  .region('asia-northeast3')
  .runWith({ memory: '256MB', timeoutSeconds: 60 })
  .https.onRequest(async (req, res) => {
    cors(res)
    if (req.method === 'OPTIONS') { res.status(204).send(''); return }
    if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return }
    if (!auth(req, res)) return

    const busboy = require('busboy')
    const bb = busboy({ headers: req.headers })

    let uid = ''
    let fileBuffer: Buffer | null = null
    let fileMime = 'image/jpeg'

    bb.on('field', (name: string, val: string) => {
      if (name === 'uid') uid = val
    })
    bb.on('file', (_name: string, file: NodeJS.ReadableStream, info: { mimeType: string }) => {
      fileMime = info.mimeType || 'image/jpeg'
      const chunks: Buffer[] = []
      file.on('data', (chunk: Buffer) => chunks.push(chunk))
      file.on('end', () => { fileBuffer = Buffer.concat(chunks) })
    })
    bb.on('finish', async () => {
      if (!fileBuffer || !uid) {
        res.status(400).json({ error: 'file and uid required' })
        return
      }

      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`
      const storagePath = `users/${uid}/diary/${fileName}`
      const bucket = admin.storage().bucket('y-diary.firebasestorage.app')
      const file = bucket.file(storagePath)

      try {
        await file.save(fileBuffer, { contentType: fileMime, metadata: { contentType: fileMime } })
        await file.makePublic()
        const url = `https://storage.googleapis.com/y-diary.firebasestorage.app/${storagePath}`
        res.json({ ok: true, url, storagePath })
      } catch (err: any) {
        console.error('[uploadPhoto] error:', err.message)
        res.status(500).json({ error: err.message })
      }
    })

    bb.end(req.rawBody)
  })

/**
 * Storage 진단 + CORS 설정
 */
export const setupCors = functions
  .region('asia-northeast3')
  .https.onRequest(async (req, res) => {
    cors(res)
    if (!auth(req, res)) return

    const { Storage } = require('@google-cloud/storage')
    const storage = new Storage()
    const bucket = storage.bucket('y-diary.firebasestorage.app')

    try {
      // 버킷 존재 확인
      const [exists] = await bucket.exists()
      if (!exists) {
        res.json({ ok: false, error: 'Bucket does not exist' })
        return
      }

      // 테스트 파일 업로드
      const testFile = bucket.file('_test_upload.txt')
      await testFile.save('test', { contentType: 'text/plain' })
      await testFile.delete()

      // CORS 설정
      await bucket.setCorsConfiguration([{
        origin: ['*'],
        method: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD'],
        maxAgeSeconds: 3600,
        responseHeader: ['Content-Type', 'Authorization', 'Content-Length', 'X-Requested-With', 'x-goog-resumable'],
      }])

      // 기존 파일 확인
      const [files] = await bucket.getFiles({ prefix: 'users/', maxResults: 3 })

      res.json({
        ok: true,
        bucketExists: exists,
        testUpload: 'success',
        corsSet: true,
        existingFiles: files.map((f: any) => f.name),
      })
    } catch (err: any) {
      res.json({ ok: false, error: err.message })
    }
  })

// --- Google Calendar 헬퍼 (서비스 계정) ---

const COLOR_MAP: Record<string, string> = {
  '#FFD1DC': '4', '#C5D5F5': '9', '#C8E6C9': '2', '#D1C4E9': '1',
  '#FFE0B2': '6', '#FFF9C4': '5', '#B2DFDB': '2', '#FFCCBC': '4',
  '#E1BEE7': '3', '#B3E5FC': '7',
}

async function getGcalClient() {
  // Firebase 기본 서비스 계정 (ADC) 사용
  const authClient = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/calendar.events'],
  })
  return google.calendar({ version: 'v3', auth: authClient })
}

async function getCategoryByName(uid: string, name: string): Promise<{ id: string; color: string } | null> {
  const snap = await db.collection('users').doc(uid).collection('categories')
    .where('name', '==', name).limit(1).get()
  if (snap.empty) return null
  const doc = snap.docs[0]
  return { id: doc.id, color: doc.data().color }
}

async function getCategoryColor(uid: string, categoryId: string | null): Promise<string | undefined> {
  if (!categoryId) return undefined
  const snap = await db.collection('users').doc(uid).collection('categories').doc(categoryId).get()
  return snap.exists ? (snap.data()?.color as string) : undefined
}

/**
 * Apple Shortcuts용 항목 추가 (일정/태스크)
 * POST body: { type: 'event' | 'task', title, date, startTime?, endTime?, isAllDay?, categoryId?, description?, priority? }
 */
export const addItem = functions
  .region('asia-northeast3')
  .https.onRequest(async (req, res) => {
    cors(res)
    if (req.method === 'OPTIONS') { res.status(204).send(''); return }
    if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return }
    if (!auth(req, res)) return

    const {
      type, title, date, startTime, endTime,
      isAllDay, categoryId, category, description, priority,
    } = req.body as {
      type: string
      title: string
      date: string          // YYYY-MM-DD
      startTime?: string    // HH:mm
      endTime?: string      // HH:mm
      isAllDay?: boolean
      categoryId?: string   // 카테고리 ID (직접 지정)
      category?: string     // 카테고리 이름 (단축어용)
      description?: string
      priority?: 'high' | 'medium' | 'low'
    }

    // 한글 타입 지원
    const typeMap: Record<string, string> = { '일정': 'event', '할일': 'task', '할 일': 'task', 'event': 'event', 'task': 'task' }
    const normalizedType = typeMap[type] as 'event' | 'task' | undefined

    if (!normalizedType || !title || !date) {
      res.status(400).json({ error: 'type(일정/할일), title, date 필수' })
      return
    }

    console.log('[addItem] received:', JSON.stringify({ type, title, date, startTime, endTime, category }))

    // 카테고리 이름 → ID 변환
    let resolvedCategoryId = categoryId || null
    let resolvedColor: string | undefined
    if (!resolvedCategoryId && category) {
      // 이모지 제거 후 이름만 추출 (단축어에서 "👯 약속" 형태로 올 수 있음)
      const cleanName = category.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}]/gu, '').trim()
      const cat = await getCategoryByName(USER_UID, cleanName)
        || await getCategoryByName(USER_UID, category)
      if (cat) {
        resolvedCategoryId = cat.id
        resolvedColor = cat.color
      }
    }

    const now = admin.firestore.Timestamp.now()
    // 다양한 날짜 형식 지원 (YYYY-MM-DD, YYYY/MM/DD, ISO 등)
    const dateStr = String(date).split('T')[0].replace(/\//g, '-')
    const dateObj = new Date(dateStr + 'T00:00:00+09:00')
    if (isNaN(dateObj.getTime())) {
      res.status(400).json({ error: `잘못된 날짜 형식: ${date}` })
      return
    }
    const dateTs = admin.firestore.Timestamp.fromDate(dateObj)
    // 시간 파싱 (다양한 형식 지원)
    const validTime = (t?: string) => {
      if (!t || !t.trim()) return null
      const s = t.trim()
      // HH:mm 형식
      const direct = s.match(/^(\d{1,2}):(\d{2})$/)
      if (direct) {
        const h = Number(direct[1]), m = Number(direct[2])
        if (h >= 0 && h <= 23 && m >= 0 && m <= 59)
          return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      }
      // 한국어 형식: "오후 5:06" 또는 "2026. 4. 2. 오후 5:06"
      const kr = s.match(/(오전|오후)\s*(\d{1,2}):(\d{2})/)
      if (kr) {
        let h = Number(kr[2]), m = Number(kr[3])
        if (kr[1] === '오후' && h < 12) h += 12
        if (kr[1] === '오전' && h === 12) h = 0
        if (h >= 0 && h <= 23 && m >= 0 && m <= 59)
          return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      }
      // AM/PM 형식: "5:06 PM"
      const en = s.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
      if (en) {
        let h = Number(en[1]), m = Number(en[2])
        if (en[3].toUpperCase() === 'PM' && h < 12) h += 12
        if (en[3].toUpperCase() === 'AM' && h === 12) h = 0
        if (h >= 0 && h <= 23 && m >= 0 && m <= 59)
          return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      }
      return null
    }
    const validStartTime = validTime(startTime)
    const validEndTime = validTime(endTime)
    const allDay = isAllDay ?? !validStartTime

    let docId: string

    if (normalizedType === 'event') {
      const eventData = {
        title,
        description: description || '',
        startDate: dateTs,
        endDate: dateTs,
        startTime: validStartTime,
        endTime: validEndTime || validStartTime,
        isAllDay: allDay,
        categoryId: resolvedCategoryId,
        location: '',
        repeat: 'none',
        repeatEndDate: null,
        reminder: null,
        createdAt: now,
        updatedAt: now,
      }
      const ref = await db.collection('users').doc(USER_UID).collection('events').add(eventData)
      docId = ref.id
    } else {
      const taskData = {
        title,
        description: description || '',
        projectId: null,
        priority: priority || 'medium',
        status: 'todo',
        dueDate: dateTs,
        dueTime: validStartTime,
        categoryId: resolvedCategoryId,
        reminder: null,
        repeat: 'none',
        repeatEndDate: null,
        subItems: [],
        isCompleted: false,
        completedAt: null,
        completedTime: null,
        createdAt: now,
        updatedAt: now,
      }
      const ref = await db.collection('users').doc(USER_UID).collection('tasks').add(taskData)
      docId = ref.id
    }

    // Google Calendar 동기화
    try {
      const cal = await getGcalClient()
      const calendarId = GCAL_CALENDAR_ID || 'primary'
      if (cal) {
        const color = resolvedColor || await getCategoryColor(USER_UID, resolvedCategoryId)
        const colorId = color ? COLOR_MAP[color.toUpperCase()] : undefined

        const gcalEvent: Record<string, unknown> = {
          summary: normalizedType === 'task' ? `[TODO] ${title}` : title,
          description: description || undefined,
          ...(colorId && { colorId }),
        }

        if (allDay) {
          const endDate = new Date(dateObj)
          endDate.setDate(endDate.getDate() + 1)
          gcalEvent.start = { date: dateStr }
          gcalEvent.end = { date: endDate.toISOString().split('T')[0] }
        } else {
          const startDt = new Date(dateStr + 'T' + (validStartTime || '09:00') + ':00+09:00')
          const endDt = validEndTime
            ? new Date(dateStr + 'T' + validEndTime + ':00+09:00')
            : new Date(startDt.getTime() + 30 * 60000)
          gcalEvent.start = { dateTime: startDt.toISOString(), timeZone: 'Asia/Seoul' }
          gcalEvent.end = { dateTime: endDt.toISOString(), timeZone: 'Asia/Seoul' }
        }

        const result = await cal.events.insert({
          calendarId,
          requestBody: gcalEvent as any,
        })

        // 매핑 저장
        if (result.data.id) {
          const mappingKey = normalizedType === 'task' ? `task_${docId}` : docId
          await db.collection('users').doc(USER_UID).collection('settings').doc('gcalMapping')
            .set({ [mappingKey]: result.data.id }, { merge: true })
        }
      }
    } catch (err) {
      console.error('[addItem] GCal sync error:', err)
    }

    res.status(200).json({ ok: true, type: normalizedType, id: docId, title, date })
  })

/**
 * 항목 삭제 시 Google Calendar에서도 삭제
 * POST body: { type: 'event' | 'task', id: string }
 */
export const deleteItem = functions
  .region('asia-northeast3')
  .https.onRequest(async (req, res) => {
    cors(res)
    if (req.method === 'OPTIONS') { res.status(204).send(''); return }
    if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return }
    if (!auth(req, res)) return

    const { type, id } = req.body as { type?: string; id?: string }
    if (!type || !id) {
      res.status(400).json({ error: 'type, id 필수' })
      return
    }

    const mappingKey = type === 'task' ? `task_${id}` : id

    try {
      const mappingRef = db.collection('users').doc(USER_UID).collection('settings').doc('gcalMapping')
      const snap = await mappingRef.get()
      const gcalEventId = snap.exists ? snap.data()?.[mappingKey] : null

      if (gcalEventId) {
        const cal = await getGcalClient()
        const calendarId = GCAL_CALENDAR_ID || 'primary'
        try {
          await cal.events.delete({ calendarId, eventId: gcalEventId })
        } catch {
          // 이미 삭제된 경우 무시
        }
        // 매핑 제거
        const { FieldValue } = admin.firestore
        await mappingRef.update({ [mappingKey]: FieldValue.delete() })
      }
    } catch (err) {
      console.error('[deleteItem] GCal delete error:', err)
    }

    res.status(200).json({ ok: true, type, id })
  })
