echo "Archieving Encouraging Prayer Server"
# Stop Server
sudo pm2 kill

cd /home/ubuntu/server

# Cache Key Files
last_release = $(date +'%F-%s')
archive_path = "release/${last_release}"
sudo mkdir "../${archive_path}"

sudo cp -r "/LOGS" "../${archive_path}/LOGS"
sudo cp -r "/aws" "../${archive_path}/aws"
sudo cp "package.json" "../${archive_path}/"
sudo cp "package-lock.json" "../${archive_path}/"
sudo cp "tsconfig.json" "../${archive_path}/"

#Update Source Code | may be new deploy.sh script
git fetch origin release
git checkout --force release

sudo "./aws/deploy.sh"