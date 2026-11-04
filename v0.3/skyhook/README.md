# Sky Hook Runner (은유 · 은결)

기획서(`Sky_Hook_Runner_Detailed_Game_Design_HandOff.pptx`)를 바탕으로 만든 HTML5 미니게임입니다.
외부 라이브러리 없이 `index.html` + `game.js` + `style.css` 만으로 PC·스마트폰 브라우저에서 실행됩니다.

## 바로 플레이

**https://sangbiny-creater.github.io/sky-hook-runner/** (GitHub Pages, 어디서나 접속 가능)

코드를 고친 뒤 `git push` 하면 1~2분 안에 위 주소에 반영됩니다.

## 로컬 실행

```bash
cd skyhook
python3 -m http.server 8080 --bind 0.0.0.0
```

- PC: http://localhost:8080
- 아이폰 (같은 Wi‑Fi): http://<맥 IP>:8080  (맥 IP 확인: `ipconfig getifaddr en0`)
  - Safari 공유 버튼 → **홈 화면에 추가** 하면 주소창 없이 앱처럼 전체화면으로 실행됩니다.
  - 무음 스위치가 켜져 있으면 소리가 나지 않습니다.
  - 화면 전체를 채웁니다. 세로로 들고 있어도(화면 회전 잠금 포함) 게임이 90° 돌아가서 가로 전체화면으로 보입니다.

## 조작

| 동작 | PC | 스마트폰 |
| --- | --- | --- |
| 점프 | Space / ↑ / 클릭 | 화면 탭 |
| 훅 걸기 | 공중에서 Space / 클릭 (꾹 누르고 있어도 자동으로 걸림) | 공중에서 탭 (꾹) |
| 훅 놓기 | 손 떼기 | 손 떼기 |
| 일시정지 / 재시작 | Esc·P / R | 우측 상단 버튼 |

## 구현 범위 (MVP)

- 은유 / 은결 캐릭터 선택, 자동 달리기 + 점프 + 훅 스윙 (코요테 타임·입력 버퍼·Perfect Hook·콤보)
- 4개 테마 스테이지 (하늘도시 / 숲속 나무마을 / 겨울왕국 / 석양의 항구), 구간 A~E 레벨 구조
- 코인·별·하트·자석, 먹구름 장애물, HP 3 + 피격 무적 1.2초, 낙하 시 다음 발판에서 재시작
- 홈 / 스테이지 선택 / 일시정지 / 결과 화면, 최고 거리·총 코인 저장(localStorage)
- WebAudio 효과음 + BGM(파일 없음), 소리 ON/OFF

캐릭터는 스프라이트 시트에서 잘라낸 프레임(`assets/kids.webp` + `kids.json`)을 사용합니다.

튜닝 값은 `game.js` 상단 `CFG`, 스테이지는 `STAGES`, 색상 테마는 `THEMES` 에 모여 있습니다.
