exports.handler = async function () {
  return {
    statusCode: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, max-age=0',
      'pragma': 'no-cache',
      'x-trendpilot-runtime-probe': 'namecheap-v2'
    },
    body: JSON.stringify({
      ok: true,
      runtime: 'namecheap-v2',
      pid: process.pid,
      uptimeSeconds: Math.round(process.uptime()),
      startedApprox: new Date(Date.now() - process.uptime() * 1000).toISOString()
    })
  };
};
