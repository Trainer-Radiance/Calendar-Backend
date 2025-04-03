@echo off
echo ===================================================
echo Preparing Calendar App Server for Vercel Deployment
echo ===================================================

echo.
echo Step 1: Installing dependencies...
call npm install

echo.
echo Step 2: Verifying configuration files...
echo - Checking vercel.json...
if exist vercel.json (
    echo   [OK] vercel.json found
) else (
    echo   [ERROR] vercel.json not found
    echo   Creating vercel.json...
    echo { > vercel.json
    echo   "version": 2, >> vercel.json
    echo   "builds": [ >> vercel.json
    echo     { >> vercel.json
    echo       "src": "server.js", >> vercel.json
    echo       "use": "@vercel/node" >> vercel.json
    echo     } >> vercel.json
    echo   ], >> vercel.json
    echo   "routes": [ >> vercel.json
    echo     { >> vercel.json
    echo       "src": "/(.*)", >> vercel.json
    echo       "dest": "server.js" >> vercel.json
    echo     } >> vercel.json
    echo   ] >> vercel.json
    echo } >> vercel.json
    echo   [OK] vercel.json created
)

echo - Checking .env.production...
if exist .env.production (
    echo   [OK] .env.production found
) else (
    echo   [ERROR] .env.production not found
    echo   Creating .env.production...
    echo NODE_ENV=production > .env.production
    echo CLIENT_URL=https://client-nine-bay-96.vercel.app >> .env.production
    echo GOOGLE_CLIENT_ID=your_google_client_id >> .env.production
    echo GOOGLE_CLIENT_SECRET=your_google_client_secret >> .env.production
    echo GOOGLE_REDIRECT_URI=https://server-steel-three.vercel.app/auth/callback >> .env.production
    echo SESSION_SECRET=your_strong_session_secret_key_here >> .env.production
    echo   [OK] .env.production created
)

echo.
echo Step 3: Preparation completed successfully!
echo.
echo ===================================================
echo Your server is now ready for Vercel deployment
echo ===================================================
echo.
echo To deploy to Vercel, you have two options:
echo.
echo Option 1: Using Vercel CLI
echo   1. Install Vercel CLI: npm install -g vercel
echo   2. Login to Vercel: vercel login
echo   3. Deploy: vercel --prod
echo.
echo Option 2: Using Vercel Dashboard
echo   1. Go to https://vercel.com
echo   2. Create a new project
echo   3. Import your repository or upload the server folder
echo   4. Configure environment variables:
echo      - NODE_ENV: production
echo      - CLIENT_URL: https://client-nine-bay-96.vercel.app
echo      - GOOGLE_CLIENT_ID: your_google_client_id
echo      - GOOGLE_CLIENT_SECRET: your_google_client_secret
echo      - GOOGLE_REDIRECT_URI: https://server-steel-three.vercel.app/auth/callback
echo      - SESSION_SECRET: your_strong_session_secret_key_here
echo.
echo IMPORTANT: Make sure to set up the correct environment variables in Vercel!
echo.

pause
