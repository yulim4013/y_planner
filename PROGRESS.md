# 나의 하루 플래너 - 진행 현황

> 최종 업데이트: 2026-03-31

---

## 프로젝트 개요

개인 라이프 플래너 PWA 웹앱. 할일, 일정, 일기, 가계부를 하나로 통합한 "나의 하루 다이어리" 앱.
모바일(아이폰) 홈 화면 설치 + PC 브라우저에서 실시간 동기화.

---

## 기술 스택

| 항목 | 기술 |
|------|------|
| 프론트엔드 | React 19 + Vite 8 + TypeScript |
| 상태관리 | Zustand |
| 백엔드/DB | Firebase Firestore (실시간 동기화) |
| 인증 | Firebase Auth (Google 로그인) |
| 사진 저장 | Firebase Storage (압축 후 업로드) |
| 호스팅 | GitHub Pages (배포 완료) |
| PWA | Service Worker (수동 설정) |
| UI | iOS 글라시즘 + 파스텔 톤 |
| 언어 | 한국어 |

---

## 앱 구조 (하단 4탭 + FAB)

```
┌─────────────────────────────┐
│  🏠    📋    📅    ➕    ⚙️   │
│ Home  Tasks  Cal  Add  More │
└─────────────────────────────┘
```

---

## 구현 완료 기능

### Phase 1: 기반 세팅 ✅

- [x] Vite + React + TypeScript 프로젝트 생성
- [x] Firebase 초기화 (Auth, Firestore, Storage)
- [x] Google 로그인 (LoginPage)
- [x] AppShell + BottomTabBar (탭 네비게이션)
- [x] HashRouter 라우팅 (GitHub Pages 호환)
- [x] GlassCard, 글라시즘 CSS 변수, 파스텔 팔레트
- [x] PWA manifest.json + Service Worker
- [x] 라이트/다크 테마 전환
- [x] Zustand 스토어 (authStore, uiStore)

### Phase 2: 할일(Tasks) ✅

- [x] Task 타입 정의 (title, description, priority, dueDate, dueTime, categoryId, subItems)
- [x] Firestore CRUD 서비스 (subscribeTasks, addTask, updateTask, deleteTask)
- [x] TasksPage - 3일치(어제/오늘/내일) + 마감일 없는 미완료 표시
- [x] TaskItem - 체크박스, 우선순위 뱃지, 카테고리 뱃지(제목 위), 마감일/시간, 서브아이템
- [x] TaskForm - 바텀시트로 생성/수정 (CategoryPicker 포함)
- [x] 필터: 전체 / 진행중 / 완료 / 미완료(지연)
- [x] 정렬: 시간순 / 중요도순 / 카테고리별 그룹핑
- [x] 체크리스트 서브아이템 (추가/삭제/토글)
- [x] 서브아이템 전체 완료 → 태스크 자동 완료
- [x] 마감일 없이 완료 체크 → 오늘 날짜 자동 설정

### Phase 3: 캘린더 + 일정 ✅

- [x] CalendarEvent 타입 정의 (title, start/endDate, start/endTime, isAllDay, location, categoryId)
- [x] Firestore CRUD 서비스 (subscribeEvents, addEvent, updateEvent, deleteEvent)
- [x] CalendarPage - 월/일 뷰 전환
- [x] MonthlyView - 월간 달력 그리드 + 이벤트/태스크 도트 표시
- [x] DailyView - 일정 + 태스크 리스트 (월 뷰 하단)
- [x] TimelineView - 아이폰 스타일 타임라인 (일 뷰 전용)
  - 왼쪽 시간 라벨 (오전/오후/정오)
  - 이벤트 컬러 블록 (시간 범위 표시)
  - 태스크 인라인 표시
  - 종일 이벤트 상단 고정
- [x] 일 뷰 주간 스트립 (아이폰 캘린더 참고)
- [x] EventForm - 바텀시트로 생성/수정
  - 제목, 종일 토글, 시작일/시간, 종료일/시간, 장소, 카테고리, 메모
- [x] 캘린더에서 Task도 통합 표시
- [x] 일정 정렬: 종일 → 상단 고정, 나머지 시간순

### 카테고리 시스템 ✅

- [x] Category 타입 정의 (name, color, icon, type)
- [x] Firestore CRUD 서비스 (subscribeCategories, addCategory, updateCategory, deleteCategory)
- [x] CategoryPicker - 폼 내 카테고리 선택 + 인라인 생성
- [x] CategoryManager - More 페이지에서 전체 카테고리 관리
- [x] Task/Event 카테고리 분리 관리
- [x] 파스텔 색상 10종 선택 가능
- [x] 실시간 업데이트 (클라이언트 필터링으로 composite index 이슈 해결)

### 홈 대시보드 ✅

- [x] DashboardPage - 오늘 데이터 통합
- [x] 오늘 일정 미리보기
- [x] 오늘 할일 요약
- [x] 오늘 지출 요약
- [x] 수면 시간 표시
- [x] 카테고리별 시간 통계
- [x] 오늘의 루틴 (진행률 바)

### FAB 추가 버튼 ✅

- [x] AddNewSheet - 4가지 옵션 바텀시트 (할일/일정/일기/지출)
- [x] 할일 → TaskForm 바로 연결
- [x] 일정 → EventForm 바로 연결

### Phase 4: 일기 ✅

- [x] DiaryForm (텍스트 + 사진 + 기분 + 제목 + 링크)
- [x] DiaryPage (날짜별 일기 보기)
- [x] 사진 압축 + Firebase Storage 업로드
- [x] 기분 이모지 선택
- [x] 일기 수정/삭제

### Phase 6: 가계부 ✅

- [x] TransactionForm (수입/지출 입력)
- [x] BudgetPage (월별 요약 + 카테고리별 차트)
- [x] BudgetSetup (월별 예산 설정)
- [x] AccountForm (계좌 관리)

### Phase 7: 루틴 시스템 ✅

- [x] 루틴 템플릿 관리
- [x] 매일 자동 루틴 인스턴스 생성
- [x] 물 마시기 전용 UI
- [x] 드래그로 순서 변경
- [x] 루틴 시간 지정 (알림)

### Phase 8: 추가 기능 ✅

- [x] 수면 기록 (Apple Shortcuts → Cloud Functions → Firestore)
- [x] GitHub Pages 배포 + GitHub Actions
- [x] 다크 모드 / 반응형 디자인
- [x] Google Sheets 내보내기

### Phase 9: 캘린더 타임라인 고도화 ✅

- [x] 이벤트 리사이즈 (꾹 누르기/더블클릭 → 핸들 표시)
- [x] 빈 칸에서 일정 추가
- [x] 겹치는 이벤트/태스크 나란히 배치
- [x] 수면 블록 표시 (정확한 시간 위치)
- [x] 월간 뷰 좌우 스와이프

### Phase 10: 캘린더 인터랙션 ✅

- [x] 한 번 클릭 → 선택 / 더블 클릭 → 수정
- [x] Backspace → 삭제 / Cmd+C → 복사 / Cmd+V → 붙여넣기
- [x] 크로스 카테고리 시간 겹침 분할
- [x] 미지정 태스크 완료 시 시간 자동 기록
- [x] 주간 뷰 컬럼 간격/분할 정렬

### Phase 11: 푸시 알림 시스템 ✅

- [x] 이중 알림 (클라이언트 setTimeout + Cloud Function Web Push)
- [x] VAPID 기반 Web Push API
- [x] tag 기반 중복 방지
- [x] TTL 5분 설정

### Phase 12: UX 개선 + 보안 (2026-04-05) ✅

- [x] 홈 상단 카테고리 3개 사용자 지정 (Firestore dashboardSettings 동기화)
- [x] 홈 카테고리 카드 2줄 레이아웃 + 중앙정렬 + ellipsis
- [x] 캘린더 연/월 클릭 시 월 선택 팝업
- [x] 캘린더 + 버튼 Task 추가 시 선택 날짜 적용 (defaultDate prop)
- [x] 더보기 메뉴 정리 (가계부/테마설정/데이터내보내기 제거)
- [x] 브라우저 자동번역 차단 (tab label, header title에 translate="no")
- [x] 카테고리 입력 IME 버그 수정 (autoComplete/Correct/Capitalize off)
- [x] GCal service dead code 제거 (CI 빌드 복구)
- [x] 타임라인 일정 좌측 고정 (시작시간 무관, 이벤트 우선 컬럼 배정)
- [x] EventForm: 시작시간 설정 시 종료시간 +1h 자동 설정
- [x] 월간뷰/주간 스트립 스와이프 자연스럽게 (인접 패널 2번째 렌더링)
- [x] Firestore/Storage 이메일 화이트리스트 적용

---

## 파일 구조 (현재)

```
life-planner/
├── index.html
├── vite.config.ts
├── package.json
├── public/
│   ├── manifest.json
│   ├── sw.js
│   ├── favicon.svg
│   └── icons/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── config/
│   │   └── firebase.ts
│   ├── styles/
│   │   ├── global.css
│   │   ├── variables.css
│   │   └── animations.css
│   ├── types/
│   │   ├── index.ts
│   │   ├── task.ts
│   │   ├── event.ts
│   │   ├── diary.ts
│   │   ├── expense.ts
│   │   └── category.ts
│   ├── store/
│   │   ├── authStore.ts
│   │   └── uiStore.ts
│   ├── services/
│   │   ├── authService.ts
│   │   ├── taskService.ts
│   │   ├── eventService.ts
│   │   ├── categoryService.ts
│   │   ├── diaryService.ts
│   │   ├── budgetService.ts
│   │   ├── routineService.ts
│   │   ├── sleepService.ts
│   │   ├── accountService.ts
│   │   ├── notificationService.ts
│   │   ├── fcmService.ts
│   │   └── sheetsService.ts
│   ├── utils/
│   │   ├── dateUtils.ts
│   │   ├── currencyUtils.ts
│   │   └── constants.ts
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx
│   │   │   ├── BottomTabBar.tsx / .css
│   │   │   └── Header.tsx
│   │   ├── common/
│   │   │   ├── GlassCard.tsx / .css
│   │   │   ├── BottomSheet.tsx / .css
│   │   │   ├── ProgressBar.tsx / .css
│   │   │   ├── PastelBadge.tsx / .css
│   │   │   └── CategoryPicker.tsx / .css
│   │   ├── home/
│   │   │   └── DashboardPage.tsx / .css
│   │   ├── tasks/
│   │   │   ├── TasksPage.tsx / .css
│   │   │   ├── TaskItem.tsx / .css
│   │   │   └── TaskForm.tsx / .css
│   │   ├── calendar/
│   │   │   ├── CalendarPage.tsx / .css
│   │   │   ├── MonthlyView.tsx / .css
│   │   │   ├── DailyView.tsx / .css
│   │   │   ├── TimelineView.tsx / .css
│   │   │   ├── WeeklyView.tsx / .css
│   │   │   └── EventForm.tsx / .css
│   │   ├── addNew/
│   │   │   └── AddNewSheet.tsx / .css
│   │   └── more/
│   │       ├── MorePage.tsx / .css
│   │       └── CategoryManager.tsx / .css
│   └── pages/
│       └── LoginPage.tsx / .css
```

---

## Firestore 데이터 구조

```
users/{userId}/
  ├── tasks/{taskId}
  │     title, description, priority, status, dueDate, dueTime,
  │     categoryId, isCompleted, completedAt,
  │     subItems: [{ id, text, isCompleted, order }]
  │
  ├── events/{eventId}
  │     title, description, startDate, endDate, startTime, endTime,
  │     isAllDay, categoryId, location, repeat, reminder
  │
  ├── categories/{categoryId}
  │     name, color, icon, type(task/event/all), order
  │
  ├── diary/{date_string}        ← 미구현
  │
  └── expenses/{expenseId}       ← 미구현
```

---

## 라이브러리

| 라이브러리 | 버전 | 용도 | 사용여부 |
|-----------|------|------|---------|
| react | 19.2.4 | UI | ✅ |
| react-router-dom | 7.13.2 | 라우팅 | ✅ |
| firebase | 12.11.0 | Auth + Firestore | ✅ |
| zustand | 5.0.12 | 상태 관리 | ✅ |
| date-fns | 4.1.0 | 날짜 처리 | ✅ |
| framer-motion | 12.38.0 | 애니메이션 | ✅ |
| react-hot-toast | 2.6.0 | 알림 토스트 | ✅ |
| recharts | 3.8.1 | 차트 | ⏳ 가계부용 |
| xlsx | 0.18.5 | Excel 내보내기 | ⏳ |
| browser-image-compression | 2.0.2 | 사진 압축 | ⏳ 일기용 |

---

## 주요 해결된 이슈

1. **로그인 후 리다이렉트 안 됨** → `navigate()` 대신 `<Navigate>` 컴포넌트 사용
2. **Vite CSS import 캐시 에러** → 서버 재시작으로 해결
3. **체크리스트 Firestore 저장 실패** → plain object 변환 추가
4. **카테고리 실시간 갱신 안 됨** → composite index 대신 클라이언트 필터링
5. **crypto.randomUUID() 호환성** → Date.now + Math.random 조합으로 대체
6. **주간 뷰 컬럼 간격 불일치** → border-left → ::before pseudo-element 통일 + min-width:0
7. **알림 미작동** → 클라이언트 스케줄 함수 호출 복원 + 권한 자동 요청
8. **앱 재오픈 시 stale 알림** → Cloud Function push TTL 3600초 → 5분으로 축소
9. **모바일 일정 알림 2번 울림** → 서버 event tag 날짜 접미사 제거 (클라이언트 tag와 일치)

---

## 다음 작업 우선순위

1. 3-finger touch 드래그로 블록 이동
2. Cloud Functions Node.js 22 업그레이드 (Node 20 deprecated 2026-04-30)
3. UI 디자인 개선
4. Lighthouse 최적화
