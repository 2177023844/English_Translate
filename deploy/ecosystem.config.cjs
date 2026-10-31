// PM2 配置：单实例运行（SQLite 单写者，勿开多实例）
module.exports = {
  apps: [
    {
      name: 'vocab',
      script: 'server/dist/index.js',
      cwd: __dirname + '/..',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      max_memory_restart: '300M',
    },
  ],
}
