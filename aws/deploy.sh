# Must enable permissions for npm scripts
# sudo chmod 777 deploy.sh

#Update Server
if [ "$#" -eq 0 ] || [[ "$*" == *"server"* ]]
then
    echo "[0/20] Deploying Encouraging Prayer Server"
    cd /home/ubuntu/server

    #Delete dependnecies | Note: not deleting everything
    echo "[1/20] Deleteing Server Temperary Files"
    sudo rm -rf node_modules package-lock.json

    #Update source code
    echo "[2/20] Updating Server Source Code"
    git reset --hard
    git pull origin release
    git checkout --force release

    # Install latest dependencies
    echo "[3/20] Installing Server Dependencies"
    npm install

    #Compile typescript
    echo "[4/20] Compiling Server Typescript"
    npm run build

    echo "[5/20] Server Build Complete"

else
    echo "[5/20] Skipping Server Build"
fi

#Update WEBSITE
if [ "$#" -eq 0 ] || [[ "$*" == *"website"* ]]
then
    echo "[6/20] Deploying Encouraging Prayer Website"

    #Delete dependnecies
    echo "[7/20] Deleteing Website Temperary Files"
    cd /home/ubuntu/server
    sudo rm -rf website

    cd /home/ubuntu/website
    sudo rm -rf node_modules package-lock.json build

    #Update source code
    echo "[8/20] Updating Website Source Code"
    git reset --hard
    git pull origin release
    git checkout --force release

    echo "[9/20] Installing Website Dependencies"
    npm install

    echo "[10/20] Building Website Production Code"
    npm run build

    cp ./build/ ../server/website/

    echo "[11/20] Website Build Complete"
else
    echo "[11/20] Skipping Website Build"
fi

#Update PORTAL
if [ "$#" -eq 0 ] || [[ "$*" == *"portal"* ]]
then
    echo "[12/20] Deploying Encouraging Prayer Portal"

    #Delete dependnecies
    echo "[13/20] Deleteing Portal Temperary Files"
    cd /home/ubuntu/server
    sudo rm -rf website portal

    cd /home/ubuntu/portal
    sudo rm -rf node_modules package-lock.json build

    #Update source code
    echo "[14/20] Updating Portal Source Code"
    git reset --hard
    git pull origin release
    git checkout --force release

    echo "[15/20] Installing Portal Dependencies"
    npm install

    echo "[16/20] Building Portal Production Code"
    npm run build

    cp ./build/ ../server/portal/

    echo "[17/20] Portal Build Complete"

else
    echo "[17/20] Skipping Portal Build"
fi

echo "[18/20] Updating Server SSL Certificates"
#Update SSL | chron auto updates 2023-6-17
cp "~/etc/letsencrypt/live/encouragingprayer.org/fullchain.pem" "~/server/aws/fullchain.pem"
cp "~/etc/letsencrypt/live/encouragingprayer.org/privkey.pem" "~/server/aws/privkey.pem"

echo "[19/20] Copying pm2-start configuration settings"
#start PM2
cd 0-compiled
sudo cp "/home/ubuntu/server/aws/pm2-start.json" "."

echo "[20/20] Encouraging Prayer Production Build Complete"