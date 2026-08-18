exports.handler = async function () {
  return {
    statusCode: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, max-age=0',
      'x-trendpilot-runtime-probe': 'namecheap-v1'
    },
    body: JSON.stringify({
      ok: true,
      runtime: 'namecheap-v1',
      productConfidence: '21.3.0'
    })
  };
};
