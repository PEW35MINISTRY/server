rm -r 0-compiled
rm -f Lambda.zip
npm run build
mkdir .13-archived
cp -r 0-compiled/* .13-archived
cp -r node_modules .13-archived

rm -rf .13-archived/server.mjs
rm -rf .13-archived/server.mjs.map

rm -rf .13-archived/0-assets/public
rm -rf .13-archived/0-assets/static-pages

(cd .13-archived && zip -r ../Lambda.zip .) && rm -rf .13-archived