# AGENTS.md — 트윈 게임랜드 작업 규칙 (ChatGPT·Codex·Claude 공통)

이 저장소에서 일하는 모든 AI(ChatGPT·Codex·Claude)가 먼저 읽는 규칙이에요. 자세한 폴더·게임 설명은 [README.md](README.md)에 있어요.

## 1. 프로젝트

- 쌍둥이 **은유(여자아이)·은결(남자아이)** 이 주인공인 어린이용 HTML5 미니게임 모음.
- 빌드 도구 없는 순수 HTML·JavaScript·CSS. 서버 없이 정적 파일로 동작.
- 사이트: https://sangbiny-creater.github.io/twin-gameland/ — **`main` 브랜치에 올라가면 1~2분 안에 GitHub Pages로 바로 배포**돼요.
- 게임: `skyhook`(스카이훅 50판) · `helicopter`(Sky Rider 하늘타기, 예전 Twin Helicopter) · `stairs`(계단 오르기) · `shisen`(사천성 100판) · `downhill`(다운힐) · `memory`(메모리 100판) · `mole`(두더지 100판) · `bakery`(달콤 베이커리, 끝없이 이어짐·원버튼) · `dogsnack`(멍멍이 간식 타임, 끝없이 이어짐·3줄 버튼).
- 사용자(저장소 주인)는 **개발자가 아니에요.** 휴대폰으로 직접 해 보며 피드백해요.

## 2. 같이 일하는 방식 (사람 → ChatGPT → GitHub ← Claude)

```
사용자 ─┬─ ChatGPT/Codex : 기획서 · GPT 그림 요청 글 · 문서 · 작은 수정 → 브랜치 + PR
        └─ Claude Code   : 게임 코드 · 그림 적용 · 검수(폰·태블릿 화면 확인) → main에 올려 배포
                 GitHub 저장소 (main = 지금 게임 사이트, 유일한 정답)
```

1. **작업 시작 전에 항상 최신 내용 받기** (`git pull --rebase`). 끝나면 바로 올리기. 오래 붙잡고 있지 않기.
2. **ChatGPT·Codex는 `main`에 직접 올리지 않아요.** 브랜치 `chatgpt/<주제>`(예: `chatgpt/mole-design-doc`)에 올리고 PR을 만들어요. Claude가 확인하고 `main`에 합쳐요.
3. **같은 파일을 동시에 고치지 않기.** 기본 역할: ChatGPT는 `docs/`·`making_GPT/` 요청 글, Claude는 게임 코드(`<게임>/`, `hub/`, `common/`, `shop/`, `tools/`).
4. 커밋은 작게, 메시지는 **한국어로 무엇을 왜 바꿨는지** 한 줄.
5. 강제 올리기(force push)·기록 고쳐 쓰기·브랜치 삭제는 **사용자가 직접 허락한 경우만**.

## 3. 사용자와 말할 때

- 모든 답변·요약·버튼·문서는 **한국어**, 쉬운 말로. 전문 용어는 풀어서.
- 무엇을 바꿨는지 + 어디까지 확인했는지(캡처로 봤는지, 실제 폰에서는 아직인지)를 솔직하게.

## 4. 공개 저장소 — 올리면 안 되는 것

이 저장소는 **공개(Public)** 예요. 올린 파일은 누구나 볼 수 있어요.

- 개인 사진·업무 자료·비밀번호·토큰·API 키 절대 금지.
- GPT 원본 그림 폴더는 올리지 않아요 (컴퓨터에만 보관, `.gitignore`에 있음): `character/`, `image/`, `intro/`, `memorygame/`, `molegame/`, `bakerygame/`, `dogsnackgame/`, `making_GPT/`의 그림·PDF·PPT.
- `making_GPT/`에서는 **요청 글(`.txt`)만** 올려요.
- 게임에 실제로 쓰는 그림만 잘라서 webp로 게임 폴더에 넣어 올려요.

## 5. 코드 규칙

- 폴더: 게임마다 `<게임>/index.html · game.js · style.css · assets/`(`sprites/` `bg/` `ui/` `chars/` …). 공통은 `common/`, 메인 화면은 `index.html` + `hub/`, 아이템샵은 `shop/`.
- **저장 데이터를 깨지 않기:** 모든 진행도·코인·캐릭터는 브라우저 `localStorage`의 `twin_gameland_v1`(`common/profile.js`)에 있어요. 키 이름·형식을 바꾸지 말고, 바꿔야 하면 예전 데이터를 옮겨 주는 코드를 같이 넣어요.
- 파일을 고치면 폰에서 바로 보이도록 캐시 버전(`?v=`)을 올려요: `python3 tools/bump_version.py`.
- 그림은 webp(투명 그림은 무손실). 아이폰 홈 화면 아이콘만 PNG.
- 새 게임은 README의 "새 게임 추가하는 법"과 최근 게임(`memory/`, `mole/`, `bakery/`, `dogsnack/`) 구조를 따라요. 일시정지 창은 `common/pause.css`, 하트는 `common/ui/heart.webp`·`heart_empty.webp` (모든 게임 같은 모양).

## 6. 게임 공통 규칙 (사용자가 정한 것 — 바꾸지 않기)

- **스테이지 게임:** 10월드 × 10판 징검다리 지도. 인트로 START → 지도. 지금 해야 할 판은 분홍색으로 빛남.
- **결과 화면 버튼:** 첫 줄 "다음 스테이지" 한 줄 가득(가장 크게, 아래 버튼의 약 1.1배 높이) / 둘째 줄 "다시하기"·"지도로" 나란히.
- **일시정지 버튼:** 모든 게임 왼쪽 위.
- **인트로:** 세로 `hub/intro/<게임>.webp`(941x1672), 가로 `hub/intro/<게임>_land.webp`(1536x1024). 화면 방향에 따라 자동으로 바뀜.
- **게임 선택 카드:** `hub/cards/<게임>.webp`(480x592). 은유·은결 머리가 잘리지 않게, 로고 크기는 지금 크기 (`tools/game_cards.py`).
- **홈 화면 추가·즐겨찾기:** 모든 화면에서 이름 **"은유와 은결"**, 같은 아이콘(`hub/icons/`), 같은 `hub/manifest.json`.
- **캐릭터:** 고를 수 있는 모습은 **은유 v3·은결 v3만** (`common/chars/looks.js`, 옛 모습은 `hidden: true`).
- **사천성 층:** 2층은 1층 위(둘레 한 줄 빼고 안쪽)에 한 덩어리 또는 여러 덩어리, 3층은 2층 위에만. 같은 층끼리는 그 층에서, 다른 층끼리는 바로 옆이거나 판 밖을 거쳐 2번까지 꺾여 이어지면 잇기 (`shisen/levels.js`의 link). 쉬움·어려움 각각 판이 올라갈수록 절대 쉬워지지 않게 (`shisen/STAGES.md`). 어려움 N월드는 쉬움 N월드를 다 깨면 열림.

## 7. 그림 만들기 (GPT)

- GPT에는 **그림만** 시켜요. zip·파일 이름·정확한 px·코드 요구 ✕ (코드로 그림을 그려 버림).
- 게임 1개 = GPT 새 대화 1개. 한 답변에 1장, "계속"으로 다음 장.
- 캐릭터 비율 **얼굴 : 몸통 : 다리 = 1 : 1 : 1**, 은유·은결은 쌍둥이라 키·얼굴 크기 같음. **은유는 리본·머리띠 없음**(밝은 갈색 단발 + 둥근 은색 안경).
- 새 게임 기본 그림 6장(G01 카드 · G02 인트로 세로 · G03 인트로 가로 · G04 로고(초록 배경) · G05·G06 배경): `making_GPT/신규게임이미지_템플릿/GPT_요청_새게임_기본그림_템플릿.txt`.
- 받은 그림은 `<게임>game/GPT/G01.PNG …`처럼 번호를 붙여 저장 (여러 장을 한꺼번에 저장하면 순서가 섞여요).
- 캐릭터 그림 자동 자르기·검수·적용: `tools/char_pipeline.py`. 비율 기준 그림: `tools/make_ratio_guide.py`.

## 8. 확인하고 배포하기

1. 로컬에서 열기: `python3 -m http.server 8080` → http://localhost:8080
2. 휴대폰 세로(390x844)·가로(844x390), 태블릿(1024x768) 크기로 화면을 보고, 콘솔 오류·없는 파일(404)이 없는지 확인.
3. 캐시 버전 올리기 → 커밋 → `git pull --rebase` → `git push`.
4. GitHub Pages 빌드가 끝났는지 확인하고 사용자에게 알리기.
