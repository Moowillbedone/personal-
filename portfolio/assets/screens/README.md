# 실제 화면(스크린샷) 첨부 가이드

각 케이스의 `화면 · Screens` 영역은 아래 파일명으로 이미지를 이 폴더에 넣으면 **자동으로** 빈 자리(placeholder)를 대체합니다.
파일이 없으면 점선 박스 + 파일명 안내가 표시됩니다. (`index.html`은 수정할 필요 없음)

## 파일명 규칙

| 케이스 | 회사/서비스 | 파일명 | 권장 비율 |
|---|---|---|---|
| 01 | 그립 — 라이브 광고 플랫폼 | `grip-ad-1.png` (Admin) | 16:10 (wide) |
| | | `grip-ad-2.png` (앱) | 9:18 (phone) |
| | | `grip-ad-3.png` (앱) | 9:18 (phone) |
| 02 | 그립 — 도네이션 BM | `grip-donation-1.png` (앱) | 9:18 |
| | | `grip-donation-2.png` (앱) | 9:18 |
| | | `grip-donation-3.png` (Admin) | 16:10 |
| 03 | 캐시워크 — 통합 커뮤니티 | `cashwalk-1.png` (앱) | 9:18 |
| | | `cashwalk-2.png` (Admin) | 16:10 |
| | | `cashwalk-3.png` (앱) | 9:18 |
| 04 | 언니의파우치 — 언니딜 | `unnie-1.png`, `unnie-2.png`, `unnie-3.png` | 9:18 |
| 05 | 트로스트 — EAP | `trost-1.png` (앱) | 9:18 |
| | | `trost-2.png`, `trost-3.png` (Admin) | 16:10 |
| 06 | 팀워크 — 미션 광고 | `teamwalk-1.png`, `teamwalk-2.png` (앱) | 9:18 |
| | | `teamwalk-3.png` (Admin) | 16:10 |
| 07 | 하우핏 — AI 모션 | `howfit-1.png`, `howfit-2.png`, `howfit-3.png` | 9:18 |
| 08 | 다노 — 베이직 케어 | `dano-1.png`, `dano-2.png` (앱) | 9:18 |
| | | `dano-3.png` (Admin) | 16:10 |
| 09 | 엔핏 — 모두의 트레이닝 | (현재 화면 슬롯 없음 — 필요 시 추가) | — |

## 팁
- **phone(9:18)**: 모바일 앱 화면. 너무 길면 위쪽 위주로 잘려 보입니다(`object-position: top`).
- **wide(16:10)**: Admin·대시보드·웹 화면.
- 비율이 달라도 깨지진 않습니다(크롭됨). 정확히 맞추면 가장 깔끔합니다.
- 다른 비율을 쓰고 싶으면 해당 `.shot`의 클래스를 `shot-phone` ↔ `shot-wide`로 바꾸면 됩니다.
- 보안/노출 우려가 있는 실데이터는 마스킹 후 첨부하세요.
