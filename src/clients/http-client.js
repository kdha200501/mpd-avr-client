const { request } = require('http');

const HttpClient = function () {
  return (() => {
    /**
     * Make an HTTP POST call with JSON payload
     * @param {string} hostname The hostname
     * @param {string} path The path
     * @param {HttpObject} payloadJson The POST request JSON payload
     * @param {HttpObject} [headerOverrides] Optionally override headers
     * @returns {Promise<HttpObject>} A promise of the API response
     */
    const post = (hostname, path, payloadJson, headerOverrides = {}) =>
      new Promise((resolve, reject) => {
        let /** @type OutgoingHttpHeaders */ outgoingHttpHeaders = {};

        const payloadString = JSON.stringify(payloadJson);
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

    /**
     * Make an HTTP POST call with XML payload
     * @param {string} hostname The hostname
     * @param {string} path The path
     * @param {string} payloadString The XML payload string
     * @param {HttpObject} [headerOverrides] Optionally override headers
     * @returns {Promise<HttpObject>} A promise of the API response
     */
    const postXml = (hostname, path, payloadString, headerOverrides = {}) =>
      new Promise((resolve, reject) => {
        let /** @type OutgoingHttpHeaders */ outgoingHttpHeaders = {};

        outgoingHttpHeaders['Content-Type'] = 'text/xml; charset=UTF-8';
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

          incomingMessage.on('end', () => {
            try {
              resolve(chunks.join(''));
            } catch (error) {
              reject(error);
            }
          });
        });

        clientRequest.on('error', reject);

        clientRequest.write(payloadString);

        clientRequest.end();
      });

    return { post, postXml };
  })();
};

module.exports = HttpClient;
