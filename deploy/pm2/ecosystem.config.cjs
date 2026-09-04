module.exports = {
  apps: [
    {
      name: 'baseball-recorder',
      script: 'server.js',
      cwd: '/Users/al02499373/git/other/baseball-recorder',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
        BASEBALL_DB_PATH: '/Users/al02499373/git/other/baseball-recorder/data/baseball.db',
      },
      time: true,
    },
  ],
};
