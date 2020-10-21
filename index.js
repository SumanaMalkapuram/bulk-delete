#!/usr/bin/env node

const auth0 = require('auth0');
var PromisePool = require('es6-promise-pool')

const configJson = require('./config.json');
const getUsers = require('./delete-users/users.json');

const http = require('http');
const originalOnSocket = http.ClientRequest.prototype.onSocket;
require('http').ClientRequest.prototype.onSocket = function(socket) {
  const that = this;
  socket.setTimeout(this.timeout ? this.timeout : 30000);
  socket.on('timeout', function() {
    that.abort();
  });
  originalOnSocket.call(this, socket);
};

const getMgmtClient = () => {
  if (this.mgmtClient) {
    return this.mgmtClient;
  }
  this.mgmtClient = new auth0.ManagementClient({
    domain: configJson.AUTH0_DOMAIN,
    clientId: configJson.AUTH0_CLIENT_ID,
    clientSecret: configJson.AUTH0_CLIENT_SECRET,
    tokenProvider: {
      enableCache: true,
      cacheTTLInSeconds: 60
    },
    retry: {
      enabled: true,
      maxRetries: 10
    }
  });
  return this.mgmtClient;
};

const app = {
  init: async configJson => {
    let mgmtClient = getMgmtClient();
    var maxParallelRequests = 10;
    var count = 0;
    var total = 2000;

    var promiseProducer = function() {
      console.log("delete counter at: ", count, "out of total: ", total)
      if (count < total) {
        var currentUserId = getUsers[count].user_id;
        //console.log("current userid", currentUserId)
        count++;

        return new Promise((ok, fail) => mgmtClient.deleteUser({ id: currentUserId },
          function(err, user) {
            if (err) {
              console.log("errored user", currentUserId);
              fail(err);
            } else {
              ok(user);
            }

            // Deleted user.
            //console.log("Success delete", currentUserId);
          }));
      } else {
        console.log("Returning null")
        return null;
      }
    };



    var pool = new PromisePool(promiseProducer, maxParallelRequests);
    pool.start()
      .then(function() {
        console.log('Complete');
        count = 0;
      });

  }
};

app.init(configJson);
module.exports = app;
