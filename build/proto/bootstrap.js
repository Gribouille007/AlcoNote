// bootstrap.js — kicks off the React tree once all globals are defined and
// registers the service worker. No inline scripts in index.html, so the
// CSP can drop 'unsafe-inline' for script-src.

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  });
}
