# CLAUDE.md

공통 규칙은 AGENTS.md에 있어요 (ChatGPT·Codex와 같이 쓰는 규칙). 먼저 읽고 따르세요.

@AGENTS.md

## Claude Code만 따로 지킬 것

- **main에 올리는 건 Claude 담당:** ChatGPT·Codex가 만든 `chatgpt/…` 브랜치·PR은 내용을 확인하고(폰·태블릿 크기 화면 확인 포함) 문제없을 때 `main`에 합쳐요. 합치기 전에 사용자에게 무엇이 바뀌는지 한 줄로 알려요.
- **올리기 전 확인:** `git status`로 올라가는 파일을 보고, `making_GPT/`·원본 그림 폴더의 그림·PDF·PPT가 섞여 있으면 빼요. 폴더를 통째로 `git add -A` 하지 않아요.
- **여러 세션이 같은 폴더에서 일할 수 있어요:** 올리기 직전에 꼭 `git pull --rebase`, 남의 작업을 덮어쓰지 않기.
- **배포 확인:** `git push` 뒤에 `gh api repos/sangbiny-creater/twin-gameland/pages/builds/latest`로 빌드가 끝났는지(`built`) 확인하고 알려요.
- **화면 확인:** 헤드리스 Chrome으로 휴대폰 세로·가로, 태블릿 크기를 캡처해서 직접 보고, 실제 폰에서 아직 안 해 봤으면 그렇다고 말해요.
