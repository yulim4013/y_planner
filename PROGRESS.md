# 나의 하루 플래너 - 진행 현황

> 최종 업데이트: 2026-03-29

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
| 호스팅 | GitHub Pages (예정) |
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

### 홈 대시보드 (부분 구현)

- [x] DashboardPage - 오늘의 태스크 진행률 + 태스크 리스트
- [ ] 오늘 일정 미리보기 (placeholder)
- [ ] 오늘 지출 요약 (placeholder)

### FAB 추가 버튼 ✅

- [x] AddNewSheet - 4가지 옵션 바텀시트 (할일/일정/일기/지출)
- [x] 할일 → TaskForm 바로 연결
- [x] 일정 → EventForm 바로 연결

---

## 미구현 기능

### Phase 4: 일기 시스템 ❌

- [ ] DiaryForm (텍스트 + 사진 + 기분 선택)
- [ ] DiaryEntry 뷰 (사진 캐러셀)
- [ ] DiaryGallery + DiaryCard (글라스 카드 그리드)
- [ ] 사진 압축 + Firebase Storage 업로드
- [ ] 자동 할일/일정 요약 삽입
- 타입 정의는 완료 (DiaryEntry, DiaryPhoto, Mood)

### Phase 6: 가계부 ❌

- [ ] ExpenseForm (수입/지출 입력)
- [ ] ExpenseList (날짜별 그룹)
- [ ] BudgetChart (카테고리 파이차트 + 일별 바차트)
- [ ] BudgetSection (월별 요약)
- 타입 정의는 완료 (Expense)
- 카테고리 상수 정의 완료

### Phase 7: 마무리 ❌

- [ ] 데이터 내보내기 (Tasks → Sheets, 지출 → Excel)
- [ ] 네이버 지도 연동 (장소 검색)
- [ ] 오프라인 지원 강화
- [ ] GitHub Pages 배포 + GitHub Actions
- [ ] Lighthouse 최적화
- [ ] UI 디자인 개선

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
│   │   └── categoryService.ts
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

---

## 다음 작업 우선순위

1. 일기 시스템 (Phase 4)
2. 홈 대시보드 완성 (일정/지출 미리보기)
3. 가계부 (Phase 6)
4. 데이터 내보내기
5. GitHub Pages 배포
6. UI 디자인 개선
