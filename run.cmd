rem (Taskkill /F /IM electron.exe || true) && (rimraf "c:/typebox/node_modules/.cache" || true) && npm start
(Taskkill /F /IM electron.exe || true) && npx electron .
