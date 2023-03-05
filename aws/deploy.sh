echo "Deploying Encouraging Prayer Server"

cd /home/ubuntu/server

#Delete dependnecies | Note: not deleting everything
sudo rm -rf node_modules package-lock.json website portal

#Update source code
git reset --hard
git pull origin release
git checkout --force release

# Install latest dependencies
npm install

#Compile typescript
npm run build

#Update WEBSITE
cd /home/ubuntu/website

#Delete dependnecies
sudo rm -rf node_modules package-lock.json build

git reset --hard
git pull origin release
git checkout --force release

npm install

npm run build 

cp ./build ../server/website

#Update PORTAL
cd /home/ubuntu/portal

#Delete dependnecies
sudo rm -rf node_modules package-lock.json build

git reset --hard
git pull origin release
git checkout --force release

npm install

npm run build 

cp ./build ../server/portal

#start PM2
cd 0-compiled
sudo cp "/home/ubuntu/server/aws/pm2-start.json" "."
pm2 start pm2-start.json