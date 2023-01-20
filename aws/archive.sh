echo "Archieving Encouraging Prayer Server"
# Stop Server
sudo pm2 kill

cd /home/ubuntu/server

# Cache Key Files
LAST_RELEASE=$(date +'%F-%s')
ARCHIEVE_PATH="release-end/$LAST_RELEASE"
sudo mkdir "../$ARCHIEVE_PATH"

sudo cp -r "/LOGS" "../${ARCHIEVE_PATH}/LOGS"
sudo cp -r "/aws" "../${ARCHIEVE_PATH}/aws"
sudo cp "package.json" "../${ARCHIEVE_PATH}/"
sudo cp "package-lock.json" "../${ARCHIEVE_PATH}/"
sudo cp "tsconfig.json" "../${ARCHIEVE_PATH}/"

#Update Source Code | may be new deploy.sh script
git pull --force origin release
git checkout --force release

sudo "./aws/deploy.sh"