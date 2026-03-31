import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import * as webpush from 'web-push'

admin.initializeApp()

const db = admin.firestore()

// 환경변수
const SECRET = process.env.SHORTCUT_SECRET || ''
const USER_UID = process.env.USER_UID || ''
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
  const subs = snap.docs.map((d) => ({
    id: d.id,
    sub: d.data() as PushSub,
  })).filter((s) => s.sub.endpoint && s.sub.keys)
  console.log(`[Push] Found ${subs.length} subscriptions:`, subs.map((s) => `${s.id} (${s.sub.endpoint.slice(0, 50)}...)`))
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
        { TTL: 60 * 60 }, // 1시간 유효
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
 * 반복 일정/태스크가 특정 날짜에 해당하는지 확인
 */
function matchesRepeatDate(originalDate: Date, todayStr: string, repeat: string, repeatEndDate?: admin.firestore.Timestamp | null): boolean {
  if (!repeat || repeat === 'none') return false
  const orig = new Date(originalDate)
  orig.setHours(0, 0, 0, 0)
  const [ty, tm, td] = todayStr.split('-').map(Number)
  const target = new Date(ty, tm - 1, td)
  if (target.getTime() <= orig.getTime()) return false

  // 반복 종료일 체크
  if (repeatEndDate) {
    const endDate = repeatEndDate.toDate()
    endDate.setHours(23, 59, 59, 999)
    if (target.getTime() > endDate.getTime()) return false
  }

  switch (repeat) {
    case 'daily': return true
    case 'weekly': return orig.getDay() === target.getDay()
    case 'monthly': {
      const origDay = orig.getDate()
      const lastDay = new Date(ty, tm, 0).getDate()
      return origDay > lastDay ? td === lastDay : origDay === td
    }
    case 'yearly': return orig.getMonth() === (tm - 1) && orig.getDate() === td
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

    // 1. 루틴 알림
    try {
      const snap = await userRef.collection('routines').where('time', '!=', null).get()
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
        const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`
        const isToday = startStr === todayStr
        const isRepeatMatch = !isToday && matchesRepeatDate(startDate, todayStr, data.repeat, data.repeatEndDate)

        if (!isToday && !isRepeatMatch) return

        const alertMin = timeToMinutes(data.startTime) - (data.reminder as number)
        if (alertMin === kstMinutes) {
          const title = data.title === '(제목 없음)' ? '일정' : data.title
          notifications.push({
            title: `📅 ${title}`,
            body: data.reminder > 0 ? `${data.reminder}분 후 시작` : '지금 시작',
            tag: `event-${doc.id}-${todayStr}`,
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
          const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
