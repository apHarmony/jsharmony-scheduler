call eslint --fix *.js
call eslint --fix models\_*.js
call eslint --fix models\**\*.server.js
call eslint --config .eslintrc_models.js --ignore-pattern "_*" --ignore-pattern "*.onroute.*" --ignore-pattern "*.server.js" --fix models\**\*.js