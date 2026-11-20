#!/bin/bash
# 다운힐 러너 앱·백오피스를 https://downhill.brown-crab.com 에 올리기
#   코드는 이 저장소(downhill-app/ · downhill-admin/)에서 고치고, 이 도구가 GitHub 저장소 sangbiny-creater/downhill 로 복사해서 올림
#   그 저장소의 GitHub Pages 에 도메인 downhill.brown-crab.com 이 연결돼 있음 (가비아 DNS: CNAME downhill → sangbiny-creater.github.io)
#   올라가는 모양: / = 앱(downhill-app/) · /admin/ = 백오피스(downhill-admin/)
#   사용: bash tools/publish_downhill.sh   (먼저 이 저장소를 커밋해 두면 커밋 번호가 메시지에 들어감)
set -e
SRC=$(cd "$(dirname "$0")/.." && pwd)
DST=${DOWNHILL_SITE:-$HOME/Documents/downhill-site}
[ -d "$DST/.git" ] || git clone https://github.com/sangbiny-creater/downhill.git "$DST"
cd "$DST"
git config http.postBuffer 524288000 # 그림이 많아 한 번에 올릴 때 끊기지 않게
git pull --rebase -q 2>/dev/null || true
rsync -a --delete --exclude .git --exclude CNAME --exclude admin --exclude README.md --exclude .DS_Store "$SRC/downhill-app/" "$DST/"
rsync -a --delete --exclude .DS_Store "$SRC/downhill-admin/" "$DST/admin/"
echo "downhill.brown-crab.com" > CNAME
cat > README.md <<'MD'
# 다운힐 러너 (BROWN CRAB)

- 앱: https://downhill.brown-crab.com/
- 백오피스: https://downhill.brown-crab.com/admin/

이 저장소는 올리기 전용이에요. 코드는 sangbiny-creater/twin-gameland 의 `downhill-app/`·`downhill-admin/` 에서 고치고
`tools/publish_downhill.sh` 로 여기에 복사해서 올려요. 여기서 직접 고치지 마세요 (다음에 올릴 때 덮어써져요).
MD
git add -A
if git diff --cached --quiet; then echo "바뀐 것 없음"; exit 0; fi
git commit -q -m "twin-gameland $(cd "$SRC" && git log -1 --format=%h) 반영"
git push -q origin HEAD:main
echo "올림: https://downhill.brown-crab.com/ ($(git log -1 --format=%h))"
