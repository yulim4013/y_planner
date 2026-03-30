# 나의 하루 플래너 - 프로젝트 진행 현황

> **최종 업데이트:** 2026-03-30 (v2)

---

## 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| **프로젝트명** | 나의 하루 플래너 (Life Planner) |
| **목적** | 할일, 일정, 일기, 가계부를 하나로 통합한 개인 라이프 플래너 |
| **사용자** | 개인 1인 사용 |
| **플랫폼** | PWA (모바일 홈 화면 설치 + PC 브라우저) |
| **언어** | 한국어 |
| **호스팅** | GitHub Pages (무료) |

---

## 2. 기술 스택

| 구분 | 기술 | 버전 |
|------|------|------|
| **프레임워크** | React | 19.2.4 |
| **빌드 도구** | Vite | 8.0.1 |
| **언어** | TypeScript | 5.9.3 |
| **라우팅** | React Router DOM (HashRouter) | 7.13.2 |
| **상태 관리** | Zustand | 5.0.12 |
| **백엔드/DB** | Firebase Firestore | 12.11.0 |
| **인증** | Firebase Auth (Google 로그인) | - |
| **스토리지** | Firebase Storage (사진 압축 업로드) | - |
| **날짜 처리** | date-fns (한국어 로케일) | 4.1.0 |
| **차트** | Recharts | 3.8.1 |
| **애니메이션** | Framer Motion | 12.38.0 |
| **알림** | React Hot Toast | 2.6.0 |
| **이미지 압축** | browser-image-compression | 2.0.2 |
| **엑셀 처리** | SheetJS (xlsx) | 0.18.5 |

---

## 3. 앱 구조 (하단 6탭)

```
┌──────────────────────────────────────┐
│  🏠    📋    📅    💰    📖    ⚙️     │
│ Home  Tasks  Cal  Budget Diary More  │
└──────────────────────────────────────┘
```

---

## 4. 라우팅 구조

```
HashRouter
├── /login              → LoginPage (Google 로그인)
├── /                   → AuthGuard → AppShell
│   ├── (index)         → DashboardPage (홈)
│   ├── /tasks          → TasksPage (할일)
│   ├── /calendar/*     → CalendarPage (캘린더)
│   ├── /budget         → BudgetPage (가계부)
│   ├── /diary          → DiaryPage (일기)
│   └── /more           → MorePage (설정)
└── /*                  → Navigate → /
```

---

## 5. 프로젝트 파일 구조

```
life-planner/
├── index.html
├── vite.config.ts
├── package.json
├── firebase.json               # Functions + Storage 설정
├── storage.rules               # Firebase Storage Security Rules
├── functions/
│   └── src/
│       └── index.ts            # Cloud Functions (recordSleep, recordWorkout)
├── public/
│   ├── manifest.json           # PWA 매니페스트
│   ├── sw.js                   # Service Worker
│   ├── favicon.svg
│   └── icons/
│       ├── icon-192x192.jpg
│       └── icon-512x512.jpg
└── src/
    ├── main.tsx                # 앱 진입점
    ├── App.tsx                 # 라우터 + AuthGuard
    │
    ├── config/
    │   └── firebase.ts         # Firebase 초기화 (Auth, Firestore, Storage)
    │
    ├── types/
    │   ├── index.ts            # 타입 re-export
    │   ├── task.ts             # Task, SubItem, Project
    │   ├── event.ts            # CalendarEvent
    │   ├── diary.ts            # DiaryEntry, DiaryPhoto, Mood
    │   ├── expense.ts          # Transaction, MonthlyBudget, Account
    │   ├── category.ts         # Category
    │   ├── routine.ts          # Routine, RoutineTemplate
    │   └── sleep.ts            # SleepRecord
    │
    ├── services/
    │   ├── authService.ts      # Google 로그인/로그아웃
    │   ├── taskService.ts      # Task/Project CRUD
    │   ├── eventService.ts     # CalendarEvent CRUD
    │   ├── diaryService.ts     # Diary CRUD + 사진 업로드
    │   ├── budgetService.ts    # Transaction/Budget CRUD
    │   ├── categoryService.ts  # Category CRUD
    │   ├── routineService.ts   # Routine/Template CRUD
    │   ├── sleepService.ts     # 수면 기록
    │   ├── accountService.ts   # 계좌 관리
    │   ├── notificationService.ts # 브라우저 푸시 알림
    │   └── sheetsService.ts    # Google Sheets 연동
    │
    ├── store/
    │   ├── authStore.ts        # 인증 상태 (Zustand)
    │   └── uiStore.ts          # UI 상태 (테마, 모달)
    │
    ├── utils/
    │   ├── constants.ts        # 기본 카테고리, 색상 팔레트
    │   ├── dateUtils.ts        # 한국어 날짜 포맷
    │   └── currencyUtils.ts    # 원화 포맷
    │
    ├── styles/
    │   ├── variables.css       # 디자인 토큰 (색상, 뉴모피즘, 레이아웃)
    │   ├── global.css          # 리셋, 반응형 베이스
    │   └── animations.css      # 키프레임 애니메이션
    │
    ├── pages/
    │   ├── LoginPage.tsx
    │   └── LoginPage.css
    │
    └── components/
        ├── layout/
        │   ├── AppShell.tsx         # 메인 레이아웃 (Outlet)
        │   ├── BottomTabBar.tsx/css # 하단 탭바
        │   └── Header.tsx/css       # 페이지 헤더
        │
        ├── common/
        │   ├── BottomSheet.tsx/css   # 바텀시트 모달
        │   ├── GlassCard.tsx/css    # 글라시즘 카드
        │   ├── CategoryPicker.tsx/css# 카테고리 선택 UI
        │   ├── PastelBadge.tsx/css  # 파스텔 뱃지
        │   └── ProgressBar.tsx/css  # 진행률 바
        │
        ├── home/
        │   └── DashboardPage.tsx/css # 홈 대시보드
        │
        ├── tasks/
        │   ├── TasksPage.tsx/css    # 할일 목록
        │   ├── TaskForm.tsx/css     # 할일 추가/수정 폼
        │   └── TaskItem.tsx/css     # 개별 할일 아이템
        │
        ├── calendar/
        │   ├── CalendarPage.tsx/css  # 캘린더 메인
        │   ├── MonthlyView.tsx/css  # 월간 뷰
        │   ├── WeeklyView.tsx/css   # 주간 뷰
        │   ├── DailyView.tsx/css    # 일간 뷰
        │   ├── TimelineView.tsx/css # 타임라인 뷰
        │   └── EventForm.tsx/css    # 일정 추가/수정 폼
        │
        ├── diary/
        │   ├── DiaryPage.tsx/css    # 일기 목록/보기
        │   └── DiaryForm.tsx/css    # 일기 작성/수정 폼
        │
        ├── more/
        │   ├── MorePage.tsx/css     # 설정 메뉴
        │   ├── BudgetPage.tsx/css   # 가계부 메인
        │   ├── BudgetSetup.tsx/css  # 예산 설정
        │   ├── TransactionForm.tsx/css # 수입/지출 입력
        │   ├── AccountForm.tsx/css  # 계좌 관리
        │   └── CategoryManager.tsx/css # 카테고리 관리
        │
        └── addNew/
            └── AddNewSheet.tsx/css  # FAB 빠른 추가 시트
```

---

## 6. Firebase 데이터 구조

```
users/{userId}/
├── projects/{projectId}
│     name, color, icon, order, isArchived
│
├── categories/{categoryId}
│     name, color, icon, type(task/event/expense/all), order
│
├── tasks/{taskId}
│     title, description, projectId, priority(high/medium/low)
│     status(todo/in_progress/done), dueDate, dueTime
│     categoryId, isCompleted, completedAt
│     subItems: [{ id, text, isCompleted, order }]
│
├── events/{eventId}
│     title, description, startDate, endDate
│     startTime, endTime, isAllDay, categoryId, location
│     repeat(none/daily/weekly/monthly), reminder
│
├── diary/{diaryId}
│     date, title, content, mood(great/good/okay/bad/terrible)
│     photos: [{ url, storagePath }]
│     links: string[]
│     tasksSummary[], eventsSummary[]
│
├── routineTemplates/{templateId}
│     iconId, title, order, startDate, endDate
│     targetMl?, time?
│
├── routines/{routineId}
│     templateId, iconId, title, isCompleted, date, order
│     checkedAt, targetMl?, currentMl?, time?
│
├── sleepRecords/{recordId}
│     type(sleep/wake), timestamp, date, time, hour, minute, createdAt
│
├── transactions/{transactionId}
│     type(income/expense), amount, category
│     description, date, accountId, isFixed
│
├── accounts/{accountId}
│     name, type, balance, color, icon
│
└── monthlyBudgets/{monthId}
      month, totalBudget, categories: [{ name, budget }]
```

---

## 7. UI 디자인 시스템

### 컬러 팔레트

| 용도 | 색상 | HEX |
|------|------|-----|
| 분홍 | ████ | `#FFD1DC` |
| 파랑 | ████ | `#C5D5F5` |
| 초록 | ████ | `#C8E6C9` |
| 보라 | ████ | `#D1C4E9` |
| 주황 | ████ | `#FFE0B2` |
| 노랑 | ████ | `#FFF9C4` |
| 민트 | ████ | `#B2DFDB` |
| 복숭아 | ████ | `#FFCCBC` |

### 브랜드 색상

| 용도 | HEX |
|------|-----|
| Primary (버터) | `#EFDE9C` |
| Primary Light | `#F5EBC0` |
| Primary Dark | `#D4C47A` |
| 배경 | `#F6F6F6` |
| 텍스트 | `#3A3A3A` |

### 뉴모피즘 스타일

```css
--neu-convex: 3px 3px 6px #dcdcdc, -3px -3px 6px #ffffff;
--neu-concave: inset 2px 2px 4px #dcdcdc, inset -2px -2px 4px #ffffff;
```

### 레이아웃

| 항목 | 값 |
|------|------|
| 최대 너비 (모바일) | 430px |
| 탭바 높이 | 72px |
| 헤더 높이 | 56px |
| 사이드바 너비 (PC) | 220px |
| 데스크톱 최대 너비 | 1200px |

---

## 8. 구현 완료 기능

### Phase 1: 기반 세팅 ✅
- [x] Vite + React + TypeScript 프로젝트 생성
- [x] Firebase 설정 (Auth, Firestore, Storage)
- [x] AppShell + BottomTabBar (6탭 네비게이션)
- [x] Google 로그인 (LoginPage)
- [x] GlassCard, 뉴모피즘 CSS, 파스텔 팔레트
- [x] PWA 설정 (manifest.json, Service Worker, 아이콘)
- [x] GitHub Pages 배포
- [x] Firestore IndexedDB 오프라인 캐싱

### Phase 2: 할일(Tasks) ✅
- [x] Task/Project 타입 정의 및 Firestore 서비스
- [x] TasksPage + TaskItem (목록 표시)
- [x] TaskForm (생성/수정 바텀시트)
- [x] 프로젝트별 그룹핑
- [x] 우선순위(높음/중간/낮음) 표시
- [x] 체크리스트 서브아이템 (SubItem)
- [x] 카테고리 연동 (색상 뱃지)
- [x] 완료/미완료 토글

### Phase 3: 캘린더 + 일정 ✅
- [x] CalendarEvent 타입 및 서비스
- [x] MonthlyView (월간 달력 그리드)
- [x] WeeklyView (주간 스트립 + 일일 뷰)
- [x] DailyView (일간 상세)
- [x] TimelineView (시간대별 타임라인)
- [x] EventForm (일정 생성/수정 바텀시트)
- [x] 뷰 전환 (월/주/일/타임라인)
- [x] "오늘" 버튼으로 빠른 이동
- [x] 주간 스트립 스와이프 애니메이션
- [x] 카테고리별 색상 표시
- [x] 장소 표시 (캘린더 뷰)
- [x] 장소 + 시간 같은 행에 표시
- [x] 기본값: 시간 지정 일정 (하루종일이 아닌)
- [x] 종료 시간 자동 조정 (시작시간 이후로)
- [x] 네이버 지도 연동 버튼

### Phase 4: 일기 ✅
- [x] DiaryEntry 타입 및 서비스
- [x] 사진 압축 + Firebase Storage 업로드
- [x] DiaryForm (텍스트 + 사진 + 기분 + 제목 + 링크)
- [x] DiaryPage (날짜별 일기 보기)
- [x] 날짜 네비게이션 (이전/다음 날)
- [x] 기분 이모지 선택 (최고/좋음/보통/별로/나쁨)
- [x] 최근 일기 목록
- [x] 일기 수정/삭제
- [x] 업로드 타임아웃 + 에러 핸들링

### Phase 5: 홈 대시보드 ✅
- [x] DashboardPage (오늘 데이터 통합)
- [x] 수면 시간 표시
- [x] 카테고리별 시간 통계 (업무/공부/운동)
- [x] 오늘의 루틴 (진행률 바)
- [x] 오늘 일정 미리보기
- [x] 오늘 할일 요약
- [x] 오늘 지출 요약
- [x] AddNewSheet (FAB → 빠른 추가)

### Phase 6: 가계부 ✅
- [x] Transaction 타입 및 서비스
- [x] TransactionForm (수입/지출 입력)
- [x] BudgetPage (월별 요약 + 카테고리별 차트)
- [x] BudgetSetup (월별 예산 설정)
- [x] AccountForm (계좌 관리)
- [x] CategoryManager (카테고리 생성/편집/삭제)

### Phase 7: 루틴 시스템 ✅
- [x] RoutineTemplate + Routine 타입
- [x] 루틴 템플릿 관리 (시작일~종료일)
- [x] 매일 자동 루틴 인스턴스 생성
- [x] 루틴 아이콘 선택 (모닝/나이트/스트레칭/물/영양제/모닝페이지)
- [x] 물 마시기 전용 UI (프로그레스 바 + 250ml 단위)
- [x] 낙관적 UI 업데이트 (즉시 반영)
- [x] 드래그로 순서 변경 (터치/마우스 지원)
- [x] 루틴 시간 지정 (알림 시간 설정)
- [x] 브라우저 푸시 알림 (Notification API)

### Phase 8: 추가 기능 ✅
- [x] 수면 기록 (Apple Shortcuts → Cloud Functions → Firestore → 홈+타임라인 표시)
- [x] 카테고리 관리 (Task/Event/Expense 통합)
- [x] 다크 모드 지원
- [x] 반응형 디자인 (모바일/태블릿/데스크톱)
- [x] Google Sheets 내보내기

### Phase 9: 캘린더 타임라인 고도화 ✅
- [x] 이벤트 리사이즈: 꾹 누르기(모바일)/더블클릭(웹) → 활성화 후 핸들 표시
- [x] 빈 칸 꾹 누르기(모바일)/더블클릭(웹) → 해당 시간에 일정 추가
- [x] 꾹 누르기 시 위치 인디케이터(시간 라벨 + 라인) 표시
- [x] 겹치는 이벤트 나란히 배치 (Apple Calendar 스타일 컬럼 레이아웃)
- [x] 겹치는 태스크 나란히 배치 (동일 시간)
- [x] 완료 태스크 스타일: 투명 배경, 회색 체크, 취소선 없음
- [x] 시간 지정 태스크: 연한 회색 박스 + 카테고리 텍스트 색상 (색상 바 없음)
- [x] 수면 블록: 정확한 시간 위치 표시 (sleepInfo record 기반)
- [x] 수면 블록: 💤 아이콘 (홈+타임라인 통일)
- [x] 수면 블록: 클릭 → 삭제 액션바
- [x] 월간 뷰 좌우 스와이프로 월 이동
- [x] 주간 스트립 스와이프 속도 조정 (200ms → 350ms)
- [x] "+" 버튼: 일정 추가 / 할 일 추가 선택 드롭다운
- [x] 타임라인 스크롤: 인터랙션 후 맨 위로 이동하는 버그 수정
- [x] Firebase Storage Security Rules 배포 (사진 업로드 오류 해결)
- [x] 카테고리 생성 시 고정핀 아이콘 필수값 제거

---

## 9. 주요 수정 이력

### 데이터 동기화 이슈 해결
- **문제:** Firestore `orderBy`가 해당 필드가 없는 문서를 자동 제외 → 모바일(캐시)과 웹(서버)에서 데이터 불일치
- **해결:** `orderBy` 제거, 클라이언트 사이드 정렬로 전환 (`(a.order ?? 0)` 폴백)
- **적용 대상:** `categoryService.ts`, `routineService.ts`

### 일기 사진 업로드 개선
- **문제:** 웹에서 업로드 무한 로딩, 모바일에서 리셋
- **해결:** `withTimeout` 유틸리티 추가 (업로드 30초, 압축 15초, URL 10초), 파일별 에러 핸들링

### 루틴 정렬 UX 개선
- **변경:** ▲▼ 버튼 → 드래그 핸들(≡)로 변경
- **구현:** 터치/마우스 이벤트 기반 드래그, `translateY` 애니메이션, Firestore 순서 업데이트

### 캘린더 UX 개선
- 일정 추가 시 기본값을 "시간 지정"으로 변경
- 종료 시간 자동 조정 (시작 시간 + 1시간)
- 장소 + 시간 같은 행에 표시
- "오늘" 버튼 추가
- 주간 스트립 스와이프 애니메이션

### 수면 기록 시스템 (Apple Shortcuts → 앱)
- **파이프라인:** Apple Shortcut → Cloud Function (POST) → Firestore `sleepRecords` → 앱 실시간 구독
- **Cloud Function:** `recordSleep` (asia-northeast3, Node 20)
  - 타임존 처리: `+09:00` KST 오프셋 적용
  - 저장 필드: `type, timestamp, date, time, hour, minute, createdAt`
- **앱 표시:**
  - 홈 대시보드: 수면 시간 + 💤 아이콘
  - 타임라인: 수면 블록 (정확한 시간 위치, 클릭 가능)
- **데이터 계산:** `date+time` 문자열 기반 (timestamp 타임존 문제 회피)
- **이슈 해결:**
  - Firestore composite index 필요 → 클라이언트 사이드 필터링으로 우회
  - Cloud Function UTC 파싱 → `+09:00` 접미사 추가
  - 수면 블록 위치 불일치 → sleepInfo에서 매칭된 record 직접 사용

### 타임라인 인터랙션 시스템
- **이벤트 활성화:** 꾹 누르기(500ms)/더블클릭 → 리사이즈 핸들 표시 + 파란 테두리
- **드래그:** 활성화 후 터치/마우스 드래그 → 이동 또는 리사이즈
- **빈 칸 추가:** 꾹 누르기(500ms)/더블클릭 → Y좌표 → 시간 변환 → 일정 추가
- **액션바:** 클릭 → 수정/복제/삭제 팝업 (수면은 삭제만)
- **겹침 레이아웃:** 이벤트/태스크 시간 겹침 감지 → 컬럼 할당 → 나란히 배치

### Firebase Storage 사진 업로드 수정
- **문제:** `storage/unknown` 에러 (Security Rules 미설정)
- **해결:** `storage.rules` 생성 → 인증된 사용자만 자신의 경로에 읽기/쓰기 허용
- **배포:** `firebase deploy --only storage`

### 알림 시스템
- 브라우저 Notification API 기반
- 앱이 열려 있을 때 스케줄된 시간에 알림
- Service Worker에서 알림 표시 + 클릭 시 앱 포커스
- 모바일 PWA 호환 (postMessage 방식)

---

## 10. Service Worker 기능

```
sw.js
├── 자동 업데이트 (skipWaiting + clients.claim)
├── Network-first 캐싱 전략 (오프라인 폴백)
├── 루틴 알림 수신 (SHOW_NOTIFICATION 메시지)
└── 알림 클릭 시 앱 열기/포커스
```

---

## 11. 비용

| 항목 | 무료 한도 | 예상 사용량 |
|------|-----------|-------------|
| Firestore 읽기 | 5만/일 | ~500-1000/일 |
| Firestore 쓰기 | 2만/일 | ~50-100/일 |
| Firebase Storage | 5GB | 압축 시 ~5만 장 |
| GitHub Pages | 무제한 | 정적 파일 |
| Firebase Auth | 무제한 | 1명 |

**총 비용: 무료**

---

## 12. 알려진 제한사항

| 항목 | 설명 |
|------|------|
| **푸시 알림** | 앱이 열려 있을 때만 동작. 완전한 백그라운드 푸시는 FCM + Cloud Functions 서버 필요 |
| **장소 검색** | 네이버 지도 앱으로 연결하는 외부 링크 방식. 앱 내 지도 검색은 API 키 필요 |
| **오프라인** | Firestore IndexedDB 캐시로 읽기 가능. 쓰기는 온라인 복귀 시 동기화 |
| **번들 크기** | ~970KB (minified). 코드 스플리팅으로 최적화 가능 |
| **수면 블록** | 수정 폼 없음 (삭제만 가능). 수면 기록은 Apple Shortcuts로만 입력 |
| **Cloud Functions** | Node.js 20 런타임 (2026-04-30 deprecated 예정, Node 22로 업그레이드 필요) |

---

## 13. 예정 작업

| 항목 | 상태 | 설명 |
|------|------|------|
| **운동 기록 (Apple Watch)** | 예정 | Watch에서 단축어 실행 → 종목 선택 → Cloud Function → 캘린더 운동 카테고리에 기록 |
| **로그인 페이지 디자인** | 예정 | 뉴모피즘 스타일 리디자인 |
| **루틴 시간 입력 UX** | 예정 | iOS Safari time input 가시성 개선 |
| **PWA 위젯** | 검토 중 | iOS 미지원, Android manifest shortcuts 대안 |
