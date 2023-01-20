echo "Deploying Encouraging Prayer Server"

cd /home/ubuntu/server

#Delete dependnecies | Note: not deleting everything
sudo rm -rf node_modules package-lock.json

#Update source code
git reset --hard
git pull origin release
git checkout --force release

# Install latest dependencies
sudo npm install

#Compile typescript
sudo npm run build

#start PM2
cd 0-compiled
sudo cp "/home/ubuntu/server/aws/pm2-start.json" "."
sudo pm2 start pm2-start.json