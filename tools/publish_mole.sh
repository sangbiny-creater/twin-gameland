#!/bin/bash
# [준비만 해 둠 — 아직 쓰지 않음] 두더지 앱·백오피스를 따로 주소(예: https://mole.brown-crab.com)에 올리기
#   tools/publish_downhill.sh 와 같은 방식. 쓰기 전에 사용자가 정할 것:
#     1) GitHub 저장소 sangbiny-creater/mole 만들기 (+ GitHub Pages 켜기)
#     2) 가비아 DNS: CNAME mole → sangbiny-creater.github.io
#     3) 아래 DOMAIN, mole-app/app.js 의 WEB, mole-app/index.html 의 og: 주소를 새 주소로
#   그 전까지 두더지 앱은 이 저장소 main 의 /twin-gameland/mole-app/ (백오피스 /twin-gameland/mole-admin/) 에서 돌아감
#   올라가는 모양: / = 앱(mole-app/) · /admin/ = 백오피스(mole-admin/)
#   사용: bash tools/publish_mole.sh
set -e
DOMAIN=mole.brown-crab.com
SRC=$(cd "$(dirname "$0")/.." && pwd)
DST=${MOLE_SITE:-$HOME/Documents/mole-site}
[ -d "$DST/.git" ] || git clone https://github.com/sangbiny-creater/mole.git "$DST"
cd "$DST"
git config http.postBuffer 524288000
git pull --rebase -q 2>/dev/null || true
rsync -a --delete --exclude .git --exclude CNAME --exclude admin --exclude README.md --exclude .DS_Store "$SRC/mole-app/" "$DST/"
rsync -a --delete --exclude .DS_Store "$SRC/mole-admin/" "$DST/admin/"
echo "$DOMAIN" > CNAME
cat > README.md <<MD
# 두더지 게임 (BROWN CRAB)

- 앱: https://$DOMAIN/
- 백오피스: https://$DOMAIN/admin/

이 저장소는 올리기 전용이에요. 코드는 sangbiny-creater/twin-gameland 의 \`mole-app/\`·\`mole-admin/\` 에서 고치고
\`tools/publish_mole.sh\` 로 여기에 복사해서 올려요. 여기서 직접 고치지 마세요 (다음에 올릴 때 덮어써져요).
MD
git add -A
if git diff --cached --quiet; then echo "바뀐 것 없음"; exit 0; fi
git commit -q -m "twin-gameland $(cd "$SRC" && git log -1 --format=%h) 반영"
git push -q origin HEAD:main
echo "올림: https://$DOMAIN/ ($(git log -1 --format=%h))"
