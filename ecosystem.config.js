module.exports = {
  apps: [
    {
      name: 'gantavyam-server',
      script: './server/server.js',
      cwd: '/home/rohan/gantavyam',
      env: {
        NODE_ENV: 'development',
        PORT: 5000
      },
      watch: ['./server'],
      ignore_watch: ['node_modules', 'uploads'],
      log_file: './logs/server.log',
      error_file: './logs/server-error.log',
      out_file: './logs/server-out.log',
      instances: 1,
      autorestart: true,
      max_memory_restart: '1G'
    },
    {
      name: 'gantavyam-client',
      script: 'npm',
      args: 'start',
      cwd: '/home/rohan/gantavyam/client',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      log_file: './logs/client.log',
      error_file: './logs/client-error.log',
      out_file: './logs/client-out.log',
      instances: 1,
      autorestart: true,
      max_memory_restart: '1G'
    }
  ]
};