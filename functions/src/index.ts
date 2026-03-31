import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

admin.initializeApp()

const db = admin.firestore()
const fcm = admin.messaging()

// 환경변수에서 시크릿 키와 사용자 UID 가져오기
const SECRET = process.env.SHORTCUT_SECRET || ''
const USER_UID = process.env.USER_UID || ''

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
 * POST /recordSleep
 * Body: { secret, type: 'sleep'|'wake', date: 'YYYY-MM-DD', time: 'HH:MM' }
 * Header: x-secret: <SECRET>
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
      date: string   // 'YYYY-MM-DD'
      time: string   // 'HH:MM'
    }

    if (!type || !date || !time) {
      res.status(400).json({ error: 'type, date, time 필수' })
      return
    }

    const [h, m] = time.split(':').map(Number)
    const dt = new Date(date + 'T' + time + ':00+09:00') // KST

    await db.collection('users').doc(USER_UID).collection('sleepRecords').add({
      type,
      date,
      time,
      hour: h,
      minute: m,
      timestamp: admin.firestore.Timestamp.fromDate(dt),
      createdAt: admin.firestore.Timestamp.now(),
      source: 'shortcut',
    })

    res.status(200).json({ ok: true, type, date, time })
  })

/**
 * 운동 기록 (애플워치)
 * POST /recordWorkout
 * Body: { secret, workoutType, date, durationMin, calories, heartRateAvg }
 */
export const recordWorkout = functions
  .region('asia-northeast3')
  .https.onRequest(async (req, res) => {
    cors(res)
    if (req.method === 'OPTIONS') { res.status(204).send(''); return }
    if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return }
    if (!auth(req, res)) return

    const { workoutType, date, durationMin, calories, heartRateAvg } = req.body as {
      workoutType: string  // 예: '달리기', '근력운동', '수영'
      date: string         // 'YYYY-MM-DD'
      durationMin: number
      calories?: number
      heartRateAvg?: number
    }

    if (!workoutType || !date || !durationMin) {
      res.status(400).json({ error: 'workoutType, date, durationMin 필수' })
      return
    }

    await db.collection('users').doc(USER_UID).collection('workouts').add({
      workoutType,
      date,
      durationMin: Number(durationMin),
      calories: calories ? Number(calories) : null,
      heartRateAvg: heartRateAvg ? Number(heartRateAvg) : null,
      timestamp: admin.firestore.Timestamp.now(),
      source: 'appleWatch',
    })

    res.status(200).json({ ok: true, workoutType, date, durationMin })
  })

// ── FCM 푸시 알림 스케줄러 ──
// 매 분 실행: 루틴/일정/태스크의 미리알림 시간에 맞춰 푸시 전송

/**
 * 특정 사용자의 FCM 토큰 목록 가져오기
 */
async function getUserTokens(uid: string): Promise<string[]> {
  const snap = await db.collection('users').doc(uid).collection('fcmTokens').get()
  return snap.docs.map((d) => d.data().token as string).filter(Boolean)
}

/**
 * FCM 메시지 전송 (여러 토큰)
 */
async function sendPush(tokens: string[], title: string, body: string, data?: Record<string, string>) {
  if (tokens.length === 0) return

  const message: admin.messaging.MulticastMessage = {
    tokens,
    notification: { title, body },
    data: data || {},
    webpush: {
      notification: {
        icon: '/y_planner/icons/icon-192x192.jpg',
        badge: '/y_planner/icons/icon-192x192.jpg',
      },
    },
  }

  try {
    const result = await fcm.sendEachForMulticast(message)
    console.log(`[FCM] Sent: ${result.successCount} success, ${result.failureCount} failure`)

    // 실패한 토큰 정리 (만료/비활성)
    result.responses.forEach((resp, idx) => {
      if (!resp.success && resp.error) {
        const code = resp.error.code
        if (
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/registration-token-not-registered'
        ) {
          console.log('[FCM] Removing invalid token:', tokens[idx].slice(0, 20))
          // 무효 토큰 삭제
          db.collection('users').doc(USER_UID).collection('fcmTokens').doc(tokens[idx]).delete().catch(() => {})
        }
      }
    })
  } catch (err) {
    console.error('[FCM] sendPush error:', err)
  }
}

/**
 * 시간 문자열 'HH:MM'을 분 단위로 변환
 */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

/**
 * 매 분 실행되는 스케줄 함수
 * - 루틴: time 필드가 현재 시간(분)과 일치하면 알림
 * - 일정: startTime - reminder 분이 현재 시간과 일치하면 알림
 * - 태스크: dueTime - reminder 분이 현재 시간과 일치하면 알림
 */
export const sendScheduledNotifications = functions
  .region('asia-northeast3')
  .pubsub.schedule('every 1 minutes')
  .timeZone('Asia/Seoul')
  .onRun(async () => {
    if (!USER_UID) {
      console.warn('[FCM] USER_UID not set')
      return null
    }

    const tokens = await getUserTokens(USER_UID)
    if (tokens.length === 0) {
      console.log('[FCM] No tokens registered')
      return null
    }

    const now = new Date()
    // KST 기준 현재 시간 (분 단위)
    const kstOffset = 9 * 60 // UTC+9
    const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes()
    const kstMinutes = (utcMinutes + kstOffset) % (24 * 60)
    const kstHour = Math.floor(kstMinutes / 60)
    const kstMin = kstMinutes % 60

    // 오늘 날짜 (KST 기준)
    const kstDate = new Date(now.getTime() + kstOffset * 60000)
    const todayStr = kstDate.toISOString().split('T')[0] // 'YYYY-MM-DD'
    const todayStart = new Date(todayStr + 'T00:00:00+09:00')
    const todayEnd = new Date(todayStr + 'T23:59:59+09:00')

    const userRef = db.collection('users').doc(USER_UID)
    const notifications: Array<{ title: string; body: string; tag: string }> = []

    // 1. 루틴 알림
    try {
      const routinesSnap = await userRef.collection('routines')
        .where('time', '!=', null)
        .get()

      routinesSnap.docs.forEach((doc) => {
        const data = doc.data()
        if (data.isCompleted) return
        if (!data.time) return

        const [rh, rm] = data.time.split(':').map(Number)
        if (rh === kstHour && rm === kstMin) {
          const iconMap: Record<string, string> = {
            sunrise: '🌅', moon: '🌙', stretch: '🧘',
            water: '💧', pill: '💊', journal: '📝',
          }
          const emoji = data.iconId ? iconMap[data.iconId] || '⏰' : '⏰'
          notifications.push({
            title: `${emoji} ${data.title}`,
            body: '루틴을 시작할 시간이에요!',
            tag: `routine-${doc.id}`,
          })
        }
      })
    } catch (err) {
      console.error('[FCM] Routine check error:', err)
    }

    // 2. 일정 알림
    try {
      const eventsSnap = await userRef.collection('events')
        .where('startDate', '>=', admin.firestore.Timestamp.fromDate(todayStart))
        .where('startDate', '<=', admin.firestore.Timestamp.fromDate(todayEnd))
        .get()

      eventsSnap.docs.forEach((doc) => {
        const data = doc.data()
        if (data.isAllDay || !data.startTime) return
        if (data.reminder == null) return

        const eventMin = timeToMinutes(data.startTime)
        const alertMin = eventMin - (data.reminder as number)

        if (alertMin === kstMinutes) {
          const reminderText = data.reminder > 0 ? `${data.reminder}분 후 시작` : '지금 시작'
          const title = data.title === '(제목 없음)' ? '일정' : data.title
          notifications.push({
            title: `📅 ${title}`,
            body: reminderText,
            tag: `event-${doc.id}`,
          })
        }
      })
    } catch (err) {
      console.error('[FCM] Event check error:', err)
    }

    // 3. 태스크 알림
    try {
      const tasksSnap = await userRef.collection('tasks')
        .where('isCompleted', '==', false)
        .get()

      tasksSnap.docs.forEach((doc) => {
        const data = doc.data()
        if (data.reminder == null || !data.dueTime) return

        // dueDate가 오늘인지 확인
        if (data.dueDate) {
          const dueDate = data.dueDate.toDate()
          const dueDateStr = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}`
          if (dueDateStr !== todayStr) return
        }

        const taskMin = timeToMinutes(data.dueTime)
        const alertMin = taskMin - (data.reminder as number)

        if (alertMin === kstMinutes) {
          const reminderText = data.reminder > 0 ? `${data.reminder}분 후 시작` : '지금 시작'
          notifications.push({
            title: `✅ ${data.title}`,
            body: reminderText,
            tag: `task-${doc.id}`,
          })
        }
      })
    } catch (err) {
      console.error('[FCM] Task check error:', err)
    }

    // 알림 전송
    for (const n of notifications) {
      await sendPush(tokens, n.title, n.body, { tag: n.tag })
    }

    if (notifications.length > 0) {
      console.log(`[FCM] Sent ${notifications.length} notifications at ${kstHour}:${String(kstMin).padStart(2, '0')} KST`)
    }

    return null
  })
