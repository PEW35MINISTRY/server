echo "Archieving Encouraging Prayer Server"
# Stop Server
pm2 kill

cd /home/ubuntu/server

# Cache Key Files
LAST_RELEASE=$(date +'%F-%s')
ARCHIEVE_PATH="release-end/$LAST_RELEASE"
sudo mkdir -p "../$ARCHIEVE_PATH"

sudo cp -r "LOGS" "../${ARCHIEVE_PATH}/LOGS"
sudo cp -r "aws" "../${ARCHIEVE_PATH}/aws"
sudo cp "package.json" "../${ARCHIEVE_PATH}/"
sudo cp "package-lock.json" "../${ARCHIEVE_PATH}/"
sudo cp "tsconfig.json" "../${ARCHIEVE_PATH}/"

#Update Source Code | may be new deploy.sh script
git reset --hard
git pull origin release
git checkout --force release

#Start deploy script
chmod 777 "./aws/deploy.sh"
sudo "./aws/deploy.sh"