const DEFAULT_PORT = 3800;

function getConfig() {
  const port = Number(process.env.PORT || DEFAULT_PORT);

  return {
    port,
    nodeEnv: process.env.NODE_ENV || 'development',
  };
}

module.exports = { getConfig };