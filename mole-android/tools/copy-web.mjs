// mole-app/ (웹 앱) 을 www/ 로 복사 — 앱에는 www/ 가 들어감. 앱 코드는 mole-app/ 에서만 고치기
import fs from 'node:fs'; import path from 'node:path'; import url from 'node:url';
const here = path.dirname(url.fileURLToPath(import.meta.url));
const SRC = path.resolve(here, '../../mole-app'), DST = path.resolve(here, '../www');
fs.rmSync(DST, { recursive: true, force: true });
fs.cpSync(SRC, DST, { recursive: true, filter: (p) => !/(README\.md|\.DS_Store)$/.test(p) });
console.log('복사함:', SRC, '→', DST);
