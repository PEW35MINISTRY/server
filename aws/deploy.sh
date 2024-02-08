# Must enable permissions for npm scripts
# sudo chmod 777 deploy.sh -options
# sudo ./deploy.sh -aspwd


# Help Guide
Guide()
{
   echo
   echo "Encouraging Prayer Deploy Configurations"
   echo
   echo "Options: (Supply in Order)"
   echo "a     Achieve: Copy & clear server logs"
   echo "u     Update Server: Pull latest (includes latest deploy script)"
   echo "s     Server: Pull latest and compile typescript"
   echo "p     Portal: Pull latest and build project"
   echo "w     Website: Pull latest and build project"
   echo "d     Deploy PM2: Configure and start production manager"
   echo
}


# Achieve Logs
Achieve()
{
    echo "[1/8] ARCHIVE | Deploying Encouraging Prayer Server"
    cd /home/ubuntu/server

    # Cache Key Files
    LAST_RELEASE=$(date +'%F-%s')
    ARCHIVE_PATH="release-end/$LAST_RELEASE"
    echo "[2/8] ARCHIVE | Creating Archieve Directory: $ARCHIVE_PATH"
    sudo mkdir -p "../$ARCHIVE_PATH"

    echo "[3/8] ARCHIVE | Copying: Logs Directory"
    sudo cp -r "LOGS" "../${ARCHIVE_PATH}/LOGS"

    echo "[4/8] ARCHIVE | Copying: AWS scripts"
    sudo cp -r "aws" "../${ARCHIVE_PATH}/aws"

    echo "[5/8] ARCHIVE | Copying: package.json"
    sudo cp "package.json" "../${ARCHIVE_PATH}/"

    echo "[6/8] ARCHIVE | Copying: package-lock.json"
    sudo cp "package-lock.json" "../${ARCHIVE_PATH}/"

    echo "[7/8] ARCHIVE | Copying: tsconfig.json"
    sudo cp "tsconfig.json" "../${ARCHIVE_PATH}/"

    echo "[8/8] ARCHIVE | Server Build Complete"
}

# Update Server
UpdateServer()
{
    echo "[1/3] UPDATE SERVER | Pulling Encouraging Prayer Server"
    cd /home/ubuntu/server

    #Update source code
    echo "[2/3] UPDATE SERVER | Updating Server Source Code"
    git reset origin/release --hard
    git pull origin release
    git checkout --force release

    echo "[3/3] UPDATE SERVER | Server Fetch Complete"
}


# Build Server
Server()
{
    echo "[1/6] SERVER | Updating Encouraging Prayer Server"
    cd /home/ubuntu/server

    #Delete dependencies | Note: not deleting everything
    echo "[2/6] SERVER | Deleting Server Temporary Files"
    sudo rm -rf node_modules package-lock.json

    #Update source code
    echo "[3/6] SERVER | Updating Server Source Code"
    git reset origin/release --hard
    git pull origin release
    git checkout --force release

    # Install latest dependencies
    echo "[4/6] SERVER | Installing Server Dependencies"
    npm install

    #Compile typescript
    echo "[5/6] SERVER | Compiling Server Typescript"
    npm run build

    echo "[6/6] SERVER | Server Build Complete"
}


# Update & Build PORTAL
Portal()
{
    echo "[1/6] PORTAL | Updating Encouraging Prayer Portal"

    #Delete dependencies
    echo "[2/6] PORTAL | Deleting Portal Temporary Files"
    cd /home/ubuntu/server
    sudo rm -rf website portal

    cd /home/ubuntu/portal
    sudo rm -rf node_modules package-lock.json build

    #Update source code
    echo "[3/6] PORTAL | Updating Portal Source Code"
    git reset origin/release --hard
    git pull origin release
    git checkout --force release

    echo "[4/6] PORTAL | Installing Portal Dependencies"
    npm install

    echo "[5/6] PORTAL | Building Portal Production Code"
    npm run build

    cp ./build/ ../server/portal/

    echo "[6/6] PORTAL | Portal Build Complete"
}


# Update & Build WEBSITE
Website()
{
    echo "[1/6] WEBSITE | Updating Encouraging Prayer Website"

    #Delete dependencies
    echo "[2/6] WEBSITE | Deleting Website Temporary Files"
    cd /home/ubuntu/server
    sudo rm -rf website

    cd /home/ubuntu/website
    sudo rm -rf node_modules package-lock.json build

    #Update source code
    echo "[3/6] WEBSITE | Updating Website Source Code"
    git reset origin/release --hard
    git pull origin release
    git checkout --force release

    echo "[4/6] WEBSITE | Installing Website Dependencies"
    npm install

    echo "[5/6] WEBSITE | Building Website Production Code"
    npm run build

    cp ./build/ ../server/website/

    echo "[6/6] WEBSITE | Website Build Complete"
}


# DEPLOY PM2
Deploy()
{
    echo "[1/4] DEPLOY | Deploying Encouraging Prayer Production Initiating"
    cd /home/ubuntu

    echo "[2/4] DEPLOY | Copying pm2-start configuration settings"
    cd 0-compiled
    sudo cp "/home/ubuntu/server/aws/pm2-start.json" "."

    echo "[3/4] DEPLOY | Starting Server with PM2"
    pm2 start "node server/0-compiled/server.mjs"

    echo "[4/4] DEPLOY | Deploying Encouraging Prayer Production Complete"
}

################
# Main program #
################
echo
echo "[***] MAIN | Encouraging Prayer Production Deploy Initiating"

#Display fuide and terminate for no argument flags
if [ "$#" -eq 0 ] 
then
    Guide
    exit 1
fi

# Stop Server
pm2 kill

cd /home/ubuntu/server

while getopts ":auspwd" option; do
   case $option in
      a) # Achieve: Copy & clear server logs
         Achieve;;

      u) # Update Server: Pull latest (includes latest deploy script)
         UpdateServer;;

      s) # Server: Pull latest and compile typescript
         Server;;

      p) # Portal: Pull latest and build project
         Portal;;

      w) # Website: Pull latest and build project
         Website;;

      d) # Deploy PM2: Configure and start production manager
         Deploy;;

      *) # Help Guide
         Guide
         exit;;
   esac
done

echo "[***] MAIN | Encouraging Prayer Production Deploy Complete"
echo