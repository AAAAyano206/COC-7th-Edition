module.exports = {
  apps: [{
    name: 'coc-api',
    script: './dist/boot.js',
    cwd: '/opt/coc-trpg-bot',
    env: {
      NODE_ENV: 'production',
      APP_ID: '19f27c6c-6302-881b-8000-0000ded9c8d8',
      APP_SECRET: 'HTD6pAozcJTqdtWwfXYefN2egoJdp3Qt',
      DATABASE_URL: 'mysql://root:cocbot123@localhost:3306/coc_bot',
    },
    max_memory_restart: '512M',
    restart_delay: 3000,
  }],
};
