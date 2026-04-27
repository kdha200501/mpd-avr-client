const { request } = require('http');

const HttpClient = function () {
  return (() => {
    /**
     * Make an HTTP POST call
     * @param {string} hostname The hostname
     * @param {string} path The path
     * @param {HttpObject} payload The POST request payload
     * @param {HttpObject} [headerOverrides] Optionally override headers
     * @returns {Promise<HttpObject>} A promise of the API response
     */
    const post = (hostname, path, payload, headerOverrides = {}) =>
      new Promise((resolve, reject) => {
        let /** @type OutgoingHttpHeaders */ outgoingHttpHeaders = {};

        const payloadString = JSON.stringify(payload);
        outgoingHttpHeaders['Content-Type'] = 'application/json';
        outgoingHttpHeaders['Content-Length'] =
          Buffer.byteLength(payloadString);

        let /** @type RequestOptions */ requestOptions = {};
        requestOptions.hostname = hostname;
        requestOptions.port = 80;
        requestOptions.path = path;
        requestOptions.method = 'POST';
        requestOptions.headers = { ...outgoingHttpHeaders, ...headerOverrides };

        const chunks = [];

        const clientRequest = request(requestOptions, (incomingMessage) => {
          incomingMessage.on('data', (data) => chunks.push(data));

          // upon response end
          incomingMessage.on('end', () => {
            try {
              resolve(JSON.parse(chunks.join('')));
            } catch (error) {
              reject(error);
            }
          });
        });

        clientRequest.on('error', reject);

        clientRequest.write(payloadString);

        // upon request end
        clientRequest.end();
      });

    return { post };
  })();
};

module.exports = HttpClient;
