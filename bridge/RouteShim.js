function toPuppeteerResponse(response) {
  return {
    status: response.status ? response.status() : 200,
    headers: response.headers ? response.headers() : {},
    body: response.body ? response.body() : '',
  };
}

module.exports = { toPuppeteerResponse };