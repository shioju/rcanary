(function () {
  'use strict';

  var hash = window.location.hash.substr(1);
  var hostname = window.location.hostname;
  var protocol = window.location.protocol == 'https' ? 'wss' : 'ws';
  var port = '8099';
  var serverAddress = hash || (protocol + '://' + hostname + ':' + port);

  console.log('rcanary server address: ' + serverAddress);
  console.log(hash ? 'set from URL hash' : 'set to default address as hash is empty');

  var targets = null;
  var retryHandlerID = null;
  var staleTimers = {};

  function makeConnection (ws) {
    ws.onopen = function () {
      console.log('Connection to ' + serverAddress + ' established');

      targets = null;
      document.querySelector('#root').innerHTML = '';
      clearInterval(retryHandlerID);
      retryHandlerID = null;
    };

    ws.onerror = function (e) {
      console.log('Connection error', e);
    };

    ws.onclose = function (e) {
      console.log('Connection closed', e);

      if (retryHandlerID === null) {
        console.log('Starting reconnect process...');
        retryHandlerID = setInterval(function () {
          console.log('Attempting reconnect...');
          makeConnection(new WebSocket(serverAddress));
        }, 10000);
      }
    };

    ws.onmessage = function (message) {
      console.log('Message received', message);

      var payload;

      try {
        payload = JSON.parse(message.data);
      } catch (e) {
        console.log('Invalid message', e);
        return;
      }

      if (targets === null) {
        // First message is the target list
        targets = payload;
        var template = document.querySelector('#probe-target');
        var root = document.querySelector('#root');

        targets.http.forEach(function (t) {
          template.content.querySelector('.probe-name').textContent = t.name;
          template.content.querySelector('.probe-target').dataset.host = t.host;
          var clone = document.importNode(template.content, true);
          root.appendChild(clone);
        });
      } else {
        // Update to targets
        var selector = '.probe-target[data-host="' + payload.target.host + '"]';
        var targetEl = document.querySelector(selector);
        var time = new Date(Date.parse(payload.time)).toLocaleString(undefined, { timeZoneName: 'short' });
        targetEl.dataset.status = payload.status;
        targetEl.dataset.updated = payload.time;

        targetEl.dataset.stale = false;
        clearTimeout(staleTimers[payload.target.host]);
        staleTimers[payload.target.host] = setTimeout(function () {
          targetEl.dataset.stale = true;
        }, payload.target.interval_s * 1000 * 2);

        targetEl.querySelector('.probe-status').textContent = payload.status_code;
        targetEl.querySelector('.probe-time').textContent = time;
        targetEl.querySelector('.probe-link').href = payload.target.host;
      }
    };

    return ws;
  }

  makeConnection(new WebSocket(serverAddress));
}());
