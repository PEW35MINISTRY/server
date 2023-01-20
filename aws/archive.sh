echo "Archieving Encouraging Prayer Server"
# Stop Server
sudo pm2 kill

cd /home/ubuntu/server

# Cache Key Files
last_release = release-end-$(date + '%F')-$(date + '%N')
sudo mkdir "../${last_release}"

sudo cp -r "LOGS" "../${last_release}/LOGS"
sudo cp -r "aws" "../${last_release}/aws"
sudo cp "package.json" "../${last_release}/"
sudo cp "package-lock.json" "../${last_release}/"
sudo cp "tsconfig.json" "../${last_release}/"

#Update Source Code | may be new deploy.sh script
git fetch --all
git checkout --force release

sudo "aws/deploy.sh"