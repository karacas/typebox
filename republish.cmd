cls && git pull && (npm run republish && out\make\squirrel.windows\x64\typebox_setup.exe -- --startOpen=false && echo . && echo '[rebuild OK]' && autoGit) 2>&1 | tee _report/rebuild.log