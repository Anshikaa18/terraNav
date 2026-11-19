// Prefer TomTom when configured; retain HERE as a compatible server-side fallback.
const tomtom = require('./tomtomAdapter');
const here = require('./hereAdapter');

async function getFlowForRoutes(routes) {
  if (process.env.TOMTOM_API_KEY) return tomtom.getFlowForRoutes(routes);
  return here.getFlowForRoutes(routes);
}

module.exports = { ...here, getFlowForRoutes, tomtom };
